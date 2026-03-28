"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markWebhookProcessing = markWebhookProcessing;
const admin_1 = require("@/lib/supabase/admin");
const logger_1 = require("@/lib/services/logger");
async function markWebhookProcessing(provider, eventId, payload, accountId) {
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    const { data, error } = await supabase
        .from("webhook_events")
        .insert({
        provider,
        event_id: eventId,
        payload,
        account_id: accountId ?? null,
        processed_at: new Date().toISOString()
    })
        .select("id")
        .single();
    if (!error && data) {
        (0, logger_1.logEvent)("info", "webhook.idempotency.miss", { provider, eventId, accountId: accountId ?? null });
        return { duplicate: false, id: data.id };
    }
    if (error && error.code === "23505") {
        (0, logger_1.logEvent)("info", "webhook.idempotency.hit", { provider, eventId, accountId: accountId ?? null });
        return { duplicate: true, id: null };
    }
    throw new Error(error?.message || "Webhook idempotency failed");
}
