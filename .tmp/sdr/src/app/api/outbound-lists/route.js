"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const rbac_1 = require("@/lib/auth/rbac");
const store_1 = require("@/lib/demo/store");
const outbound_engine_1 = require("@/lib/services/outbound-engine");
const outbound_1 = require("@/lib/services/outbound");
const review_mode_1 = require("@/lib/services/review-mode");
async function GET() {
    if ((0, review_mode_1.isDemoMode)()) {
        return server_1.NextResponse.json({ outboundLists: (0, store_1.listDemoOutboundLists)() });
    }
    const { accountId, supabase } = await (0, rbac_1.getCurrentUserContext)();
    const { data: lists, error } = await supabase
        .from("outbound_lists")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(100);
    if (error)
        return server_1.NextResponse.json({ error: error.message }, { status: 400 });
    const ids = (lists || []).map((item) => item.id);
    const countsByList = {};
    if (ids.length > 0) {
        const { data: members } = await supabase
            .from("outbound_list_members")
            .select("outbound_list_id")
            .eq("account_id", accountId)
            .in("outbound_list_id", ids);
        for (const member of members || []) {
            const key = String(member.outbound_list_id);
            countsByList[key] = (countsByList[key] || 0) + 1;
        }
    }
    return server_1.NextResponse.json({
        outboundLists: (lists || []).map((item) => ({
            ...item,
            member_count: countsByList[String(item.id)] || 0
        }))
    });
}
async function POST(req) {
    const body = (await req.json().catch(() => ({})));
    if ((0, review_mode_1.isDemoMode)()) {
        if (body.opportunityId) {
            const list = (0, store_1.createDemoIncidentTriggeredList)(body.opportunityId);
            if (!list)
                return server_1.NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
            return server_1.NextResponse.json({ outboundList: list });
        }
        const members = (body.recordIds || []).map((recordId) => ({
            record_type: body.recordType || "prospect",
            record_id: recordId
        }));
        const list = (0, store_1.createDemoOutboundList)({
            name: body.name || "New outbound list",
            listType: body.listType || "prospect",
            territory: body.territory || null,
            sourceTrigger: body.sourceTrigger || null,
            campaignName: body.campaignName || null,
            smartleadCampaignId: body.smartleadCampaignId || null,
            segmentDefinition: {
                segments: body.segmentTypes || [],
                near_incident: body.nearIncident ?? null,
                territory: body.territory || null
            },
            members
        });
        return server_1.NextResponse.json({ outboundList: list });
    }
    const { accountId, role, supabase } = await (0, rbac_1.getCurrentUserContext)();
    (0, rbac_1.assertRole)(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
    if (body.opportunityId) {
        const triggered = await (0, outbound_engine_1.buildIncidentTriggeredListInput)({
            supabase,
            accountId,
            opportunityId: body.opportunityId
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
    let members = (body.recordIds || []).map((recordId) => ({
        record_type: body.recordType || "prospect",
        record_id: recordId
    }));
    if (members.length === 0 && Array.isArray(body.segmentTypes) && body.segmentTypes.length > 0) {
        members = await (0, outbound_engine_1.resolveMembersForSegments)({
            supabase,
            accountId,
            territory: (0, outbound_1.cleanText)(body.territory),
            segmentTypes: body.segmentTypes,
            nearIncident: body.nearIncident ?? null
        });
    }
    const outboundList = await (0, outbound_engine_1.createOutboundListWithMembers)({
        accountId,
        supabase,
        name: body.name || "New outbound list",
        listType: body.listType || "prospect",
        territory: (0, outbound_1.cleanText)(body.territory),
        sourceTrigger: (0, outbound_1.cleanText)(body.sourceTrigger),
        campaignName: (0, outbound_1.cleanText)(body.campaignName),
        smartleadCampaignId: (0, outbound_1.cleanText)(body.smartleadCampaignId),
        segmentDefinition: {
            segments: body.segmentTypes || [],
            near_incident: body.nearIncident ?? null,
            territory: (0, outbound_1.cleanText)(body.territory)
        },
        members
    });
    return server_1.NextResponse.json({ outboundList });
}
