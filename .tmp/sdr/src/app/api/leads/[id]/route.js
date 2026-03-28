"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.PATCH = PATCH;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const store_1 = require("@/lib/demo/store");
const review_mode_1 = require("@/lib/services/review-mode");
function statusToStage(status) {
    switch (status) {
        case "new":
            return "NEW";
        case "contacted":
            return "CONTACTED";
        case "scheduled":
            return "BOOKED";
        case "won":
            return "COMPLETED";
        case "lost":
            return "LOST";
        default:
            return undefined;
    }
}
async function GET(_, { params }) {
    const { id } = await params;
    if ((0, review_mode_1.isDemoMode)()) {
        const lead = (0, store_1.getDemoLead)(id);
        if (!lead)
            return server_1.NextResponse.json({ error: "Lead not found" }, { status: 404 });
        return server_1.NextResponse.json({ lead, signals: (0, store_1.getDemoLeadSignals)(id) });
    }
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const { data: lead, error } = await supabase
        .from("leads")
        .select("id,created_at,status,name,phone,service_type,address,city,state,postal_code,requested_timeframe,source,notes,scheduled_for,converted_job_id")
        .eq("account_id", accountId)
        .eq("id", id)
        .single();
    if (error || !lead)
        return server_1.NextResponse.json({ error: "Lead not found" }, { status: 404 });
    const { data: signals } = await supabase
        .from("lead_intent_signals")
        .select("id,created_at,signal_type,title,detail,score,payload")
        .eq("lead_id", id)
        .order("score", { ascending: false });
    return server_1.NextResponse.json({ lead, signals: signals || [] });
}
async function PATCH(req, { params }) {
    const { id } = await params;
    const body = (await req.json());
    if ((0, review_mode_1.isDemoMode)()) {
        const patch = {};
        if (body.status) {
            patch.status = body.status;
            const stage = statusToStage(body.status);
            if (stage)
                patch.stage = stage;
        }
        if (body.notes !== undefined)
            patch.notes = body.notes;
        if (body.scheduled_for !== undefined) {
            patch.scheduled_for = body.scheduled_for ? new Date(body.scheduled_for).toISOString() : null;
        }
        const lead = (0, store_1.updateDemoLead)(id, patch);
        if (!lead)
            return server_1.NextResponse.json({ error: "Lead not found" }, { status: 404 });
        return server_1.NextResponse.json({
            lead: {
                id: lead.id,
                status: lead.status,
                notes: lead.notes,
                scheduled_for: lead.scheduled_for
            }
        });
    }
    const { accountId, role, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
    const patch = {};
    if (body.status) {
        patch.status = body.status;
        const stage = statusToStage(body.status);
        if (stage)
            patch.stage = stage;
    }
    if (body.notes !== undefined)
        patch.notes = body.notes;
    if (body.scheduled_for !== undefined) {
        patch.scheduled_for = body.scheduled_for ? new Date(body.scheduled_for).toISOString() : null;
    }
    const { data, error } = await supabase
        .from("leads")
        .update(patch)
        .eq("account_id", accountId)
        .eq("id", id)
        .select("id,status,notes,scheduled_for")
        .single();
    if (error)
        return server_1.NextResponse.json({ error: error.message }, { status: 400 });
    return server_1.NextResponse.json({ lead: data });
}
