// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      userId,
      salonId,
      bookingDate,
      bookingTime,
      status,
      paymentMethod,
      paymentStatus,
      totalAmount,
      subtotal,
      offerDiscount,
      platformFee,
      gstAmount,
      personCount,
      durationMinutes,
      services,
      razorpayPaymentId,
      customerName,
      serviceNames,
      slotTimeLabel,
    } = await req.json()

    if (!userId || !salonId || !bookingDate || !bookingTime) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required booking fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    )

    // 1. Ensure customer record exists (upsert so it's idempotent)
    if (customerName) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (authUser?.user) {
        await supabaseAdmin.from('customers').upsert({
          id: userId,
          full_name: customerName,
          email: authUser.user.email || '',
          phone: authUser.user.user_metadata?.phone || '',
        }, { onConflict: 'id' })
      }
    }

    // 1.5 Prevent duplicate bookings (check if an active booking already exists for this slot)
    const { data: existingBookings, error: checkError } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('customer_id', userId)
      .eq('salon_id', salonId)
      .eq('booking_date', bookingDate)
      .eq('booking_time', bookingTime)
      .not('status', 'in', '("cancelled","rejected")')
      .limit(1)

    if (checkError) {
      console.error('Booking check error:', checkError)
    }

    if (existingBookings && existingBookings.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'You have already booked this slot. Please check your bookings.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 1.7 Prevent Over-booking (Slot Capacity Check)
    const { data: salonData } = await supabaseAdmin.from('salons').select('total_seats').eq('id', salonId).single();
    if (salonData) {
      const { data: slotBookings } = await supabaseAdmin
        .from('bookings')
        .select('person_count')
        .eq('salon_id', salonId)
        .eq('booking_date', bookingDate)
        .eq('booking_time', bookingTime)
        .not('status', 'in', '("cancelled","rejected")')
        .not('payment_status', 'in', '("failed")');
      
      const currentBookedSeats = (slotBookings || []).reduce((acc: number, curr: any) => acc + (curr.person_count || 1), 0);
      if (currentBookedSeats + (personCount || 1) > (salonData.total_seats || 4)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Sorry, this slot no longer has enough available seats. Please choose another time.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

    // 2. Insert the booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        customer_id: userId,
        salon_id: salonId,
        booking_date: bookingDate,
        booking_time: bookingTime,
        status: status,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        total_amount: totalAmount,
        subtotal: subtotal,
        offer_discount: offerDiscount,
        platform_fee: platformFee,
        gst_amount: gstAmount || 0,
        person_count: personCount,
        duration_minutes: durationMinutes,
        services: services,
        razorpay_payment_id: razorpayPaymentId || null,
      })
      .select()
      .single()

    if (bookingError) {
      console.error('Booking insert error:', bookingError)
      return new Response(
        JSON.stringify({ success: false, error: bookingError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 3. Insert owner booking alert ONLY after payment is confirmed (not during pending Razorpay checkout)
    // For Razorpay: the alert is sent by verify-razorpay-payment after signature check
    // For UPI/cash (non-pending): fire immediately
    if (paymentStatus !== 'pending') {
      const { data: salonOwner } = await supabaseAdmin
        .from('salons')
        .select('owner_id')
        .eq('id', salonId)
        .single()

      if (salonOwner?.owner_id) {
        const { error: alertErr } = await supabaseAdmin.from('owner_booking_alerts').insert({
          owner_id: salonOwner.owner_id,
          salon_id: salonId,
          booking_id: booking.id,
          customer_name: customerName || 'Customer',
          service_summary: serviceNames || 'Service',
          booking_time: slotTimeLabel || bookingTime,
          is_read: false,
        })
        if (alertErr) {
          console.error('owner_booking_alerts insert error:', alertErr.message)
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: booking }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err) {
    console.error('Create Booking Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

