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
    const { amount, salonId, currency = 'INR', bookingId } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch Razorpay credentials from platform_config (preferred) or env vars
    const { data: config } = await supabaseAdmin
      .from('platform_config')
      .select('razorpay_key_id, razorpay_key_secret')
      .maybeSingle()

    const RAZORPAY_KEY_ID = config?.razorpay_key_id || Deno.env.get('RAZORPAY_KEY_ID')
    const RAZORPAY_KEY_SECRET = config?.razorpay_key_secret || Deno.env.get('RAZORPAY_KEY_SECRET')

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return new Response(
        JSON.stringify({ success: false, error: 'Razorpay credentials not configured. Please add Key ID and Key Secret in Admin → Payments.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 2. Fetch the salon to get the linked account ID (for Route/splits)
    const { data: salon } = await supabaseAdmin
      .from('salons')
      .select('razorpay_linked_account_id')
      .eq('id', salonId)
      .single()

    const linkedAccountId = salon?.razorpay_linked_account_id

    // 3. Calculate the platform split (5% platform fee retained by us)
    const platformFeePercentage = 5
    const totalAmountPaise = Math.round(amount * 100)
    const platformFeePaise = Math.round(totalAmountPaise * (platformFeePercentage / 100))
    const ownerSharePaise = totalAmountPaise - platformFeePaise

    const rzpAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)

    // 4. Prepare Razorpay Order payload
    const orderPayload: any = {
      amount: totalAmountPaise,
      currency: currency,
      payment_capture: 1, // Auto-capture payment
      notes: {
        booking_id: bookingId || '',   // Used in webhook for booking lookup
        salon_id: salonId || '',
      }
    }

    // If salon has a linked Razorpay account, add Route Transfer
    if (linkedAccountId) {
      orderPayload.transfers = [
        {
          account: linkedAccountId,
          amount: ownerSharePaise,
          currency: currency,
          notes: {
            reason: 'Salon Service Booking',
            booking_id: bookingId || '',
          },
          on_hold: false
        }
      ]
    }

    // 5. Call Razorpay API to create order
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${rzpAuth}`
      },
      body: JSON.stringify(orderPayload)
    })

    const orderData = await rzpRes.json()

    if (!rzpRes.ok) {
      console.error('[create-razorpay-order] Razorpay error:', orderData)
      throw new Error(orderData.error?.description || 'Failed to create Razorpay order')
    }

    console.log('[create-razorpay-order] Order created:', orderData.id)

    return new Response(
      JSON.stringify({
        success: true,
        orderId: orderData.id,
        keyId: RAZORPAY_KEY_ID,
        amount: totalAmountPaise,
        currency: currency
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err) {
    console.error('[create-razorpay-order] Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
