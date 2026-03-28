"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuditEvent = logAuditEvent;
const admin_1 = require("@/lib/supabase/admin");
async function logAuditEvent(input) {
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    const { error } = await supabase.from("audit_events").insert({
        account_id: input.accountId,
        actor_user_id: input.actorUserId ?? null,
        event_type: input.eventType,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        metadata: input.metadata ?? {}
    });
    if (error)
        console.error("audit log failed", error.message);
}
