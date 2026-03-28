"use strict";
"use server";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signInWithMagicLink = signInWithMagicLink;
exports.signInWithDevQuickLogin = signInWithDevQuickLogin;
exports.signOut = signOut;
exports.startDemoSession = startDemoSession;
const headers_1 = require("next/headers");
const navigation_1 = require("next/navigation");
const server_1 = require("@/lib/supabase/server");
const dev_quick_login_1 = require("@/lib/auth/dev-quick-login");
const review_mode_1 = require("@/lib/services/review-mode");
async function signInWithMagicLink(formData) {
    const email = String(formData.get("email") || "").trim();
    if (!email)
        throw new Error("Email is required");
    const h = await (0, headers_1.headers)();
    const origin = h.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const supabase = await (0, server_1.getSupabaseServerClient)();
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            emailRedirectTo: `${origin}/pipeline`
        }
    });
    if (error)
        throw new Error(error.message);
    (0, navigation_1.redirect)("/login?sent=1");
}
async function signInWithDevQuickLogin(formData) {
    const result = await tryDevQuickLogin(formData);
    if (!result.ok) {
        (0, navigation_1.redirect)(`/login?devQuickLogin=${result.reason}`);
    }
    (0, navigation_1.redirect)("/dashboard");
}
async function tryDevQuickLogin(formData) {
    if (!(0, dev_quick_login_1.devQuickLoginEnabled)()) {
        return { ok: false, reason: "DEV_QUICK_LOGIN_DISABLED" };
    }
    const email = String(formData.get("email") || "").trim().toLowerCase();
    if (!email || !(0, dev_quick_login_1.isAllowedDevQuickLoginEmail)(email)) {
        return { ok: false, reason: "INVALID_DEV_QUICK_LOGIN_EMAIL" };
    }
    if (!(0, dev_quick_login_1.hasDevAuthPassword)()) {
        if ((0, review_mode_1.isDemoMode)()) {
            return { ok: true };
        }
        return { ok: false, reason: "DEV_AUTH_PASSWORD_MISSING" };
    }
    const password = (0, dev_quick_login_1.getDevAuthPassword)();
    const supabase = await (0, server_1.getSupabaseServerClient)();
    try {
        let { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            await (0, dev_quick_login_1.ensureDevQuickLoginUser)(email);
            const retry = await supabase.auth.signInWithPassword({ email, password });
            error = retry.error;
        }
        if (error) {
            return { ok: false, reason: "AUTH_FAILED", message: error.message };
        }
    }
    catch (error) {
        return {
            ok: false,
            reason: "AUTH_FAILED",
            message: error instanceof Error ? error.message : "Dev quick login failed"
        };
    }
    return { ok: true };
}
async function signOut() {
    if ((0, review_mode_1.isDemoMode)()) {
        (0, navigation_1.redirect)("/login");
    }
    const supabase = await (0, server_1.getSupabaseServerClient)();
    await supabase.auth.signOut();
    (0, navigation_1.redirect)("/login");
}
async function startDemoSession() {
    if (!(0, review_mode_1.isDemoMode)()) {
        (0, navigation_1.redirect)("/login");
    }
    (0, navigation_1.redirect)("/dashboard");
}
