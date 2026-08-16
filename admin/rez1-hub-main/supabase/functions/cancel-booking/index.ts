// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { booking_id, cancel_reason, cancelled_by, action } = await req.json()

    if (!booking_id) {
      throw new Error("Missing booking_id")
    }

    // Connect to Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch the booking
    const { data: booking, error: fetchErr } = await supabaseAdmin
      .from('bookings')
      .select('*, salons(*)')
      .eq('id', booking_id)
      .single()

    if (fetchErr || !booking) {
      throw new Error('Booking not found')
    }

    // 2. Fetch Razorpay credentials from platform_config table
    const { data: config } = await supabaseAdmin
      .from('platform_config')
      .select('razorpay_key_id, razorpay_key_secret')
      .maybeSingle()

    const RAZORPAY_KEY_ID = config?.razorpay_key_id || Deno.env.get('RAZORPAY_KEY_ID') || ''
    const RAZORPAY_KEY_SECRET = config?.razorpay_key_secret || Deno.env.get('RAZORPAY_KEY_SECRET') || ''

    // Helper for Razorpay Refund API
    // Razorpay supports refunds on a captured payment via: POST /v1/payments/:payment_id/refund
    const processRazorpayRefund = async (amount: number, reason: string) => {
      const razorpayPaymentId = booking.razorpay_payment_id

      if (!razorpayPaymentId) {
        console.warn('[cancel-booking] No razorpay_payment_id found on booking — cannot process refund')
        return { ok: false, data: { error: 'No Razorpay payment ID on booking' }, refundId: null }
      }

      if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        console.error('[cancel-booking] Razorpay credentials not configured')
        return { ok: false, data: { error: 'Razorpay credentials not configured' }, refundId: null }
      }

      const rzpAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
      const amountPaise = Math.round(amount * 100)

      const refundRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpayPaymentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${rzpAuth}`,
        },
        body: JSON.stringify({
          amount: amountPaise,
          notes: {
            reason: reason || 'Booking cancellation refund',
            booking_id: booking_id,
          }
        })
      })

      const refundData = await refundRes.json()
      console.log('[cancel-booking] Razorpay refund response:', JSON.stringify(refundData))

      const refundId = refundData?.id || null
      // Razorpay refund states: 'pending' -> 'processed' (via webhook)
      return { ok: refundRes.ok && !!refundId, data: refundData, refundId }
    }

    // Helper for safe DB updates
    const safeUpdateBooking = async (bId: string, fields: Record<string, any>) => {
      const payload = { ...fields }
      // Map refund_transaction_id to refund_id column which exists in DB
      if (payload.refund_transaction_id && !payload.refund_id) {
        payload.refund_id = payload.refund_transaction_id
      }
      const { error } = await supabaseAdmin.from('bookings').update(payload).eq('id', bId)
      if (error && error.message?.includes('refund_transaction_id')) {
        delete payload.refund_transaction_id
        await supabaseAdmin.from('bookings').update(payload).eq('id', bId)
      }
    }

    // Format time & date for notifications
    const rawTime = booking.booking_time || ''
    let formattedTime = rawTime
    if (rawTime && !rawTime.includes('AM') && !rawTime.includes('PM')) {
      const [h, m] = rawTime.split(':').map(Number)
      if (!isNaN(h) && !isNaN(m)) {
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
        const ampm = h >= 12 ? 'PM' : 'AM'
        formattedTime = `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`
      }
    }
    let formattedDate = booking.booking_date || ''
    try {
      formattedDate = new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    } catch (_) {}

    const salonName = booking.salons?.name || 'the salon'
    const salonOwnerId = booking.salons?.owner_id

    // ─── ACTIONS ────────────────────────────────────────────────────────────

    // Action: customer_choose_refund
    if (action === 'customer_choose_refund') {
      const isPaid = booking.payment_status === 'paid'
      const refundAmount = booking.total_amount

      if (isPaid) {
        const rzpRes = await processRazorpayRefund(refundAmount, 'Customer chose refund after salon cancellation')
        const newRefundStatus = rzpRes.ok ? 'processing' : 'failed'

        await safeUpdateBooking(booking_id, {
          refund_status: newRefundStatus,
          refund_amount: refundAmount,
          refund_id: rzpRes.ok ? rzpRes.refundId : null,
          refund_transaction_id: rzpRes.ok ? rzpRes.refundId : null,
          updated_at: new Date().toISOString()
        })

        return new Response(
          JSON.stringify({ success: true, refund_amount: refundAmount, refund_status: newRefundStatus }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      await safeUpdateBooking(booking_id, {
        refund_status: 'failed',
        updated_at: new Date().toISOString()
      })

      return new Response(
        JSON.stringify({ success: true, refund_amount: 0, refund_status: 'failed', message: 'No online payment found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Action: customer_choose_reschedule
    if (action === 'customer_choose_reschedule') {
      await supabaseAdmin.from('bookings').update({
        refund_status: 'rescheduled',
        updated_at: new Date().toISOString()
      }).eq('id', booking_id)

      return new Response(
        JSON.stringify({ success: true, refund_status: 'rescheduled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Action: admin_manual_refund
    if (action === 'admin_manual_refund') {
      const isOwnerOrAdminCancelled =
        booking.cancelled_by === 'owner' ||
        booking.cancelled_by === 'emergency' ||
        booking.cancelled_by === 'admin'

      const subtotal = Number(booking.subtotal ?? 0)
      const offerDiscount = Number(booking.offer_discount ?? 0)
      const platformFee = Number(booking.platform_fee ?? 25)
      const serviceAmount = subtotal - offerDiscount
      const refundAmount = isOwnerOrAdminCancelled
        ? booking.total_amount
        : Math.max(0, Math.min(serviceAmount, booking.total_amount - platformFee))

      const rzpRes = await processRazorpayRefund(refundAmount, 'Admin manual refund')
      const newRefundStatus = rzpRes.ok ? 'processing' : 'failed'

      await safeUpdateBooking(booking_id, {
        refund_status: newRefundStatus,
        refund_amount: refundAmount,
        refund_id: rzpRes.ok ? rzpRes.refundId : null,
        refund_transaction_id: rzpRes.ok ? rzpRes.refundId : null,
        updated_at: new Date().toISOString()
      })

      return new Response(
        JSON.stringify({ success: true, refund_amount: refundAmount, refund_status: newRefundStatus }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ─── STANDARD CANCELLATION ──────────────────────────────────────────────

    if (booking.status === 'cancelled') {
      return new Response(JSON.stringify({ success: true, message: 'Already cancelled' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Determine who cancelled
    // cancelled_by: 'owner' | 'emergency' | 'customer' | 'admin' | null (defaults to customer)
    const cancelledBy = cancelled_by || 'customer'
    const isSalonCancellation = cancelledBy === 'owner' || cancelledBy === 'emergency' || cancelledBy === 'admin'

    // ─── SALON/EMERGENCY CANCELLATION ───────────────────────────────────────
    // When the salon (owner or emergency) cancels, we do NOT process a refund yet.
    // Instead, we set refund_status = 'pending_choice' so the customer can choose
    // between a full refund or a free reschedule.
    if (isSalonCancellation) {
      const { error: updateErr } = await supabaseAdmin
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_by: cancelledBy,
          cancel_reason: cancel_reason || (cancelledBy === 'emergency' ? 'Emergency closure by salon' : 'Cancelled by salon owner'),
          refund_status: 'pending_choice',
          updated_at: new Date().toISOString()
        })
        .eq('id', booking_id)

      if (updateErr) throw updateErr

      // Notify customer with refund/reschedule offer
      const isPaid = booking.payment_status === 'paid'
      const notifMessage = cancelledBy === 'emergency'
        ? `🚨 Emergency! ${salonName} has had to close. Your booking on ${formattedDate} at ${formattedTime} has been cancelled. ${isPaid ? 'You can choose a full refund or reschedule your slot for free.' : 'Contact the salon for more information.'}`
        : `Your booking at ${salonName} on ${formattedDate} at ${formattedTime} was cancelled by the salon. ${isPaid ? 'You can choose a full refund or reschedule your slot for free.' : ''}`

      await supabaseAdmin.from('notifications').insert({
        target_type: 'individual',
        target_id: booking.customer_id,
        title: cancelledBy === 'emergency' ? '🚨 Emergency Closure' : '❌ Booking Cancelled by Salon',
        message: notifMessage,
        notif_type: 'booking',
        is_read: false,
        sent_by_admin: null,
      })

      return new Response(
        JSON.stringify({ success: true, refund_status: isPaid ? 'pending_choice' : null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ─── CUSTOMER CANCELLATION ──────────────────────────────────────────────
    let payment_status = booking.payment_status
    let refund_amount = 0
    let refund_status = null
    let refund_id = null

    const subtotal = Number(booking.subtotal ?? 0)
    const offerDiscount = Number(booking.offer_discount ?? 0)
    const platformFee = Number(booking.platform_fee ?? 25)
    const serviceAmount = subtotal - offerDiscount
    const baseRefundAmount = Math.max(0, Math.min(serviceAmount, booking.total_amount - platformFee))

    if (booking.payment_status === 'paid') {
      refund_amount = baseRefundAmount
      const rzpRes = await processRazorpayRefund(refund_amount, cancel_reason || 'Cancelled by customer')
      if (rzpRes.ok) {
        refund_status = 'processing'
        refund_id = rzpRes.refundId
      } else {
        console.error('Razorpay customer cancellation refund failed:', rzpRes.data)
        refund_status = 'failed'
      }
    }

    // Update booking
    await safeUpdateBooking(booking_id, {
      status: 'cancelled',
      cancelled_by: 'customer',
      cancel_reason: cancel_reason || 'Cancelled by customer',
      payment_status,
      refund_status,
      refund_amount: refund_amount || booking.refund_amount || 0,
      refund_id,
      refund_transaction_id: refund_id,
      updated_at: new Date().toISOString()
    })

    // A. Notify customer
    const message = `Your booking at ${salonName} on ${formattedDate} at ${formattedTime} has been cancelled.`
    await supabaseAdmin.from('notifications').insert({
      target_type: 'individual',
      target_id: booking.customer_id,
      title: '❌ Booking Cancelled',
      message: refund_status === 'processing'
        ? `${message} A refund of ₹${refund_amount} has been initiated via Razorpay and will be credited within 5–7 business days.`
        : message,
      notif_type: 'booking',
      is_read: false,
      sent_by_admin: null,
    })

    // B. Notify salon owner
    if (salonOwnerId) {
      // 1. Fetch customer details
      let customerName = 'A customer'
      if (booking.customer_id) {
        const { data: cust } = await supabaseAdmin
          .from('customers')
          .select('full_name')
          .eq('id', booking.customer_id)
          .maybeSingle()
        if (cust?.full_name) customerName = cust.full_name
      }

      const ownerMessage = `${customerName} has cancelled their booking for ${formattedDate} at ${formattedTime}.${
        cancel_reason ? ` Reason: "${cancel_reason}"` : ''
      }`

      // Create a persistent direct notification
      await supabaseAdmin.from('notifications').insert({
        target_type: 'individual',
        target_id: salonOwnerId,
        title: '❌ Booking Cancelled',
        message: ownerMessage,
        notif_type: 'booking',
        is_read: false,
        sent_by_admin: null,
      })

      // Insert into owner_booking_alerts to trigger the real-time popup on the Owner Panel
      const serviceSummary = (booking.services || []).map((s: any) => s.name).join(", ") || "Service"
      const { error: alertErr } = await supabaseAdmin.from('owner_booking_alerts').insert({
        owner_id: salonOwnerId,
        salon_id: booking.salon_id,
        booking_id: booking.id,
        customer_name: `❌ ${customerName}`,
        service_summary: serviceSummary,
        booking_time: formattedTime || booking.booking_time,
        is_read: false,
      })
      if (alertErr) {
        console.error('owner_booking_alerts cancellation insert error:', alertErr.message)
      }
    }

    return new Response(
      JSON.stringify({ success: true, payment_status, refund_amount, refund_status, platform_fee: booking.platform_fee ?? 25 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err: any) {
    console.error('Cancel Booking Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
