"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logV2AuditEvent = logV2AuditEvent;
const admin_1 = require("@/lib/supabase/admin");
async function logV2AuditEvent(input) {
    const supabase = (0, admin_1.getSupabaseAdminClient)();
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
