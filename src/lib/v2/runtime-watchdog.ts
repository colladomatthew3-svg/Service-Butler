import type { SupabaseClient } from "@supabase/supabase-js";

export function resolveStaleAfterMinutes(value: unknown, fallback = 45) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.max(5, Math.round(fallback));
  return Math.max(5, Math.round(parsed));
}

export async function markStaleConnectorRuns({
  supabase,
  staleAfterMinutes
}: {
  supabase: SupabaseClient;
  staleAfterMinutes?: number;
}) {
  const threshold = resolveStaleAfterMinutes(staleAfterMinutes, 45);
  const { data, error } = await supabase.rpc("mark_stale_connector_runs", {
    p_stale_after_minutes: threshold
  });

  if (error) throw new Error(error.message || "Could not mark stale connector runs");
  const marked = Number(data || 0);
  return Number.isFinite(marked) ? marked : 0;
}
