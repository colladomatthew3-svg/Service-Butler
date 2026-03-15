import { NextRequest, NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/rbac";
import { isDemoMode } from "@/lib/services/review-mode";
import { featureFlags } from "@/lib/config/feature-flags";
import { getV2TenantContext } from "@/lib/v2/context";
import { dispatchOutreach } from "@/lib/v2/outreach-orchestrator";
import type { AccountRole } from "@/types/domain";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isDemoMode() || !featureFlags.useV2Writes) {
    return NextResponse.json(
      {
        ok: false,
        mode: "compat",
        reason: "Enable SB_USE_V2_WRITES to dispatch outreach through v2"
      },
      { status: 202 }
    );
  }

  const context = await getV2TenantContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  assertRole(context.role as AccountRole, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  const body = (await req.json().catch(() => ({}))) as {
    channel?: "sms" | "email" | "voice" | "crm_task";
    to?: string;
    message?: string;
    subject?: string;
    assignmentId?: string | null;
    sequenceId?: string | null;
    coolingWindowMinutes?: number;
  };

  if (!body.channel || !body.to || !body.message) {
    return NextResponse.json({ error: "channel, to, and message are required" }, { status: 400 });
  }

  try {
    const result = await dispatchOutreach({
      supabase: context.supabase,
      tenantId: context.franchiseTenantId,
      leadId: id,
      assignmentId: body.assignmentId || null,
      sequenceId: body.sequenceId || null,
      actorUserId: context.userId,
      channel: body.channel,
      to: body.to,
      body: body.message,
      subject: body.subject || null,
      coolingWindowMinutes: body.coolingWindowMinutes
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Outreach dispatch failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
