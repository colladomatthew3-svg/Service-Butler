"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const store_1 = require("@/lib/demo/store");
const review_mode_1 = require("@/lib/services/review-mode");
function normalizeCreateMode(value) {
    return String(value || "lead").toLowerCase() === "job" ? "job" : "lead";
}
async function GET() {
    if ((0, review_mode_1.isDemoMode)()) {
        return server_1.NextResponse.json({ rules: (0, store_1.listDemoRoutingRules)() });
    }
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const { data, error } = await supabase
        .from("routing_rules")
        .select("id,account_id,category,default_assignee,default_create_mode,default_job_value_cents,default_sla_minutes,enabled,created_at,updated_at")
        .eq("account_id", accountId)
        .order("category", { ascending: true });
    if (error) {
        const message = String(error.message || "");
        const missingRulesTable = message.includes("routing_rules") &&
            (message.includes("schema cache") || message.includes("does not exist") || message.includes("not found"));
        if (missingRulesTable) {
            return server_1.NextResponse.json({
                rules: [],
                warning: "Routing rules table is unavailable locally. Run migrations to enable saved routing."
            });
        }
        return server_1.NextResponse.json({ error: error.message }, { status: 400 });
    }
    return server_1.NextResponse.json({ rules: data || [] });
}
async function POST(req) {
    if ((0, review_mode_1.isDemoMode)()) {
        const body = (await req.json());
        const category = String(body.category || "").trim().toLowerCase();
        if (!category) {
            return server_1.NextResponse.json({ error: "category is required" }, { status: 400 });
        }
        const rule = (0, store_1.upsertDemoRoutingRule)({
            category,
            default_assignee: body.default_assignee ? String(body.default_assignee).trim() : null,
            default_create_mode: normalizeCreateMode(body.default_create_mode),
            default_job_value_cents: Number.isFinite(body.default_job_value_cents)
                ? Math.max(0, Math.round(Number(body.default_job_value_cents)))
                : 0,
            default_sla_minutes: Number.isFinite(body.default_sla_minutes)
                ? Math.max(5, Math.min(720, Math.round(Number(body.default_sla_minutes))))
                : 60,
            enabled: body.enabled !== false
        });
        return server_1.NextResponse.json({ rule }, { status: 201 });
    }
    const { accountId, role, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER"]);
    const body = (await req.json());
    const category = String(body.category || "").trim().toLowerCase();
    if (!category) {
        return server_1.NextResponse.json({ error: "category is required" }, { status: 400 });
    }
    const payload = {
        account_id: accountId,
        category,
        default_assignee: body.default_assignee ? String(body.default_assignee).trim() : null,
        default_create_mode: normalizeCreateMode(body.default_create_mode),
        default_job_value_cents: Number.isFinite(body.default_job_value_cents)
            ? Math.max(0, Math.round(Number(body.default_job_value_cents)))
            : 0,
        default_sla_minutes: Number.isFinite(body.default_sla_minutes)
            ? Math.max(5, Math.min(720, Math.round(Number(body.default_sla_minutes))))
            : 60,
        enabled: body.enabled !== false
    };
    const { data, error } = await supabase
        .from("routing_rules")
        .upsert(payload, { onConflict: "account_id,category" })
        .select("id,account_id,category,default_assignee,default_create_mode,default_job_value_cents,default_sla_minutes,enabled,created_at,updated_at")
        .single();
    if (error)
        return server_1.NextResponse.json({ error: error.message }, { status: 400 });
    return server_1.NextResponse.json({ rule: data }, { status: 201 });
}
