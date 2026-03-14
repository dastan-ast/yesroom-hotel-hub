import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Call healthcheck endpoint
  let healthData: any;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/healthcheck`, {
      headers: {
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
    });
    healthData = await res.json();
  } catch (e) {
    healthData = {
      status: 'degraded',
      services: [{ name: 'healthcheck', status: 'error', details: e.message }],
    };
  }

  // 2. Load alert config
  const { data: config } = await supabase
    .from('alert_config')
    .select('*')
    .eq('id', 1)
    .single();

  if (!config?.is_enabled || !config?.telegram_chat_id) {
    return new Response(JSON.stringify({ ok: true, alerts_enabled: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 3. Get previous check status for recovery detection
  const serviceNames = (healthData.services || []).map((s: any) => s.name);
  const previousStatuses: Record<string, string> = {};

  for (const name of serviceNames) {
    const { data: prev } = await supabase
      .from('uptime_checks')
      .select('status')
      .eq('service_name', name)
      .order('created_at', { ascending: false })
      .range(1, 1); // skip the one just inserted by healthcheck

    if (prev && prev.length > 0) {
      previousStatuses[name] = prev[0].status;
    }
  }

  // 4. Determine which alerts to send
  const alerts: { service: string; type: string; message: string }[] = [];
  const serviceLabels: Record<string, string> = {
    database: '🗄 База данных',
    auth: '🔐 Аутентификация',
    storage: '📦 Хранилище',
    edge_functions: '⚡ Edge Functions',
  };

  for (const service of healthData.services || []) {
    const prevStatus = previousStatuses[service.name];
    const label = serviceLabels[service.name] || service.name;

    if (service.status === 'error' && config.alert_on_error) {
      alerts.push({
        service: service.name,
        type: 'error',
        message: `🔴 СБОЙ: ${label}\n⏱ Время отклика: ${service.response_time_ms}ms\n📝 ${service.details || 'Сервис недоступен'}`,
      });
    } else if (service.status === 'warning' && config.alert_on_warning) {
      alerts.push({
        service: service.name,
        type: 'warning',
        message: `🟡 ПРЕДУПРЕЖДЕНИЕ: ${label}\n⏱ Время отклика: ${service.response_time_ms}ms`,
      });
    } else if (
      service.status === 'ok' &&
      prevStatus &&
      prevStatus !== 'ok' &&
      config.alert_on_recovery
    ) {
      alerts.push({
        service: service.name,
        type: 'recovery',
        message: `🟢 ВОССТАНОВЛЕН: ${label}\n⏱ Время отклика: ${service.response_time_ms}ms`,
      });
    }
  }

  // 5. Send Telegram alerts
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  let sentCount = 0;

  if (botToken && alerts.length > 0) {
    const header = `📊 YesRoom Мониторинг\n🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}\n${'─'.repeat(28)}`;
    const body = alerts.map(a => a.message).join('\n\n');
    const fullMessage = `${header}\n\n${body}`;

    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.telegram_chat_id,
          text: fullMessage,
          parse_mode: 'HTML',
        }),
      });

      if (res.ok) {
        sentCount = alerts.length;

        // Update last_alert_at
        await supabase
          .from('alert_config')
          .update({ last_alert_at: new Date().toISOString() })
          .eq('id', 1);
      }
    } catch (e) {
      console.error('Telegram send failed:', e);
    }

    // 6. Log alerts
    if (alerts.length > 0) {
      await supabase.from('alert_history').insert(
        alerts.map(a => ({
          service_name: a.service,
          alert_type: a.type,
          message: a.message,
        }))
      );
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      health_status: healthData.status,
      alerts_sent: sentCount,
      alerts_total: alerts.length,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
