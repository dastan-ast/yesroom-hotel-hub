import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  table: string;
  data: Record<string, unknown> | Record<string, unknown>[];
  operation?: "upsert" | "insert" | "update" | "delete";
}

// Maximum allowed payload size (100KB)
const MAX_PAYLOAD_SIZE = 100000;

// Allowed tables for synchronization (whitelist)
const ALLOWED_TABLES = ["hotels", "bookings", "clients", "room_types", "rooms", "service_catalog"];

// Validate sync request data
function validateSyncRequest(table: string, data: unknown): { valid: boolean; error?: string } {
  // Check table is in whitelist
  if (!ALLOWED_TABLES.includes(table)) {
    return { valid: false, error: `Table '${table}' is not allowed for synchronization` };
  }
  
  // Check data size
  const dataStr = JSON.stringify(data);
  if (dataStr.length > MAX_PAYLOAD_SIZE) {
    return { valid: false, error: `Payload too large: ${dataStr.length} bytes (max ${MAX_PAYLOAD_SIZE})` };
  }
  
  // Validate data structure
  if (!data || (typeof data !== 'object')) {
    return { valid: false, error: "Data must be an object or array of objects" };
  }
  
  const dataArray = Array.isArray(data) ? data : [data];
  
  for (const item of dataArray) {
    if (!item || typeof item !== 'object') {
      return { valid: false, error: "Each data item must be an object" };
    }
    
    // Check for required id field with a valid value
    if (!('id' in item) || !item.id) {
      return { valid: false, error: "Each data item must have a valid 'id' field (non-null UUID)" };
    }
  }
  
  return { valid: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller - allow superadmin, owner, or admin
    const authHeader = req.headers.get("Authorization");
    let callerUserId: string | null = null;
    let callerRole: string | null = null;
    let callerHotelId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      callerUserId = user.id;

      // Get user role
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      callerRole = roleData?.role || null;

      // Get user's hotel_id for owners/admins
      if (callerRole === "owner" || callerRole === "admin") {
        const { data: profileData } = await supabaseAdmin
          .from("profiles")
          .select("hotel_id")
          .eq("user_id", user.id)
          .single();
        callerHotelId = profileData?.hotel_id || null;
      }

      // Allow superadmin, owner, or admin
      if (!callerRole || !["superadmin", "owner", "admin"].includes(callerRole)) {
        return new Response(
          JSON.stringify({ success: false, error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // No auth header - deny access
      return new Response(
        JSON.stringify({ success: false, error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get sync settings
    const { data: settings } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "external_supabase")
      .single();

    if (!settings?.value?.sync_enabled || !settings?.value?.url || !settings?.value?.anon_key) {
      return new Response(
        JSON.stringify({ success: false, message: "Sync is disabled or not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { table, data, operation = "upsert" }: SyncRequest = await req.json();

    if (!table || !data) {
      return new Response(
        JSON.stringify({ success: false, error: "Table and data are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the sync request (size limits, table whitelist, data structure)
    const validation = validateSyncRequest(table, data);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if table is in sync list
    const syncTables = settings.value.sync_tables || [];
    if (!syncTables.includes(table)) {
      return new Response(
        JSON.stringify({ success: false, message: `Table ${table} is not configured for sync` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create external Supabase client
    const externalClient = createClient(
      settings.value.url,
      settings.value.anon_key
    );

    // Transform data for external schema
    // External tables use hotel_external_id instead of hotel_id, 
    // room_type_external_id instead of room_type_id, etc.
    const dataArray = Array.isArray(data) ? data : [data];
    const preparedData = dataArray.map((item) => {
      // Some callers may omit `id` (e.g., partial selects) but include `external_id`.
      // The destination schema requires NOT NULL `external_id`, so we derive it from either.
      const sourceId = (item as Record<string, unknown>)?.id ?? (item as Record<string, unknown>)?.external_id;
      if (!sourceId) {
        console.error(`Missing id/external_id for item in table ${table}:`, JSON.stringify(item).slice(0, 200));
        throw new Error(`Missing required 'id' (or 'external_id') field for ${table} sync`);
      }

      const transformed: Record<string, unknown> = {
        external_id: sourceId,
      };

      // Columns to skip entirely (internal or not in external schema)
      // NOTE: We also skip some fields conditionally per-table when the external schema differs.
      // IMPORTANT: local tables may already have an `external_id` column (nullable).
      // We always compute the destination `external_id` from local `id`, so we must never
      // copy the local `external_id` over it (it can be null and would violate NOT NULL).
      const skipColumns = ['id', 'external_id', 'owner_id', 'trial_ends_at', 'settings', 'created_by', 'updated_by'];

      // External projects often have enum mismatches. The most common is bookings.status.
      // Skipping it prevents hard failures (500) while still syncing the rest of the record.
      // On insert, the external DB default will apply; on upsert, missing fields are left untouched.
      if (table === 'bookings') {
        skipColumns.push('status');
      }
      
      // Columns that need FK transformation (original_name -> external_name)
      const fkMappings: Record<string, string> = {
        'hotel_id': 'hotel_external_id',
        'room_type_id': 'room_type_external_id',
        'room_id': 'room_external_id',
        'client_id': 'client_external_id',
        'service_id': 'service_external_id',
        'booking_id': 'booking_external_id',
      };

      // Map fields based on table type
      for (const [key, value] of Object.entries(item)) {
        // Skip internal columns
        if (skipColumns.includes(key)) continue;
        
        // Handle FK transformations (always transform, even if null)
        if (key in fkMappings) {
          transformed[fkMappings[key]] = value;
          continue;
        }
        
        // Copy other columns as-is
        transformed[key] = value;
      }

      return transformed;
    });

    let error;

    // Perform sync operation
    switch (operation) {
      case "insert":
        ({ error } = await externalClient.from(table).insert(preparedData));
        break;
      case "update":
        // Update each record individually by external_id
        for (const item of preparedData) {
          const result = await externalClient
            .from(table)
            .update(item)
            .eq("external_id", item.external_id);
          if (result.error) {
            error = result.error;
            break;
          }
        }
        break;
      case "delete":
        for (const item of preparedData) {
          const result = await externalClient
            .from(table)
            .delete()
            .eq("external_id", item.external_id);
          if (result.error) {
            error = result.error;
            break;
          }
        }
        break;
      case "upsert":
      default:
        ({ error } = await externalClient
          .from(table)
          .upsert(preparedData, { onConflict: "external_id" }));
        break;
    }

    if (error) {
      console.error("Sync error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last sync timestamp
    await supabaseAdmin
      .from("platform_settings")
      .update({ 
        value: { ...settings.value, last_sync_at: new Date().toISOString() },
        updated_at: new Date().toISOString()
      })
      .eq("key", "external_supabase");

    console.log(`Synced ${dataArray.length} record(s) to ${table} (${operation})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: dataArray.length,
        table,
        operation
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
