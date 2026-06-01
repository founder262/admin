import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as crypto from 'https://deno.land/std@0.177.0/node/crypto.ts'

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature')

    if (!signature) {
      return new Response('No signature', { status: 400 })
    }

    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
    if (!secret) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured')
      return new Response('Server configuration error', { status: 500 })
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')

    if (expectedSignature !== signature) {
      return new Response('Invalid signature', { status: 400 })
    }

    const payload = JSON.parse(rawBody)

    if (payload.event === 'payment.captured') {
      const payment = payload.payload.payment.entity
      const bookingId = payment.notes?.bookingId

      if (bookingId) {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Check current status
        const { data: booking } = await supabaseAdmin
          .from('bookings')
          .select('id, status, payment_status')
          .eq('id', bookingId)
          .single()

        if (booking && booking.status === 'pending') {
          // Confirm booking
          await supabaseAdmin
            .from('bookings')
            .update({
              status: 'confirmed',
              payment_status: 'paid',
              razorpay_payment_id: payment.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', bookingId)

          console.log(`Booking ${bookingId} confirmed via Webhook`)
        }
      }
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Webhook handling failed', { status: 500 })
  }
})

