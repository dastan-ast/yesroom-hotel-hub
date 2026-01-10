import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface BookingRequest {
  source: "telegram" | "whatsapp";
  guest_name: string;
  guest_phone: string;
  check_in_date: string;
  check_out_date: string;
  room_type_id?: string;
  room_type_slug?: string;
  guest_count?: number;
  comment?: string;
  external_id?: string;
  additional_info?: Record<string, unknown>;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}

interface SuccessResponse {
  success: true;
  booking_id: string;
  status: string;
  message: string;
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 100; // max requests per window per API key

// In-memory rate limit store (per isolate instance)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Rate limit check function
function checkRateLimit(apiKeyId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(apiKeyId);
  
  // Clean up expired entries periodically
  if (rateLimitStore.size > 1000) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }
  
  if (!existing || existing.resetAt < now) {
    // New window
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitStore.set(apiKeyId, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt };
  }
  
  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }
  
  existing.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - existing.count, resetAt: existing.resetAt };
}

// Simple hash function for API key verification
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function validateDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

function validatePhone(phone: string): boolean {
  // Basic phone validation - allows various formats
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  return /^\+?\d{10,15}$/.test(cleaned);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
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

    // Initialize Supabase client with service role for bypassing RLS
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

    // Check rate limit after API key validation
    const rateLimit = checkRateLimit(apiKeyRecord.id);
    if (!rateLimit.allowed) {
      console.warn(`Rate limit exceeded for API key: ${apiKeyRecord.id}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Rate limit exceeded. Try again later.", 
          code: "RATE_LIMIT_EXCEEDED" 
        } as ErrorResponse),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "X-RateLimit-Limit": RATE_LIMIT_MAX_REQUESTS.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": Math.ceil(rateLimit.resetAt / 1000).toString(),
            "Retry-After": Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString()
          } 
        }
      );
    }

    // Check hotel status
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

    // Parse and validate request body
    const body: BookingRequest = await req.json();

    // Validate required fields
    if (!body.guest_name || body.guest_name.trim().length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: "Guest name is required (min 2 characters)", code: "INVALID_GUEST_NAME" } as ErrorResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.guest_phone || !validatePhone(body.guest_phone)) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid phone number is required", code: "INVALID_PHONE" } as ErrorResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.check_in_date || !validateDate(body.check_in_date)) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid check-in date is required (YYYY-MM-DD)", code: "INVALID_CHECK_IN" } as ErrorResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.check_out_date || !validateDate(body.check_out_date)) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid check-out date is required (YYYY-MM-DD)", code: "INVALID_CHECK_OUT" } as ErrorResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate dates logic
    const checkIn = new Date(body.check_in_date);
    const checkOut = new Date(body.check_out_date);
    
    if (checkOut <= checkIn) {
      return new Response(
        JSON.stringify({ success: false, error: "Check-out date must be after check-in date", code: "INVALID_DATE_RANGE" } as ErrorResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate source
    if (!["telegram", "whatsapp"].includes(body.source)) {
      return new Response(
        JSON.stringify({ success: false, error: "Source must be 'telegram' or 'whatsapp'", code: "INVALID_SOURCE" } as ErrorResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find room type if specified
    let roomTypeId = body.room_type_id;
    
    if (!roomTypeId && body.room_type_slug) {
      // Try to find room type by name/slug
      const { data: roomType } = await supabase
        .from("room_types")
        .select("id")
        .eq("hotel_id", hotel.id)
        .ilike("name", `%${body.room_type_slug}%`)
        .limit(1)
        .single();
      
      if (roomType) {
        roomTypeId = roomType.id;
      }
    }

    // If still no room type, get the first available one
    if (!roomTypeId) {
      const { data: defaultRoomType } = await supabase
        .from("room_types")
        .select("id")
        .eq("hotel_id", hotel.id)
        .limit(1)
        .single();
      
      if (defaultRoomType) {
        roomTypeId = defaultRoomType.id;
      }
    }

    // Create booking
    const bookingData = {
      hotel_id: hotel.id,
      guest_name: body.guest_name.trim(),
      guest_phone: body.guest_phone.trim(),
      check_in_date: body.check_in_date,
      check_out_date: body.check_out_date,
      room_type_id: roomTypeId,
      guest_count: body.guest_count || 1,
      guest_comment: body.comment || null,
      source: body.source,
      status: "pending",
      external_id: body.external_id || null,
      external_source_data: body.additional_info || {},
    };

    console.log("Creating booking:", JSON.stringify(bookingData));

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert(bookingData)
      .select("id, status")
      .single();

    if (bookingError) {
      console.error("Booking creation error:", bookingError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create booking", code: "BOOKING_FAILED" } as ErrorResponse),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_used_at for API key
    await supabase
      .from("hotel_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKeyRecord.id);

    console.log("Booking created successfully:", booking.id);

    const response: SuccessResponse = {
      success: true,
      booking_id: booking.id,
      status: booking.status,
      message: "Бронирование успешно создано",
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "X-RateLimit-Limit": RATE_LIMIT_MAX_REQUESTS.toString(),
        "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        "X-RateLimit-Reset": Math.ceil(rateLimit.resetAt / 1000).toString()
      },
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error", code: "INTERNAL_ERROR" } as ErrorResponse),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
