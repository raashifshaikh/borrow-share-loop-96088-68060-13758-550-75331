import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[create-payment] Starting payment creation...');
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );
    
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    console.log('[create-payment] User authenticated:', user?.id);
    if (!user?.email) throw new Error("User not authenticated");

    const { order_id } = await req.json();
    console.log('[create-payment] Order ID:', order_id);

    // Get order details
    console.log('[create-payment] Fetching order details...');
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select(`
        *,
        listings(title)
      `)
      .eq("id", order_id)
      .single();

    if (orderError) {
      console.error('[create-payment] Order fetch error:', orderError);
      throw new Error(`Order not found: ${orderError.message}`);
    }
    if (!order) throw new Error("Order not found");
    console.log('[create-payment] Order found:', order.id, 'Status:', order.status);
    if (order.buyer_id !== user.id) throw new Error("Unauthorized");

    console.log('[create-payment] Initializing Stripe...');
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-11-20.acacia",
    });

    // Check for existing customer
    console.log('[create-payment] Checking for existing customer...');
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId = customers.data[0]?.id;

    if (!customerId) {
      console.log('[create-payment] Creating new customer...');
      const customer = await stripe.customers.create({ email: user.email });
      customerId = customer.id;
    }
    console.log('[create-payment] Customer ID:', customerId);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.final_amount * 100), // Convert to cents
      currency: order.currency || "usd",
      customer: customerId,
      metadata: {
        order_id: order.id,
        listing_title: order.listings?.title || "BorrowPal Order",
      },
    });

    // Update order with payment intent
    await supabaseClient
      .from("orders")
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq("id", order_id);

    // Create checkout session
    console.log('[create-payment] Creating checkout session...');
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: order.currency || "usd",
            product_data: {
              name: order.listings?.title || "BorrowPal Order",
              description: `Order for ${order.quantity} unit(s)`,
            },
            unit_amount: Math.round((order.final_amount / order.quantity) * 100),
          },
          quantity: order.quantity,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/orders/${order_id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/orders/${order_id}?payment=cancelled`,
      payment_intent_data: {
        metadata: {
          order_id: order.id,
        },
      },
    });

    console.log('[create-payment] Checkout session created:', session.id);
    console.log('[create-payment] Checkout URL:', session.url);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Payment error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
