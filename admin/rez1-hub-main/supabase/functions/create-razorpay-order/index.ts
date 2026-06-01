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
    const { amount, salonId, currency = 'INR' } = await req.json()

    // 1. Fetch the salon to get the linked account ID
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const { data: salon } = await supabaseAdmin
      .from('salons')
      .select('razorpay_linked_account_id')
      .eq('id', salonId)
      .single()

    const linkedAccountId = salon?.razorpay_linked_account_id

    // 2. Calculate the Split (Example: 5% Platform Fee)
    const platformFeePercentage = 5; 
    const totalAmountPaise = Math.round(amount * 100);
    const platformFeePaise = Math.round(totalAmountPaise * (platformFeePercentage / 100));
    const ownerSharePaise = totalAmountPaise - platformFeePaise;

    // 3. Prepare Razorpay Order Payload
    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');
    const rzpAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    const orderPayload: any = {
      amount: totalAmountPaise,
      currency: currency,
      payment_capture: 1, // Auto-capture payment
    }

    // IMPORTANT: If the owner has a linked account, add the Route Transfer
    if (linkedAccountId) {
      orderPayload.transfers = [
        {
          account: linkedAccountId,
          amount: ownerSharePaise,
          currency: currency,
          notes: {
            reason: "Salon Service Booking"
          },
          on_hold: false
        }
      ]
    }

    // 4. Call Razorpay API to create order
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${rzpAuth}`
      },
      body: JSON.stringify(orderPayload)
    });

    const orderData = await rzpRes.json();

    if (!rzpRes.ok) {
      throw new Error(orderData.error?.description || "Failed to create Razorpay order");
    }

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
    console.error('Create Razorpay Order Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

