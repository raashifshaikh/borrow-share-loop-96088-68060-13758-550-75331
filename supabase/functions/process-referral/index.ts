import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.id) throw new Error("User not authenticated");

    const { referral_code } = await req.json();

    if (!referral_code) throw new Error("Referral code required");

    // Find the referrer by referral code
    const { data: referrerProfile, error: referrerError } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("referral_code", referral_code)
      .single();

    if (referrerError || !referrerProfile) {
      throw new Error("Invalid referral code");
    }

    // Prevent self-referral
    if (referrerProfile.id === user.id) {
      throw new Error("Cannot refer yourself");
    }

    // Check if referral already exists
    const { data: existingReferral } = await supabaseClient
      .from("referrals")
      .select("id")
      .eq("referred_id", user.id)
      .single();

    if (existingReferral) {
      console.log("Referral already processed for user", user.id);
      return new Response(JSON.stringify({ success: false, message: "Already referred" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Create referral record
    const { error: referralError } = await supabaseClient
      .from("referrals")
      .insert([{
        referrer_id: referrerProfile.id,
        referred_id: user.id,
        referral_code: referral_code,
        status: "completed",
        completed_at: new Date().toISOString(),
        xp_awarded: 100
      }]);

    if (referralError) throw referralError;

    // Award XP to both users (using the award_xp function)
    await supabaseClient.rpc("award_xp", {
      p_user_id: referrerProfile.id,
      p_xp: 100
    });

    await supabaseClient.rpc("award_xp", {
      p_user_id: user.id,
      p_xp: 50
    });

    console.log(`Referral processed: ${referrerProfile.id} -> ${user.id}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Referral processing error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
