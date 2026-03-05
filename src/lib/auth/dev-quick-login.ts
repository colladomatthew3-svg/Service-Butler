import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const DEV_QUICK_LOGIN_EMAILS = [
  "owner@servicebutler.local",
  "dispatcher@servicebutler.local",
  "tech@servicebutler.local"
] as const;

export function devQuickLoginEnabled() {
  return process.env.NODE_ENV === "development";
}

export function isAllowedDevQuickLoginEmail(email: string) {
  return DEV_QUICK_LOGIN_EMAILS.includes(email as (typeof DEV_QUICK_LOGIN_EMAILS)[number]);
}

export function hasDevAuthPassword(): boolean {
  return typeof process.env.DEV_AUTH_PASSWORD === "string" && process.env.DEV_AUTH_PASSWORD.trim().length > 0;
}

export function getDevAuthPassword() {
  return hasDevAuthPassword() ? String(process.env.DEV_AUTH_PASSWORD) : "";
}

export async function ensureDevQuickLoginUser(email: string) {
  if (!devQuickLoginEnabled()) throw new Error("Dev quick login is disabled");
  if (!isAllowedDevQuickLoginEmail(email)) throw new Error("Email is not allowed for dev quick login");

  const password = getDevAuthPassword();
  const admin = getSupabaseAdminClient();

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error(listError.message);

  const existing = listed.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!existing) {
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (createError) throw new Error(createError.message);
    return;
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
    email_confirm: true,
    password
  });
  if (updateError) throw new Error(updateError.message);
}
