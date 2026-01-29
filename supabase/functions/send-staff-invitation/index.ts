import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InvitationRequest {
  email: string;
  hotelName: string;
  inviteUrl: string;
  invitedByName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, hotelName, inviteUrl, invitedByName }: InvitationRequest = await req.json();

    // Validate required fields
    if (!email || !hotelName || !inviteUrl) {
      throw new Error("Missing required fields: email, hotelName, or inviteUrl");
    }

    console.log(`Sending invitation to ${email} for hotel ${hotelName}`);

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured, skipping email send");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">YesRoom</h1>
          <p style="color: #666; margin-top: 5px;">Система управления отелем</p>
        </div>
        
        <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #1e293b;">Здравствуйте!</h2>
          
          <p><strong>${invitedByName}</strong> приглашает вас стать администратором отеля <strong>"${hotelName}"</strong> в системе управления YesRoom.</p>
          
          <p>Чтобы принять приглашение и получить доступ к панели управления, нажмите на кнопку ниже:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Принять приглашение
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">Ссылка действительна 7 дней.</p>
        </div>
        
        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>Если вы не ожидали это письмо, просто проигнорируйте его.</p>
          <p>© ${new Date().getFullYear()} YesRoom. Все права защищены.</p>
        </div>
      </body>
      </html>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "YesRoom <noreply@yesroom.kz>",
        to: [email],
        subject: `Приглашение в отель "${hotelName}" — YesRoom`,
        html: emailHtml,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", result);
      throw new Error(result.message || "Failed to send email");
    }

    console.log("Invitation email sent successfully:", result);

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-staff-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
