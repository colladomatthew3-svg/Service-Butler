import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function logV2AuditEvent(input: {
  tenantId: string;
  actorType: string;
  actorId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("v2_audit_logs").insert({
    tenant_id: input.tenantId,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    action: input.action,
    before_json: input.before ?? null,
    after_json: input.after ?? null
  });

  if (error) {
    console.error("v2 audit log failed", error.message);
  }
}
