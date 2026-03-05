import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";

function isMissingTableError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const code = String(error.code || "");
  const message = String(error.message || "").toLowerCase();
  return code === "PGRST205" || code === "42P01" || message.includes("routing_rules") || message.includes("does not exist");
}

function normalizeCreateMode(value: unknown): "lead" | "job" {
  return String(value || "lead").toLowerCase() === "job" ? "job" : "lead";
}

export async function GET() {
  const { accountId, supabase } = await getCurrentUserContext();

  const { data, error } = await supabase
    .from("routing_rules")
    .select("id,account_id,category,default_assignee,default_create_mode,default_job_value_cents,default_sla_minutes,enabled,created_at,updated_at")
    .eq("account_id", accountId)
    .order("category", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ rules: [], emptyStateMessage: "No routing rules configured yet", tableMissing: true });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ rules: data || [] });
}

export async function POST(req: NextRequest) {
  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER"]);

  const body = (await req.json()) as {
    category?: string;
    default_assignee?: string | null;
    default_create_mode?: string;
    default_job_value_cents?: number;
    default_sla_minutes?: number;
    enabled?: boolean;
  };

  const category = String(body.category || "").trim().toLowerCase();
  if (!category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }

  const payload = {
    account_id: accountId,
    category,
    default_assignee: body.default_assignee ? String(body.default_assignee).trim() : null,
    default_create_mode: normalizeCreateMode(body.default_create_mode),
    default_job_value_cents: Number.isFinite(body.default_job_value_cents)
      ? Math.max(0, Math.round(Number(body.default_job_value_cents)))
      : 0,
    default_sla_minutes: Number.isFinite(body.default_sla_minutes)
      ? Math.max(5, Math.min(720, Math.round(Number(body.default_sla_minutes))))
      : 60,
    enabled: body.enabled !== false
  };

  const { data, error } = await supabase
    .from("routing_rules")
    .upsert(payload, { onConflict: "account_id,category" })
    .select("id,account_id,category,default_assignee,default_create_mode,default_job_value_cents,default_sla_minutes,enabled,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rule: data }, { status: 201 });
}
