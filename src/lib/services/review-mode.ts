import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const FALLBACK_ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const FALLBACK_USER_ID = "00000000-0000-0000-0000-000000000001";

export function isReviewMode(): boolean {
  return process.env.NODE_ENV === "development" && process.env.REVIEW_MODE === "on";
}

export async function resolveReviewAccountId(): Promise<string> {
  if (!isReviewMode()) return FALLBACK_ACCOUNT_ID;

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
