"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEV_QUICK_LOGIN_EMAILS = void 0;
exports.devQuickLoginEnabled = devQuickLoginEnabled;
exports.isAllowedDevQuickLoginEmail = isAllowedDevQuickLoginEmail;
exports.hasDevAuthPassword = hasDevAuthPassword;
exports.getDevAuthPassword = getDevAuthPassword;
exports.ensureDevQuickLoginUser = ensureDevQuickLoginUser;
const admin_1 = require("@/lib/supabase/admin");
exports.DEV_QUICK_LOGIN_EMAILS = [
    "owner@servicebutler.local",
    "dispatcher@servicebutler.local",
    "tech@servicebutler.local"
];
function devQuickLoginEnabled() {
    return process.env.NODE_ENV === "development";
}
function isAllowedDevQuickLoginEmail(email) {
    return exports.DEV_QUICK_LOGIN_EMAILS.includes(email);
}
function hasDevAuthPassword() {
    return typeof process.env.DEV_AUTH_PASSWORD === "string" && process.env.DEV_AUTH_PASSWORD.trim().length > 0;
}
function getDevAuthPassword() {
    return hasDevAuthPassword() ? String(process.env.DEV_AUTH_PASSWORD) : "";
}
async function ensureDevQuickLoginUser(email) {
    if (!devQuickLoginEnabled())
        throw new Error("Dev quick login is disabled");
    if (!isAllowedDevQuickLoginEmail(email))
        throw new Error("Email is not allowed for dev quick login");
    const password = getDevAuthPassword();
    const admin = (0, admin_1.getSupabaseAdminClient)();
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError)
        throw new Error(listError.message);
    const existing = listed.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) {
        const { error: createError } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });
        if (createError)
            throw new Error(createError.message);
        return;
    }
    const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
        password
    });
    if (updateError)
        throw new Error(updateError.message);
}
