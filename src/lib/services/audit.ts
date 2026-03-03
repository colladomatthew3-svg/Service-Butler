import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type AuditInput = {
  accountId: string;
  actorUserId?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAuditEvent(input: AuditInput) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("audit_events").insert({
    account_id: input.accountId,
    actor_user_id: input.actorUserId ?? null,
    event_type: input.eventType,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {}
  });

  if (error) console.error("audit log failed", error.message);
}
