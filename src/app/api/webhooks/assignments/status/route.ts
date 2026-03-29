import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { applyAssignmentWebhookStatus } from "@/lib/v2/assignment-webhook";
import { verifySharedSecretWebhook } from "@/lib/v2/webhook-auth";

export async function POST(req: NextRequest) {
  const auth = verifySharedSecretWebhook(req, "assignments.status");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as {
    tenantId?: string;
    assignmentId?: string;
    status?: "accepted" | "rejected" | "complete";
  };

  if (!body.tenantId || !body.assignmentId || !body.status) {
    return NextResponse.json({ error: "tenantId, assignmentId, and status are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  try {
    const result = await applyAssignmentWebhookStatus({
      supabase,
      tenantId: body.tenantId,
      assignmentId: body.assignmentId,
      status: body.status
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assignment webhook processing failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
