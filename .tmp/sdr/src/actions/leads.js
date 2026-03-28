"use strict";
"use server";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLead = createLead;
exports.updateLeadStage = updateLeadStage;
exports.assignLead = assignLead;
const cache_1 = require("next/cache");
const rbac_1 = require("@/lib/auth/rbac");
const phone_1 = require("@/lib/validators/phone");
const audit_1 = require("@/lib/services/audit");
const client_1 = require("@/lib/workflows/client");
const logger_1 = require("@/lib/services/logger");
async function createLead(formData) {
    const { accountId, role, userId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
    const firstName = String(formData.get("first_name") || "");
    const lastName = String(formData.get("last_name") || "");
    const phone = String(formData.get("phone") || "");
    const email = String(formData.get("email") || "");
    const phoneE164 = phone ? (0, phone_1.normalizeToE164)(phone) : null;
    const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .insert({
        account_id: accountId,
        first_name: firstName,
        last_name: lastName,
        phone_e164: phoneE164,
        email
    })
        .select("id")
        .single();
    if (contactError)
        throw new Error(contactError.message);
    const { data: lead, error } = await supabase
        .from("leads")
        .insert({ account_id: accountId, contact_id: contact.id, source: "MANUAL" })
        .select("id")
        .single();
    if (error)
        throw new Error(error.message);
    await client_1.inngest.send({ name: "lead/created", data: { accountId, leadId: lead.id } });
    (0, logger_1.logEvent)("info", "lead.created", { accountId, leadId: lead.id });
    (0, logger_1.logEvent)("info", "workflow.triggered", { name: "lead/created", accountId, leadId: lead.id });
    await (0, audit_1.logAuditEvent)({
        accountId,
        actorUserId: userId,
        eventType: "lead_created",
        entityType: "lead",
        entityId: lead.id
    });
    (0, cache_1.revalidatePath)("/pipeline");
}
async function updateLeadStage(formData) {
    const { accountId, role, userId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
    const leadId = String(formData.get("lead_id"));
    const toStage = String(formData.get("stage"));
    const { data: current, error: currentError } = await supabase
        .from("leads")
        .select("stage")
        .eq("account_id", accountId)
        .eq("id", leadId)
        .single();
    if (currentError || !current)
        throw new Error("Lead not found");
    const { error } = await supabase
        .from("leads")
        .update({ stage: toStage })
        .eq("account_id", accountId)
        .eq("id", leadId);
    if (error)
        throw new Error(error.message);
    await supabase
        .from("sequence_enrollments")
        .update({ status: "STOPPED", stopped_reason: "stage_changed" })
        .eq("account_id", accountId)
        .eq("lead_id", leadId)
        .eq("status", "ACTIVE");
    await (0, audit_1.logAuditEvent)({
        accountId,
        actorUserId: userId,
        eventType: "lead_stage_changed",
        entityType: "lead",
        entityId: leadId,
        metadata: { from: current.stage, to: toStage }
    });
    if (toStage === "COMPLETED") {
        await client_1.inngest.send({ name: "job/completed", data: { accountId, leadId } });
        (0, logger_1.logEvent)("info", "workflow.triggered", { name: "job/completed", accountId, leadId });
    }
    (0, cache_1.revalidatePath)("/pipeline");
    (0, cache_1.revalidatePath)("/conversations");
}
async function assignLead(formData) {
    const { accountId, role, userId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER"]);
    const leadId = String(formData.get("lead_id"));
    const assignedUserId = String(formData.get("assigned_user_id"));
    const { error } = await supabase
        .from("leads")
        .update({ assigned_user_id: assignedUserId })
        .eq("id", leadId)
        .eq("account_id", accountId);
    if (error)
        throw new Error(error.message);
    await (0, audit_1.logAuditEvent)({
        accountId,
        actorUserId: userId,
        eventType: "lead_assigned",
        entityType: "lead",
        entityId: leadId,
        metadata: { assignedUserId }
    });
    (0, cache_1.revalidatePath)("/pipeline");
}
