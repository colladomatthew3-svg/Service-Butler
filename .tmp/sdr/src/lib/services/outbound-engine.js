"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMembersForSegments = resolveMembersForSegments;
exports.createOutboundListWithMembers = createOutboundListWithMembers;
exports.buildIncidentTriggeredListInput = buildIncidentTriggeredListInput;
exports.fetchOutboundListRecords = fetchOutboundListRecords;
exports.buildOutboundCsvExport = buildOutboundCsvExport;
const outbound_1 = require("@/lib/services/outbound");
function fromTable(client, table) {
    return client.from(table);
}
async function resolveMembersForSegments({ supabase, accountId, territory, segmentTypes, nearIncident }) {
    const normalizedSegments = segmentTypes.map((value) => String(value).trim().toLowerCase()).filter(Boolean);
    if (normalizedSegments.length === 0)
        return [];
    let prospectsQuery = fromTable(supabase, "prospects")
        .select("id,territory,prospect_type")
        .eq("account_id", accountId)
        .in("prospect_type", normalizedSegments);
    let partnersQuery = fromTable(supabase, "referral_partners")
        .select("id,territory,partner_type")
        .eq("account_id", accountId)
        .in("partner_type", normalizedSegments);
    if (territory) {
        prospectsQuery = prospectsQuery.eq("territory", territory);
        partnersQuery = partnersQuery.eq("territory", territory);
    }
    if (nearIncident != null) {
        prospectsQuery = prospectsQuery.eq("near_active_incident", nearIncident);
        partnersQuery = partnersQuery.eq("near_active_incident", nearIncident);
    }
    const [{ data: prospects }, { data: partners }] = (await Promise.all([
        prospectsQuery,
        partnersQuery
    ]));
    return [
        ...(prospects || []).map((row) => ({ record_type: "prospect", record_id: row.id })),
        ...(partners || []).map((row) => ({ record_type: "referral_partner", record_id: row.id }))
    ];
}
async function createOutboundListWithMembers(input) {
    const insertPayload = {
        account_id: input.accountId,
        name: input.name,
        list_type: input.listType,
        segment_definition_json: input.segmentDefinition || {},
        territory: input.territory || null,
        source_trigger: input.sourceTrigger || null,
        campaign_name: input.campaignName || null,
        smartlead_campaign_id: input.smartleadCampaignId || null,
        export_status: "draft"
    };
    const { data: list, error } = await fromTable(input.supabase, "outbound_lists").insert(insertPayload).select("*").single();
    const listRow = list;
    if (error || !listRow)
        throw new Error(error?.message || "Failed to create outbound list");
    const members = input.members || [];
    if (members.length > 0) {
        const { error: memberError } = (await fromTable(input.supabase, "outbound_list_members").insert(members.map((member) => ({
            account_id: input.accountId,
            outbound_list_id: listRow.id,
            record_type: member.record_type,
            record_id: member.record_id
        }))));
        if (memberError)
            throw new Error(memberError.message || "Failed to create outbound list members");
    }
    return {
        ...listRow,
        member_count: members.length
    };
}
async function buildIncidentTriggeredListInput({ supabase, accountId, opportunityId }) {
    const { data, error } = await fromTable(supabase, "opportunities")
        .select("id,title,category,location_text,territory,city,state,zip,raw")
        .eq("account_id", accountId)
        .eq("id", opportunityId)
        .single();
    const opportunity = data;
    if (error || !opportunity) {
        throw new Error(error?.message || "Opportunity not found");
    }
    const territory = (0, outbound_1.deriveOpportunityTerritory)(opportunity);
    const segments = (0, outbound_1.getIncidentTriggeredSegments)(opportunity);
    const members = await resolveMembersForSegments({
        supabase,
        accountId,
        territory,
        segmentTypes: segments,
        nearIncident: null
    });
    return {
        name: (0, outbound_1.buildTriggeredListName)(opportunity),
        listType: "incident_triggered",
        territory,
        sourceTrigger: String(opportunity.title || "Incident trigger"),
        segmentDefinition: {
            segments,
            territory,
            near_incident: true,
            opportunity_id: opportunity.id,
            tags: (0, outbound_1.normalizeTagList)(opportunity.raw?.tags)
        },
        members
    };
}
async function fetchOutboundListRecords({ supabase, accountId, listId }) {
    const { data: listData, error: listError } = await fromTable(supabase, "outbound_lists")
        .select("*")
        .eq("account_id", accountId)
        .eq("id", listId)
        .single();
    const list = listData;
    if (listError || !list) {
        throw new Error(listError?.message || "Outbound list not found");
    }
    const { data: memberData, error: memberError } = (await fromTable(supabase, "outbound_list_members")
        .select("record_type,record_id")
        .eq("account_id", accountId)
        .eq("outbound_list_id", listId));
    const members = memberData;
    if (memberError) {
        throw new Error(memberError.message || "Outbound list members could not be loaded");
    }
    const typedMembers = (members || []);
    const prospectIds = typedMembers.filter((item) => item.record_type === "prospect").map((item) => item.record_id);
    const partnerIds = typedMembers.filter((item) => item.record_type === "referral_partner").map((item) => item.record_id);
    const [{ data: prospects }, { data: partners }] = (await Promise.all([
        prospectIds.length > 0
            ? fromTable(supabase, "prospects")
                .select("id,company_name,contact_name,email,phone,website,city,state,territory,tags,prospect_type")
                .eq("account_id", accountId)
                .in("id", prospectIds)
            : Promise.resolve({ data: [] }),
        partnerIds.length > 0
            ? fromTable(supabase, "referral_partners")
                .select("id,company_name,contact_name,email,phone,website,city,state,territory,tags,partner_type")
                .eq("account_id", accountId)
                .in("id", partnerIds)
            : Promise.resolve({ data: [] })
    ]));
    return {
        list,
        members: members || [],
        prospects: (prospects || []),
        partners: (partners || [])
    };
}
function buildOutboundCsvExport({ prospects, partners }) {
    const rows = [
        ...prospects.map((row) => ({
            record_type: "prospect",
            company_name: row.company_name,
            contact_name: row.contact_name,
            email: row.email,
            phone: row.phone,
            segment: row.prospect_type,
            territory: row.territory,
            city: row.city,
            state: row.state
        })),
        ...partners.map((row) => ({
            record_type: "referral_partner",
            company_name: row.company_name,
            contact_name: row.contact_name,
            email: row.email,
            phone: row.phone,
            segment: row.partner_type,
            territory: row.territory,
            city: row.city,
            state: row.state
        }))
    ];
    return (0, outbound_1.buildCsv)(["record_type", "company_name", "contact_name", "email", "phone", "segment", "territory", "city", "state"], rows);
}
