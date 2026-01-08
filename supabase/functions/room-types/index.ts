import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface RoomType {
  id: string;
  name: string;
  description: string | null;
  price_per_night: number;
  capacity: number;
  amenities: string[] | null;
  image_url: string | null;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}

interface SuccessResponse {
  success: true;
  hotel_name: string;
  room_types: RoomType[];
}

// Hash function for API key verification
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" } as ErrorResponse),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get API key from header
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "API key required", code: "MISSING_API_KEY" } as ErrorResponse),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hash the API key and find matching record
    const apiKeyHash = await hashApiKey(apiKey);
    
    const { data: apiKeyRecord, error: apiKeyError } = await supabase
      .from("hotel_api_keys")
      .select("id, hotel_id, is_active")
      .eq("api_key_hash", apiKeyHash)
      .eq("is_active", true)
      .single();

    if (apiKeyError || !apiKeyRecord) {
      console.log("API key lookup failed:", apiKeyError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid API key", code: "INVALID_API_KEY" } as ErrorResponse),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get hotel info
    const { data: hotel, error: hotelError } = await supabase
      .from("hotels")
      .select("id, name, status, subscription_status")
      .eq("id", apiKeyRecord.hotel_id)
      .single();

    if (hotelError || !hotel) {
      return new Response(
        JSON.stringify({ success: false, error: "Hotel not found", code: "HOTEL_NOT_FOUND" } as ErrorResponse),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (hotel.status !== "active") {
      return new Response(
        JSON.stringify({ success: false, error: "Hotel is not active", code: "HOTEL_INACTIVE" } as ErrorResponse),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["trial", "active"].includes(hotel.subscription_status)) {
      return new Response(
        JSON.stringify({ success: false, error: "Hotel subscription is not active", code: "SUBSCRIPTION_INACTIVE" } as ErrorResponse),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch room types for this hotel
    const { data: roomTypes, error: roomTypesError } = await supabase
      .from("room_types")
      .select("id, name, description, price_per_night, capacity, amenities, image_url")
      .eq("hotel_id", hotel.id)
      .order("price_per_night", { ascending: true });

    if (roomTypesError) {
      console.error("Room types fetch error:", roomTypesError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch room types", code: "FETCH_FAILED" } as ErrorResponse),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_used_at for API key
    await supabase
      .from("hotel_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKeyRecord.id);

    console.log(`Room types fetched for hotel ${hotel.name}: ${roomTypes?.length || 0} types`);

    const response: SuccessResponse = {
      success: true,
      hotel_name: hotel.name,
      room_types: roomTypes || [],
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Room types API error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error", code: "INTERNAL_ERROR" } as ErrorResponse),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
