"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const store_1 = require("@/lib/demo/store");
const outbound_engine_1 = require("@/lib/services/outbound-engine");
const review_mode_1 = require("@/lib/services/review-mode");
async function POST(_req, { params }) {
    const { id } = await params;
    if ((0, review_mode_1.isDemoMode)()) {
        const outboundList = (0, store_1.createDemoIncidentTriggeredList)(id);
        if (!outboundList)
            return server_1.NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
        return server_1.NextResponse.json({ outboundList });
    }
    const { accountId, role, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
    const triggered = await (0, outbound_engine_1.buildIncidentTriggeredListInput)({
        supabase,
        accountId,
        opportunityId: id
    });
    const outboundList = await (0, outbound_engine_1.createOutboundListWithMembers)({
        accountId,
        supabase,
        name: triggered.name,
        listType: triggered.listType,
        territory: triggered.territory,
        sourceTrigger: triggered.sourceTrigger,
        segmentDefinition: triggered.segmentDefinition,
        members: triggered.members
    });
    return server_1.NextResponse.json({ outboundList });
}
