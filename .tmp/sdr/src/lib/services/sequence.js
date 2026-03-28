"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrollLeadInSequence = enrollLeadInSequence;
const server_1 = require("@/lib/supabase/server");
const client_1 = require("@/lib/workflows/client");
async function enrollLeadInSequence(accountId, leadId, sequenceType) {
    const supabase = await (0, server_1.getSupabaseServerClient)();
    const { data: sequence, error: sequenceError } = await supabase
        .from("sequences")
        .select("id")
        .eq("account_id", accountId)
        .eq("type", sequenceType)
        .eq("status", "ACTIVE")
        .single();
    if (sequenceError || !sequence)
        throw new Error(`Sequence not found: ${sequenceType}`);
    const { data: enrollment, error } = await supabase
        .from("sequence_enrollments")
        .upsert({
        account_id: accountId,
        lead_id: leadId,
        sequence_id: sequence.id,
        status: "ACTIVE",
        next_run_at: new Date().toISOString()
    }, { onConflict: "sequence_id,lead_id" })
        .select("id")
        .single();
    if (error)
        throw new Error(error.message);
    await client_1.inngest.send({
        name: "sequence/enrolled",
        data: { accountId, leadId, enrollmentId: enrollment.id, sequenceType }
    });
    return enrollment.id;
}
