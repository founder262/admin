// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Verify Razorpay webhook signature using Web Crypto (HMAC-SHA256) */
async function verifyWebhookSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  try {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
    const hex = Array.from(new Uint8Array(sigBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return hex === signature
  } catch (err) {
    console.error('[razorpay-webhook] Signature verification error:', err)
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature')

    if (!signature) {
      return new Response('No signature', { status: 400 })
    }

    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
    if (!secret) {
      console.error('[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET not configured')
      return new Response('Server configuration error', { status: 500 })
    }

    // Verify signature
    const isValid = await verifyWebhookSignature(rawBody, signature, secret)
    if (!isValid) {
      console.error('[razorpay-webhook] Invalid signature')
      return new Response('Invalid signature', { status: 400 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = JSON.parse(rawBody)
    console.log('[razorpay-webhook] Event:', payload.event)

    // ── payment.captured ──────────────────────────────────────────────────
    if (payload.event === 'payment.captured') {
      const payment = payload.payload.payment.entity
      const bookingId = payment.notes?.booking_id || payment.notes?.bookingId

      if (bookingId) {
        const { data: booking } = await supabaseAdmin
          .from('bookings')
          .select('id, status, payment_status')
          .eq('id', bookingId)
          .single()

        if (booking && booking.payment_status !== 'paid') {
          await supabaseAdmin
            .from('bookings')
            .update({
              status: 'upcoming',
              payment_status: 'paid',
              razorpay_payment_id: payment.id,
              razorpay_order_id: payment.order_id,
              updated_at: new Date().toISOString()
            })
            .eq('id', bookingId)

          console.log(`[razorpay-webhook] Booking ${bookingId} confirmed via webhook`)
        }
      }
    }

    // ── payment.failed ────────────────────────────────────────────────────
    if (payload.event === 'payment.failed') {
      const payment = payload.payload.payment.entity
      const bookingId = payment.notes?.booking_id || payment.notes?.bookingId

      if (bookingId) {
        await supabaseAdmin
          .from('bookings')
          .update({
            payment_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId)

        console.log(`[razorpay-webhook] Booking ${bookingId} payment failed`)
      }
    }

    // ── refund.processed ──────────────────────────────────────────────────
    if (payload.event === 'refund.processed' || payload.event === 'refund.speed_changed') {
      const refund = payload.payload.refund?.entity
      if (refund) {
        const refundId = refund.id
        const paymentId = refund.payment_id

        // Find booking by razorpay_payment_id
        const { data: booking } = await supabaseAdmin
          .from('bookings')
          .select('id, refund_status')
          .eq('razorpay_payment_id', paymentId)
          .maybeSingle()

        if (booking && booking.refund_status !== 'refunded') {
          await supabaseAdmin
            .from('bookings')
            .update({
              refund_status: 'refunded',
              refund_id: refundId,
              updated_at: new Date().toISOString()
            })
            .eq('id', booking.id)

          console.log(`[razorpay-webhook] Refund confirmed for booking ${booking.id}`)
        }
      }
    }

    // ── order.paid ────────────────────────────────────────────────────────
    if (payload.event === 'order.paid') {
      const order = payload.payload.order?.entity
      const payment = payload.payload.payment?.entity
      const bookingId = order?.notes?.booking_id || order?.notes?.bookingId

      if (bookingId && payment) {
        const { data: booking } = await supabaseAdmin
          .from('bookings')
          .select('id, payment_status')
          .eq('id', bookingId)
          .single()

        if (booking && booking.payment_status !== 'paid') {
          await supabaseAdmin
            .from('bookings')
            .update({
              status: 'upcoming',
              payment_status: 'paid',
              razorpay_payment_id: payment.id,
              razorpay_order_id: order.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', bookingId)

          console.log(`[razorpay-webhook] Booking ${bookingId} confirmed via order.paid`)
        }
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders })

  } catch (error) {
    console.error('[razorpay-webhook] Error:', error)
    return new Response('Webhook handling failed', { status: 500 })
  }
})
