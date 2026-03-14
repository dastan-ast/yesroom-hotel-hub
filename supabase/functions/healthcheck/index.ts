import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServiceCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  response_time_ms: number;
  details?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const checks: ServiceCheck[] = [];

  // 1. Database
  const dbStart = performance.now();
  try {
    const { error } = await supabase.from('hotels').select('id', { count: 'exact', head: true });
    const ms = Math.round(performance.now() - dbStart);
    checks.push({
      name: 'database',
      status: error ? 'error' : ms > 2000 ? 'warning' : 'ok',
      response_time_ms: ms,
      details: error?.message,
    });
  } catch (e) {
    checks.push({
      name: 'database',
      status: 'error',
      response_time_ms: Math.round(performance.now() - dbStart),
      details: e.message,
    });
  }

  // 2. Auth
  const authStart = performance.now();
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') || '' },
    });
    const ms = Math.round(performance.now() - authStart);
    checks.push({
      name: 'auth',
      status: res.ok ? (ms > 2000 ? 'warning' : 'ok') : 'error',
      response_time_ms: ms,
      details: res.ok ? undefined : `HTTP ${res.status}`,
    });
  } catch (e) {
    checks.push({
      name: 'auth',
      status: 'error',
      response_time_ms: Math.round(performance.now() - authStart),
      details: e.message,
    });
  }

  // 3. Storage
  const storageStart = performance.now();
  try {
    const { error } = await supabase.storage.listBuckets();
    const ms = Math.round(performance.now() - storageStart);
    checks.push({
      name: 'storage',
      status: error ? 'error' : ms > 3000 ? 'warning' : 'ok',
      response_time_ms: ms,
      details: error?.message,
    });
  } catch (e) {
    checks.push({
      name: 'storage',
      status: 'error',
      response_time_ms: Math.round(performance.now() - storageStart),
      details: e.message,
    });
  }

  // 4. Edge Functions (self-check)
  checks.push({
    name: 'edge_functions',
    status: 'ok',
    response_time_ms: 0,
    details: 'Self-reporting healthy',
  });

  // Store results
  const rows = checks.map(c => ({
    service_name: c.name,
    status: c.status,
    response_time_ms: c.response_time_ms,
    details: c.details || null,
  }));

  await supabase.from('uptime_checks').insert(rows);

  // Overall status
  const hasError = checks.some(c => c.status === 'error');
  const hasWarning = checks.some(c => c.status === 'warning');
  const overall = hasError ? 'degraded' : hasWarning ? 'warning' : 'healthy';

  return new Response(
    JSON.stringify({
      status: overall,
      timestamp: new Date().toISOString(),
      services: checks,
    }),
    {
      status: hasError ? 503 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
