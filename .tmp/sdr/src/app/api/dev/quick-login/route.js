"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const server_2 = require("@/lib/supabase/server");
const dev_quick_login_1 = require("@/lib/auth/dev-quick-login");
async function POST(req) {
    if (!(0, dev_quick_login_1.devQuickLoginEnabled)()) {
        return server_1.NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const body = (await req.json());
    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !(0, dev_quick_login_1.isAllowedDevQuickLoginEmail)(email)) {
        return server_1.NextResponse.json({ error: "Invalid dev login email" }, { status: 400 });
    }
    const password = (0, dev_quick_login_1.getDevAuthPassword)();
    const supabase = await (0, server_2.getSupabaseServerClient)();
    let { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        await (0, dev_quick_login_1.ensureDevQuickLoginUser)(email);
        const retry = await supabase.auth.signInWithPassword({ email, password });
        error = retry.error;
    }
    if (error) {
        return server_1.NextResponse.json({ error: error.message }, { status: 400 });
    }
    return server_1.NextResponse.json({ ok: true, redirectTo: "/dashboard" });
}
