"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATCH = PATCH;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const store_1 = require("@/lib/demo/store");
const review_mode_1 = require("@/lib/services/review-mode");
function normalizeCreateMode(value) {
    return String(value || "lead").toLowerCase() === "job" ? "job" : "lead";
}
async function PATCH(req, { params }) {
    const { id } = await params;
    if ((0, review_mode_1.isDemoMode)()) {
        const body = (await req.json());
        const patch = {};
        if (body.category !== undefined) {
            const category = String(body.category || "").trim().toLowerCase();
            if (!category)
                return server_1.NextResponse.json({ error: "category cannot be empty" }, { status: 400 });
            patch.category = category;
        }
        if (body.default_assignee !== undefined)
            patch.default_assignee = body.default_assignee ? String(body.default_assignee).trim() : null;
        if (body.default_create_mode !== undefined)
            patch.default_create_mode = normalizeCreateMode(body.default_create_mode);
        if (body.default_job_value_cents !== undefined) {
            if (!Number.isFinite(body.default_job_value_cents)) {
                return server_1.NextResponse.json({ error: "default_job_value_cents must be numeric" }, { status: 400 });
            }
            patch.default_job_value_cents = Math.max(0, Math.round(Number(body.default_job_value_cents)));
        }
        if (body.default_sla_minutes !== undefined) {
            if (!Number.isFinite(body.default_sla_minutes)) {
                return server_1.NextResponse.json({ error: "default_sla_minutes must be numeric" }, { status: 400 });
            }
            patch.default_sla_minutes = Math.max(5, Math.min(720, Math.round(Number(body.default_sla_minutes))));
        }
        if (body.enabled !== undefined)
            patch.enabled = Boolean(body.enabled);
        if (Object.keys(patch).length === 0) {
            return server_1.NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }
        const rule = (0, store_1.patchDemoRoutingRule)(id, patch);
        if (!rule)
            return server_1.NextResponse.json({ error: "Rule not found" }, { status: 404 });
        return server_1.NextResponse.json({ rule });
    }
    const { accountId, role, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER"]);
    const body = (await req.json());
    const patch = {};
    if (body.category !== undefined) {
        const category = String(body.category || "").trim().toLowerCase();
        if (!category)
            return server_1.NextResponse.json({ error: "category cannot be empty" }, { status: 400 });
        patch.category = category;
    }
    if (body.default_assignee !== undefined)
        patch.default_assignee = body.default_assignee ? String(body.default_assignee).trim() : null;
    if (body.default_create_mode !== undefined)
        patch.default_create_mode = normalizeCreateMode(body.default_create_mode);
    if (body.default_job_value_cents !== undefined) {
        if (!Number.isFinite(body.default_job_value_cents)) {
            return server_1.NextResponse.json({ error: "default_job_value_cents must be numeric" }, { status: 400 });
        }
        patch.default_job_value_cents = Math.max(0, Math.round(Number(body.default_job_value_cents)));
    }
    if (body.default_sla_minutes !== undefined) {
        if (!Number.isFinite(body.default_sla_minutes)) {
            return server_1.NextResponse.json({ error: "default_sla_minutes must be numeric" }, { status: 400 });
        }
        patch.default_sla_minutes = Math.max(5, Math.min(720, Math.round(Number(body.default_sla_minutes))));
    }
    if (body.enabled !== undefined)
        patch.enabled = Boolean(body.enabled);
    if (Object.keys(patch).length === 0) {
        return server_1.NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    const { data, error } = await supabase
        .from("routing_rules")
        .update(patch)
        .eq("account_id", accountId)
        .eq("id", id)
        .select("id,account_id,category,default_assignee,default_create_mode,default_job_value_cents,default_sla_minutes,enabled,created_at,updated_at")
        .single();
    if (error || !data)
        return server_1.NextResponse.json({ error: error?.message || "Rule not found" }, { status: 404 });
    return server_1.NextResponse.json({ rule: data });
}
async function DELETE(_, { params }) {
    const { id } = await params;
    if ((0, review_mode_1.isDemoMode)()) {
        const deleted = (0, store_1.deleteDemoRoutingRule)(id);
        if (!deleted)
            return server_1.NextResponse.json({ error: "Rule not found" }, { status: 404 });
        return server_1.NextResponse.json({ ok: true });
    }
    const { accountId, role, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER"]);
    const { error } = await supabase.from("routing_rules").delete().eq("account_id", accountId).eq("id", id);
    if (error)
        return server_1.NextResponse.json({ error: error.message }, { status: 400 });
    return server_1.NextResponse.json({ ok: true });
}
