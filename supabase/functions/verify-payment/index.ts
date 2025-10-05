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
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { session_id, order_id } = await req.json();

    if (!session_id) throw new Error("Session ID required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-11-20.acacia",
    });

    // Verify the session with Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    // Get order to verify ownership
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) throw new Error("Order not found");
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
    const { error: updateError } = await supabaseClient
      .from("orders")
      .update({
        status: "paid",
        stripe_payment_intent_id: session.payment_intent,
      })
      .eq("id", order_id);

    if (updateError) throw updateError;

    // Award XP for successful transaction
    await supabaseClient.rpc('award_xp', { p_user_id: order.buyer_id, p_xp: 50 });
    await supabaseClient.rpc('award_xp', { p_user_id: order.seller_id, p_xp: 50 });

    console.log(`Payment verified for order ${order_id}, session ${session_id}`);

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
