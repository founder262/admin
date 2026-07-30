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

    // 2. Fetch Gateway credentials from platform_config table
    const { data: config } = await supabaseAdmin
      .from('platform_config')
      .select('phonepe_merchant_id, phonepe_client_id, phonepe_client_secret, phonepe_client_version, phonepe_salt_key, phonepe_salt_index, phonepe_env, razorpay_key_id, razorpay_key_secret')
      .maybeSingle()

    const PHONEPE_MERCHANT_ID = config?.phonepe_merchant_id || Deno.env.get('PHONEPE_MERCHANT_ID') || 'PGTESTPAYUAT'
    const PHONEPE_CLIENT_ID = config?.phonepe_client_id || Deno.env.get('PHONEPE_CLIENT_ID') || ''
    const PHONEPE_CLIENT_SECRET = config?.phonepe_client_secret || Deno.env.get('PHONEPE_CLIENT_SECRET') || ''
    const PHONEPE_CLIENT_VERSION = config?.phonepe_client_version || Deno.env.get('PHONEPE_CLIENT_VERSION') || '1'
    const PHONEPE_SALT_KEY = config?.phonepe_salt_key || Deno.env.get('PHONEPE_SALT_KEY') || '099eb0cd-02fc-4e41-88db-1032db451407'
    const PHONEPE_SALT_INDEX = config?.phonepe_salt_index || Deno.env.get('PHONEPE_SALT_INDEX') || '1'
    const PHONEPE_ENV = (config?.phonepe_env || Deno.env.get('PHONEPE_ENV') || 'UAT').toUpperCase()

    const RAZORPAY_KEY_ID = config?.razorpay_key_id || Deno.env.get('RAZORPAY_KEY_ID')
    const RAZORPAY_KEY_SECRET = config?.razorpay_key_secret || Deno.env.get('RAZORPAY_KEY_SECRET')

    // Helper for PhonePe Refund API
    const processPhonePeRefund = async (amount: number, reason: string) => {
      const refundTxnId = `REFUND_${booking.id.replace(/-/g, '').slice(0, 8)}_${Date.now()}`
      const baseUrl = PHONEPE_ENV === 'PROD'
        ? 'https://api.phonepe.com/apis/hermes/pg/v1/refund'
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/refund'

      const payloadObj = {
        merchantId: PHONEPE_MERCHANT_ID,
        merchantTransactionId: refundTxnId,
        originalTransactionId: booking.phonepe_merchant_transaction_id || booking.phonepe_transaction_id,
        amount: Math.round(amount * 100),
        callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/verify-phonepe-payment`,
      }

      if (PHONEPE_CLIENT_ID) {
        payloadObj.clientId = PHONEPE_CLIENT_ID
        payloadObj.clientVersion = Number(PHONEPE_CLIENT_VERSION) || 1
      }

      const base64Payload = btoa(JSON.stringify(payloadObj))
      const secret = PHONEPE_CLIENT_SECRET || PHONEPE_SALT_KEY
      const stringToSign = base64Payload + '/pg/v1/refund' + secret
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stringToSign))
      const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
      const xVerify = `${hash}###${PHONEPE_SALT_INDEX}`

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
      }

      if (PHONEPE_CLIENT_ID) {
        headers['X-CLIENT-ID'] = PHONEPE_CLIENT_ID
        headers['X-CLIENT-VERSION'] = String(PHONEPE_CLIENT_VERSION)
      }

      const refundRes = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ request: base64Payload })
      })

      const refundData = await refundRes.json()
      return { ok: refundRes.ok && refundData.success, data: refundData }
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

      if (isPaid && (booking.phonepe_merchant_transaction_id || booking.payment_method === 'phonepe')) {
        const phonepeRes = await processPhonePeRefund(refundAmount, 'Customer chose refund after salon cancellation')
        const newRefundStatus = phonepeRes.ok ? 'refunded' : 'failed'
        const newPaymentStatus = phonepeRes.ok ? 'refunded' : booking.payment_status

        await supabaseAdmin.from('bookings').update({
          refund_status: newRefundStatus,
          refund_amount: phonepeRes.ok ? refundAmount : (booking.refund_amount || 0),
          payment_status: newPaymentStatus,
          updated_at: new Date().toISOString()
        }).eq('id', booking_id)

        return new Response(
          JSON.stringify({ success: true, refund_amount: refundAmount, refund_status: newRefundStatus }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      } else if (isPaid && booking.payment_method === 'razorpay' && booking.razorpay_payment_id) {
        if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
          const rzpAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
          const refundRes = await fetch(`https://api.razorpay.com/v1/payments/${booking.razorpay_payment_id}/refund`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Basic ${rzpAuth}`
            },
            body: JSON.stringify({
              amount: refundAmount * 100,
              notes: { reason: 'Customer chose refund after salon cancellation' }
            })
          })

          const refundData = await refundRes.json()
          const newRefundStatus = refundRes.ok ? 'refunded' : 'failed'
          const newPaymentStatus = refundRes.ok ? 'refunded' : booking.payment_status

          await supabaseAdmin.from('bookings').update({
            refund_status: newRefundStatus,
            refund_amount: refundRes.ok ? refundAmount : (booking.refund_amount || 0),
            payment_status: newPaymentStatus,
            updated_at: new Date().toISOString()
          }).eq('id', booking_id)

          return new Response(
            JSON.stringify({ success: true, refund_amount: refundAmount, refund_status: newRefundStatus }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )
        }
      }

      await supabaseAdmin.from('bookings').update({
        refund_status: 'failed',
        updated_at: new Date().toISOString()
      }).eq('id', booking_id)

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

      if (booking.phonepe_merchant_transaction_id || booking.payment_method === 'phonepe') {
        const phonepeRes = await processPhonePeRefund(refundAmount, 'Admin manual refund')
        const newRefundStatus = phonepeRes.ok ? 'refunded' : 'failed'
        const newPaymentStatus = phonepeRes.ok ? 'refunded' : booking.payment_status

        await supabaseAdmin.from('bookings').update({
          refund_status: newRefundStatus,
          refund_amount: phonepeRes.ok ? refundAmount : (booking.refund_amount || 0),
          payment_status: newPaymentStatus,
          updated_at: new Date().toISOString()
        }).eq('id', booking_id)

        return new Response(
          JSON.stringify({ success: true, refund_amount: refundAmount, refund_status: newRefundStatus }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      } else if (booking.razorpay_payment_id && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
        const rzpAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
        const refundRes = await fetch(`https://api.razorpay.com/v1/payments/${booking.razorpay_payment_id}/refund`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${rzpAuth}`
          },
          body: JSON.stringify({
            amount: refundAmount * 100,
            notes: { reason: 'Admin manual refund - ' + (booking.cancelled_by || 'unknown') }
          })
        })

        const refundData = await refundRes.json()
        const newRefundStatus = refundRes.ok ? 'refunded' : 'failed'
        const newPaymentStatus = refundRes.ok ? 'refunded' : booking.payment_status

        await supabaseAdmin.from('bookings').update({
          refund_status: newRefundStatus,
          refund_amount: refundRes.ok ? refundAmount : (booking.refund_amount || 0),
          payment_status: newPaymentStatus,
          updated_at: new Date().toISOString()
        }).eq('id', booking_id)

        return new Response(
          JSON.stringify({ success: true, refund_amount: refundAmount, refund_status: newRefundStatus }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      await supabaseAdmin.from('bookings').update({
        refund_status: 'failed',
        updated_at: new Date().toISOString()
      }).eq('id', booking_id)

      return new Response(
        JSON.stringify({ success: true, refund_amount: 0, refund_status: 'failed', message: 'No payment transaction found for refund' }),
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
      const isPaid = booking.payment_status === 'paid' && booking.payment_method === 'razorpay'
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
    // Process refund immediately (service amount minus platform fee).
    let payment_status = booking.payment_status
    let refund_amount = 0
    let refund_status = null

    if (booking.payment_method === 'razorpay' && booking.razorpay_payment_id && booking.payment_status === 'paid') {
      if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
        const rzpAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)

        const subtotal = Number(booking.subtotal ?? 0)
        const offerDiscount = Number(booking.offer_discount ?? 0)
        const platformFee = Number(booking.platform_fee ?? 25)
        const serviceAmount = subtotal - offerDiscount
        refund_amount = Math.max(0, Math.min(serviceAmount, booking.total_amount - platformFee))

        const refundRes = await fetch(`https://api.razorpay.com/v1/payments/${booking.razorpay_payment_id}/refund`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${rzpAuth}`
          },
          body: JSON.stringify({
            amount: refund_amount * 100,
            notes: { reason: cancel_reason || 'Cancelled by customer' }
          })
        })

        const refundData = await refundRes.json()
        if (refundRes.ok) {
          payment_status = 'refunded'
          refund_status = 'refunded'
        } else {
          console.error("Razorpay refund failed:", refundData)
          refund_status = 'processing' // retry-able
        }
      }
    }

    // Update booking
    const { error: updateErr } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_by: 'customer',
        cancel_reason: cancel_reason || 'Cancelled by customer',
        payment_status,
        refund_status,
        refund_amount: refund_amount || booking.refund_amount || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', booking_id)

    if (updateErr) throw updateErr

    // A. Notify customer
    const message = `Your booking at ${salonName} on ${formattedDate} at ${formattedTime} has been cancelled.`
    await supabaseAdmin.from('notifications').insert({
      target_type: 'individual',
      target_id: booking.customer_id,
      title: '❌ Booking Cancelled',
      message: payment_status === 'refunded'
        ? `${message} A refund of ₹${refund_amount} has been initiated.`
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

