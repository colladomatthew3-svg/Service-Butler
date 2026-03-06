import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { deleteDemoRoutingRule, patchDemoRoutingRule } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/services/review-mode";

function normalizeCreateMode(value: unknown): "lead" | "job" {
  return String(value || "lead").toLowerCase() === "job" ? "job" : "lead";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isDemoMode()) {
    const body = (await req.json()) as {
      category?: string;
      default_assignee?: string | null;
      default_create_mode?: string;
      default_job_value_cents?: number;
      default_sla_minutes?: number;
      enabled?: boolean;
    };

    const patch: Record<string, unknown> = {};

    if (body.category !== undefined) {
      const category = String(body.category || "").trim().toLowerCase();
      if (!category) return NextResponse.json({ error: "category cannot be empty" }, { status: 400 });
      patch.category = category;
    }
    if (body.default_assignee !== undefined) patch.default_assignee = body.default_assignee ? String(body.default_assignee).trim() : null;
    if (body.default_create_mode !== undefined) patch.default_create_mode = normalizeCreateMode(body.default_create_mode);
    if (body.default_job_value_cents !== undefined) {
      if (!Number.isFinite(body.default_job_value_cents)) {
        return NextResponse.json({ error: "default_job_value_cents must be numeric" }, { status: 400 });
      }
      patch.default_job_value_cents = Math.max(0, Math.round(Number(body.default_job_value_cents)));
    }
    if (body.default_sla_minutes !== undefined) {
      if (!Number.isFinite(body.default_sla_minutes)) {
        return NextResponse.json({ error: "default_sla_minutes must be numeric" }, { status: 400 });
      }
      patch.default_sla_minutes = Math.max(5, Math.min(720, Math.round(Number(body.default_sla_minutes))));
    }
    if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const rule = patchDemoRoutingRule(id, patch);
    if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    return NextResponse.json({ rule });
  }

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

  const patch: Record<string, unknown> = {};

  if (body.category !== undefined) {
    const category = String(body.category || "").trim().toLowerCase();
    if (!category) return NextResponse.json({ error: "category cannot be empty" }, { status: 400 });
    patch.category = category;
  }
  if (body.default_assignee !== undefined) patch.default_assignee = body.default_assignee ? String(body.default_assignee).trim() : null;
  if (body.default_create_mode !== undefined) patch.default_create_mode = normalizeCreateMode(body.default_create_mode);
  if (body.default_job_value_cents !== undefined) {
    if (!Number.isFinite(body.default_job_value_cents)) {
      return NextResponse.json({ error: "default_job_value_cents must be numeric" }, { status: 400 });
    }
    patch.default_job_value_cents = Math.max(0, Math.round(Number(body.default_job_value_cents)));
  }
  if (body.default_sla_minutes !== undefined) {
    if (!Number.isFinite(body.default_sla_minutes)) {
      return NextResponse.json({ error: "default_sla_minutes must be numeric" }, { status: 400 });
    }
    patch.default_sla_minutes = Math.max(5, Math.min(720, Math.round(Number(body.default_sla_minutes))));
  }
  if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("routing_rules")
    .update(patch)
    .eq("account_id", accountId)
    .eq("id", id)
    .select("id,account_id,category,default_assignee,default_create_mode,default_job_value_cents,default_sla_minutes,enabled,created_at,updated_at")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message || "Rule not found" }, { status: 404 });
  return NextResponse.json({ rule: data });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isDemoMode()) {
    const deleted = deleteDemoRoutingRule(id);
    if (!deleted) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER"]);

  const { error } = await supabase.from("routing_rules").delete().eq("account_id", accountId).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
