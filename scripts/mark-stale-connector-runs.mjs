import { createClient } from "@supabase/supabase-js";

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const staleAfterMinutesRaw = Number(process.env.CONNECTOR_STALE_AFTER_MINUTES || 45);
const staleAfterMinutes = Number.isFinite(staleAfterMinutesRaw) ? Math.max(5, Math.round(staleAfterMinutesRaw)) : 45;

if (!supabaseUrl || !serviceRoleKey) {
  console.log("warn|Skipped stale-run marking because Supabase credentials are missing.");
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data, error } = await supabase.rpc("mark_stale_connector_runs", {
  p_stale_after_minutes: staleAfterMinutes
});

if (error) {
  console.log(`fail|Could not mark stale connector runs: ${error.message}`);
  process.exit(1);
}

const marked = Number(data || 0);
if (!Number.isFinite(marked)) {
  console.log("warn|mark_stale_connector_runs returned a non-numeric result.");
  process.exit(0);
}

if (marked > 0) {
  console.log(`pass|Marked ${marked} connector run(s) stale using a ${staleAfterMinutes}m threshold.`);
} else {
  console.log(`pass|No stale connector runs found using a ${staleAfterMinutes}m threshold.`);
}
