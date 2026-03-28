"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOrCreateContactByPhone = findOrCreateContactByPhone;
exports.findOrCreateLeadByPhone = findOrCreateLeadByPhone;
exports.resolveAccountByTwilioNumber = resolveAccountByTwilioNumber;
const admin_1 = require("@/lib/supabase/admin");
const phone_1 = require("@/lib/validators/phone");
async function findOrCreateContactByPhone(accountId, phone) {
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    const e164 = (0, phone_1.normalizeToE164)(phone);
    const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("account_id", accountId)
        .eq("phone_e164", e164)
        .maybeSingle();
    if (existing)
        return existing.id;
    const { data, error } = await supabase
        .from("contacts")
        .insert({ account_id: accountId, phone_e164: e164 })
        .select("id")
        .single();
    if (error)
        throw new Error(error.message);
    return data.id;
}
async function findOrCreateLeadByPhone(accountId, phone) {
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    const contactId = await findOrCreateContactByPhone(accountId, phone);
    const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("account_id", accountId)
        .eq("contact_id", contactId)
        .maybeSingle();
    if (existing)
        return { leadId: existing.id, contactId };
    const { data, error } = await supabase
        .from("leads")
        .insert({ account_id: accountId, contact_id: contactId, stage: "NEW", source: "INBOUND" })
        .select("id")
        .single();
    if (error)
        throw new Error(error.message);
    return { leadId: data.id, contactId };
}
async function resolveAccountByTwilioNumber(toPhoneRaw) {
    const supabase = (0, admin_1.getSupabaseAdminClient)();
    const toPhone = (0, phone_1.normalizeToE164)(toPhoneRaw);
    const { data, error } = await supabase
        .from("account_settings")
        .select("account_id")
        .eq("twilio_phone_number", toPhone)
        .maybeSingle();
    if (error || !data)
        throw new Error("No account configured for destination number");
    return data.account_id;
}
