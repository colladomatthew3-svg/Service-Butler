"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
async function GET() {
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const { data, error } = await supabase
        .from("outbound_contacts")
        .select("id,name,phone,email,service_type,city,state,postal_code,tags,created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(200);
    if (error)
        return server_1.NextResponse.json({ error: error.message }, { status: 400 });
    return server_1.NextResponse.json({ contacts: data || [] });
}
