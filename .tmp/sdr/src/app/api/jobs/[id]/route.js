"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.PATCH = PATCH;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const VALID_PIPELINE = ["NEW", "CONTACTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "WON", "LOST"];
function toJobStatus(pipeline) {
    if (pipeline === "IN_PROGRESS")
        return "IN_PROGRESS";
    if (pipeline === "COMPLETED" || pipeline === "WON")
        return "COMPLETED";
    if (pipeline === "LOST")
        return "CANCELED";
    return "SCHEDULED";
}
async function GET(_, { params }) {
    const { id } = await params;
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const { data: job, error } = await supabase
        .from("jobs")
        .select("id,lead_id,pipeline_status,status,scheduled_for,service_type,assigned_user_id,assigned_tech_name,estimated_value,notes,intent_score,customer_name,customer_phone,address,city,state,postal_code,created_at")
        .eq("account_id", accountId)
        .eq("id", id)
        .single();
    if (error || !job)
        return server_1.NextResponse.json({ error: "Job not found" }, { status: 404 });
    const [{ data: lead }, { data: signals }] = await Promise.all([
        supabase
            .from("leads")
            .select("id,status,requested_timeframe,source,notes")
            .eq("account_id", accountId)
            .eq("id", job.lead_id)
            .maybeSingle(),
        supabase
            .from("lead_intent_signals")
            .select("id,signal_type,title,detail,score,created_at")
            .eq("lead_id", job.lead_id)
            .order("score", { ascending: false })
    ]);
    return server_1.NextResponse.json({ job, lead: lead || null, signals: signals || [] });
}
async function PATCH(req, { params }) {
    const { id } = await params;
    const { accountId, role, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
    const body = (await req.json());
    const patch = {};
    if (body.pipeline_status && VALID_PIPELINE.includes(body.pipeline_status)) {
        patch.pipeline_status = body.pipeline_status;
        patch.status = toJobStatus(body.pipeline_status);
    }
    if (body.scheduled_for !== undefined) {
        patch.scheduled_for = body.scheduled_for ? new Date(body.scheduled_for).toISOString() : null;
    }
    if (body.assigned_user_id !== undefined)
        patch.assigned_user_id = body.assigned_user_id;
    if (body.assigned_tech_name !== undefined)
        patch.assigned_tech_name = body.assigned_tech_name;
    if (body.estimated_value !== undefined && Number.isFinite(body.estimated_value))
        patch.estimated_value = Number(body.estimated_value);
    if (body.notes !== undefined)
        patch.notes = body.notes;
    if (Object.keys(patch).length === 0) {
        return server_1.NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }
    const { data, error } = await supabase
        .from("jobs")
        .update(patch)
        .eq("account_id", accountId)
        .eq("id", id)
        .select("id,lead_id,pipeline_status,status,scheduled_for,service_type,assigned_user_id,assigned_tech_name,estimated_value,notes,intent_score,customer_name,customer_phone,address,city,state,postal_code,created_at")
        .single();
    if (error || !data)
        return server_1.NextResponse.json({ error: error?.message || "Job not found" }, { status: 400 });
    return server_1.NextResponse.json({ job: data });
}
