import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  devQuickLoginEnabled,
  ensureDevQuickLoginUser,
  getDevAuthPassword,
  isAllowedDevQuickLoginEmail
} from "@/lib/auth/dev-quick-login";

export async function POST(req: NextRequest) {
  if (!devQuickLoginEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as { email?: string };
  const email = String(body.email || "").trim().toLowerCase();

  if (!email || !isAllowedDevQuickLoginEmail(email)) {
    return NextResponse.json({ error: "Invalid dev login email" }, { status: 400 });
  }

  const password = getDevAuthPassword();
  const supabase = await getSupabaseServerClient();

  let { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await ensureDevQuickLoginUser(email);
    const retry = await supabase.auth.signInWithPassword({ email, password });
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, redirectTo: "/dashboard" });
}
