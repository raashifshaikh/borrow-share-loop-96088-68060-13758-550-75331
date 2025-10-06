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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! }
      }
    }
  );

  try {
    console.log('[verify-payment] Starting payment verification...');
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    console.log('[verify-payment] User authenticated:', user?.id);
    if (!user?.email) throw new Error("User not authenticated");

    const { session_id, order_id } = await req.json();
    console.log('[verify-payment] Session ID:', session_id, 'Order ID:', order_id);

    if (!session_id) throw new Error("Session ID required");

    console.log('[verify-payment] Initializing Stripe...');
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-11-20.acacia",
    });

    // Verify the session with Stripe
    console.log('[verify-payment] Retrieving Stripe session...');
    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log('[verify-payment] Session payment status:', session.payment_status);

    if (session.payment_status !== "paid") {
      console.error('[verify-payment] Payment not completed. Status:', session.payment_status);
      throw new Error("Payment not completed");
    }

    // Get order to verify ownership
    console.log('[verify-payment] Fetching order...');
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError) {
      console.error('[verify-payment] Order fetch error:', orderError);
      throw new Error(`Order not found: ${orderError.message}`);
    }
    if (!order) throw new Error("Order not found");
    console.log('[verify-payment] Order found:', order.id, 'Current status:', order.status);
    if (order.buyer_id !== user.id) throw new Error("Unauthorized");

    // Fetch related data separately
    const [listingData, buyerData, sellerData] = await Promise.all([
      supabaseClient.from("listings").select("title").eq("id", order.listing_id).single(),
      supabaseClient.from("profiles").select("name").eq("id", order.buyer_id).single(),
      supabaseClient.from("profiles").select("name").eq("id", order.seller_id).single()
    ]);

    const enrichedOrder = {
      ...order,
      listings: listingData.data,
      buyer_profile: buyerData.data,
      seller_profile: sellerData.data
    };

    // Update order status to paid
    console.log('[verify-payment] Updating order status to paid...');
    const { error: updateError } = await supabaseClient
      .from("orders")
      .update({
        status: "paid",
        stripe_payment_intent_id: session.payment_intent as string,
      })
      .eq("id", order_id);

    if (updateError) {
      console.error('[verify-payment] Order update error:', updateError);
      throw updateError;
    }
    console.log('[verify-payment] Order status updated successfully');

    // Award XP for successful transaction
    console.log('[verify-payment] Awarding XP...');
    await supabaseClient.rpc('award_xp', { p_user_id: order.buyer_id, p_xp: 50 });
    await supabaseClient.rpc('award_xp', { p_user_id: order.seller_id, p_xp: 50 });

    console.log(`[verify-payment] Payment verified for order ${order_id}, session ${session_id}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
