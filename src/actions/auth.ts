"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  devQuickLoginEnabled,
  ensureDevQuickLoginUser,
  getDevAuthPassword,
  hasDevAuthPassword,
  isAllowedDevQuickLoginEmail
} from "@/lib/auth/dev-quick-login";
import { isDemoMode } from "@/lib/services/review-mode";

export async function signInWithMagicLink(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) throw new Error("Email is required");

  const h = await headers();
  const origin = h.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/pipeline`
    }
  });

  if (error) throw new Error(error.message);
  redirect("/login?sent=1");
}

export async function signInWithDevQuickLogin(formData: FormData) {
  const result = await tryDevQuickLogin(formData);
  if (!result.ok) {
    redirect(`/login?devQuickLogin=${result.reason}`);
  }
  redirect("/dashboard");
}

async function tryDevQuickLogin(formData: FormData) {
  if (!devQuickLoginEnabled()) {
    return { ok: false as const, reason: "DEV_QUICK_LOGIN_DISABLED" as const };
  }

  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || !isAllowedDevQuickLoginEmail(email)) {
    return { ok: false as const, reason: "INVALID_DEV_QUICK_LOGIN_EMAIL" as const };
  }
  if (!hasDevAuthPassword()) {
    if (isDemoMode()) {
      return { ok: true as const };
    }
    return { ok: false as const, reason: "DEV_AUTH_PASSWORD_MISSING" as const };
  }

  const password = getDevAuthPassword();
  const supabase = await getSupabaseServerClient();

  try {
    let { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      await ensureDevQuickLoginUser(email);
      const retry = await supabase.auth.signInWithPassword({ email, password });
      error = retry.error;
    }

    if (error) {
      return { ok: false as const, reason: "AUTH_FAILED" as const, message: error.message };
    }
  } catch (error) {
    return {
      ok: false as const,
      reason: "AUTH_FAILED" as const,
      message: error instanceof Error ? error.message : "Dev quick login failed"
    };
  }

  return { ok: true as const };
}

export async function signOut() {
  if (isDemoMode()) {
    redirect("/login");
  }

  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function startDemoSession() {
  if (!isDemoMode()) {
    redirect("/login");
  }
  redirect("/dashboard");
}
