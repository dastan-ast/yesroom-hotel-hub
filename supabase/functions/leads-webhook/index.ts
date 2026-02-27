import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface LeadRequest {
  phone: string;
  name?: string;
  source?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "API key required", code: "MISSING_API_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hash API key using PBKDF2
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKey);
    const salt = encoder.encode("hotel-api-key-v1");
    const baseKey = await crypto.subtle.importKey("raw", keyData, "PBKDF2", false, ["deriveBits"]);
    const derivedBits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      baseKey,
      256
    );
    const apiKeyHash = Array.from(new Uint8Array(derivedBits))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: apiKeyRecord, error: apiKeyError } = await supabase
      .from("hotel_api_keys")
      .select("id, hotel_id, is_active")
      .eq("api_key_hash", apiKeyHash)
      .eq("is_active", true)
      .single();

    if (apiKeyError || !apiKeyRecord) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid API key", code: "INVALID_API_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify hotel is active
    const { data: hotel } = await supabase
      .from("hotels")
      .select("id, status, subscription_status")
      .eq("id", apiKeyRecord.hotel_id)
      .single();

    if (!hotel || hotel.status !== "active" || !["trial", "active"].includes(hotel.subscription_status)) {
      return new Response(
        JSON.stringify({ success: false, error: "Hotel is not active", code: "HOTEL_INACTIVE" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: LeadRequest = await req.json();

    // Validate phone
    if (!body.phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone is required", code: "MISSING_PHONE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleaned = body.phone.replace(/[\s\-\(\)]/g, "");
    if (!/^\+?\d{10,15}$/.test(cleaned)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid phone number", code: "INVALID_PHONE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validSources = ["whatsapp", "telegram", "phone", "walk_in", "website", "other"];
    const source = validSources.includes(body.source || "") ? body.source : "whatsapp";

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        hotel_id: hotel.id,
        phone: body.phone.trim(),
        name: body.name?.trim() || null,
        source,
        notes: body.notes?.trim() || null,
        status: "new",
      })
      .select("id, status")
      .single();

    if (leadError) {
      console.error("Lead creation error:", leadError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create lead", code: "LEAD_FAILED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_used_at
    await supabase
      .from("hotel_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKeyRecord.id);

    return new Response(
      JSON.stringify({ success: true, lead_id: lead.id, status: lead.status, message: "Лид успешно создан" }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Leads webhook error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
