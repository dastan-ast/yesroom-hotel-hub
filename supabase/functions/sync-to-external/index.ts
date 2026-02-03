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

    // Optional: Verify caller (can be called internally or by superadmin)
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check superadmin role
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleData?.role !== "superadmin") {
        return new Response(
          JSON.stringify({ success: false, error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    // Prepare data with external_id
    const dataArray = Array.isArray(data) ? data : [data];
    const preparedData = dataArray.map(item => ({
      ...item,
      external_id: item.id, // Map local id to external_id
    }));

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
