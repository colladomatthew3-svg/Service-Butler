"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  devQuickLoginEnabled,
  ensureDevQuickLoginUser,
  getDevAuthPassword,
  isAllowedDevQuickLoginEmail
} from "@/lib/auth/dev-quick-login";

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
  if (!devQuickLoginEnabled()) throw new Error("Dev quick login is only available in development");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || !isAllowedDevQuickLoginEmail(email)) throw new Error("Invalid dev quick login email");

  const password = getDevAuthPassword();
  const supabase = await getSupabaseServerClient();

  let { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await ensureDevQuickLoginUser(email);
    const retry = await supabase.auth.signInWithPassword({ email, password });
    error = retry.error;
  }

  if (error) throw new Error(error.message);
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
