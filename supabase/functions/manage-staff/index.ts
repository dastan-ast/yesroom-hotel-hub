import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateStaffRequest {
  action: 'create' | 'update' | 'delete';
  hotelId: string;
  email: string;
  password?: string;
  fullName: string;
  permissions: string[];
  userId?: string; // for update/delete
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the request is from an authenticated owner
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is owner or superadmin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (!roleData || !['owner', 'superadmin'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CreateStaffRequest = await req.json();
    const { action, hotelId, email, password, fullName, permissions, userId } = body;

    // Verify hotel ownership (skip for superadmin)
    if (roleData.role === 'owner') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('hotel_id')
        .eq('user_id', requestingUser.id)
        .single();

      if (profile?.hotel_id !== hotelId) {
        return new Response(
          JSON.stringify({ error: "You can only manage staff for your own hotel" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (action === 'create') {
      if (!email || !password || !fullName) {
        return new Response(
          JSON.stringify({ error: "Email, password and full name are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create user with admin API
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createError) {
        console.error("Create user error:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newUserId = newUser.user.id;

      // Create or update profile (upsert to handle existing users)
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          user_id: newUserId,
          full_name: fullName,
          hotel_id: hotelId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (profileError) {
        console.error("Profile error:", profileError);
        // Cleanup: delete the created user
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        return new Response(
          JSON.stringify({ error: "Failed to create profile: " + profileError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Assign admin role (upsert to handle existing roles)
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert({
          user_id: newUserId,
          role: 'admin',
        }, { onConflict: 'user_id' });

      if (roleError) {
        console.error("Role error:", roleError);
      }

      // Create or update permissions
      const { error: permError } = await supabaseAdmin
        .from('staff_permissions')
        .upsert({
          user_id: newUserId,
          hotel_id: hotelId,
          permissions,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,hotel_id' });

      if (permError) {
        console.error("Permissions error:", permError);
      }

      return new Response(
        JSON.stringify({ success: true, userId: newUserId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'update') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "User ID is required for update" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update user metadata
      const updateData: any = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;
      if (fullName) updateData.user_metadata = { full_name: fullName };

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Update profile
      if (fullName) {
        await supabaseAdmin
          .from('profiles')
          .update({ full_name: fullName })
          .eq('user_id', userId);
      }

      // Update permissions
      if (permissions) {
        await supabaseAdmin
          .from('staff_permissions')
          .upsert({
            user_id: userId,
            hotel_id: hotelId,
            permissions,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,hotel_id' });
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'delete') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "User ID is required for delete" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Remove permissions first
      await supabaseAdmin
        .from('staff_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('hotel_id', hotelId);

      // Remove from hotel
      await supabaseAdmin
        .from('profiles')
        .update({ hotel_id: null })
        .eq('user_id', userId);

      // Change role to guest
      await supabaseAdmin
        .from('user_roles')
        .update({ role: 'guest' })
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
