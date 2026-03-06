import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const FALLBACK_ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const FALLBACK_USER_ID = "00000000-0000-0000-0000-000000000001";

function flagEnabled(value: string | undefined) {
  return typeof value === "string" && ["1", "true", "on", "yes"].includes(value.toLowerCase());
}

export function isReviewMode(): boolean {
  return process.env.NODE_ENV === "development" && flagEnabled(process.env.REVIEW_MODE);
}

export function isDemoMode(): boolean {
  return process.env.NODE_ENV === "development" && flagEnabled(process.env.DEMO_MODE);
}

export function isLocalBypassMode(): boolean {
  return isReviewMode() || isDemoMode();
}

export async function resolveReviewAccountId(): Promise<string> {
  if (!isLocalBypassMode()) return FALLBACK_ACCOUNT_ID;
  if (isDemoMode()) return FALLBACK_ACCOUNT_ID;

  try {
    const admin = getSupabaseAdminClient();
    const { data } = await admin.from("accounts").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
    return (data?.id as string) || FALLBACK_ACCOUNT_ID;
  } catch {
    return FALLBACK_ACCOUNT_ID;
  }
}

export function getReviewUserId() {
  return FALLBACK_USER_ID;
}

export function getReviewEmail() {
  return "owner@servicebutler.local";
}
