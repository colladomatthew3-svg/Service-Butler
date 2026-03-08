import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import {
  createDemoIncidentTriggeredList,
  createDemoOutboundList,
  listDemoOutboundLists
} from "@/lib/demo/store";
import {
  buildIncidentTriggeredListInput,
  createOutboundListWithMembers,
  resolveMembersForSegments
} from "@/lib/services/outbound-engine";
import { cleanText } from "@/lib/services/outbound";
import { isDemoMode } from "@/lib/services/review-mode";

type OutboundListRequest = {
  name?: string;
  listType?: string;
  territory?: string | null;
  sourceTrigger?: string | null;
  campaignName?: string | null;
  smartleadCampaignId?: string | null;
  segmentTypes?: string[];
  nearIncident?: boolean | null;
  recordIds?: string[];
  recordType?: "prospect" | "referral_partner";
  opportunityId?: string | null;
};

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({ outboundLists: listDemoOutboundLists() });
  }

  const { accountId, supabase } = await getCurrentUserContext();
  const { data: lists, error } = await supabase
    .from("outbound_lists")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ids = (lists || []).map((item) => item.id);
  const countsByList: Record<string, number> = {};
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

  return NextResponse.json({
    outboundLists: (lists || []).map((item) => ({
      ...item,
      member_count: countsByList[String(item.id)] || 0
    }))
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as OutboundListRequest;

  if (isDemoMode()) {
    if (body.opportunityId) {
      const list = createDemoIncidentTriggeredList(body.opportunityId);
      if (!list) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
      return NextResponse.json({ outboundList: list });
    }

    const members = (body.recordIds || []).map((recordId) => ({
      record_type: body.recordType || "prospect",
      record_id: recordId
    }));
    const list = createDemoOutboundList({
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
    return NextResponse.json({ outboundList: list });
  }

  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

  if (body.opportunityId) {
    const triggered = await buildIncidentTriggeredListInput({
      supabase,
      accountId,
      opportunityId: body.opportunityId
    });
    const outboundList = await createOutboundListWithMembers({
      accountId,
      supabase,
      name: triggered.name,
      listType: triggered.listType,
      territory: triggered.territory,
      sourceTrigger: triggered.sourceTrigger,
      segmentDefinition: triggered.segmentDefinition,
      members: triggered.members
    });
    return NextResponse.json({ outboundList });
  }

  let members = (body.recordIds || []).map((recordId) => ({
    record_type: body.recordType || "prospect",
    record_id: recordId
  }));

  if (members.length === 0 && Array.isArray(body.segmentTypes) && body.segmentTypes.length > 0) {
    members = await resolveMembersForSegments({
      supabase,
      accountId,
      territory: cleanText(body.territory),
      segmentTypes: body.segmentTypes,
      nearIncident: body.nearIncident ?? null
    });
  }

  const outboundList = await createOutboundListWithMembers({
    accountId,
    supabase,
    name: body.name || "New outbound list",
    listType: body.listType || "prospect",
    territory: cleanText(body.territory),
    sourceTrigger: cleanText(body.sourceTrigger),
    campaignName: cleanText(body.campaignName),
    smartleadCampaignId: cleanText(body.smartleadCampaignId),
    segmentDefinition: {
      segments: body.segmentTypes || [],
      near_incident: body.nearIncident ?? null,
      territory: cleanText(body.territory)
    },
    members
  });

  return NextResponse.json({ outboundList });
}
