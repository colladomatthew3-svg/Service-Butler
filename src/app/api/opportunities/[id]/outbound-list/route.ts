import { NextRequest, NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { createDemoIncidentTriggeredList } from "@/lib/demo/store";
import { buildIncidentTriggeredListInput, createOutboundListWithMembers } from "@/lib/services/outbound-engine";
import { isDemoMode } from "@/lib/services/review-mode";
import { getV2TenantContext } from "@/lib/v2/context";
import { launchNetworkActivationForOpportunity, syncNetworkActivationList } from "@/lib/v2/network-activation";
import {
  addLeadsToSmartleadCampaign,
  isSmartleadConfigured,
  mapOutboundRecordToSmartleadLead
} from "@/lib/services/smartlead";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    activateFlow?: boolean;
    autoOutreach?: boolean;
    autoSync?: boolean;
    smartleadCampaignId?: string | null;
  };

  if (isDemoMode()) {
    const outboundList = createDemoIncidentTriggeredList(id);
    if (!outboundList) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    return NextResponse.json({
      outboundList,
      buyerFlow: body.activateFlow
        ? {
            matchedCount: 6,
            leadsCreated: 6,
            outreachSent: 6,
            contactableSmsCount: 4,
            contactableEmailCount: 6
          }
        : null
    });
  }

  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);
  const v2Context = await getV2TenantContext().catch(() => null);

  if (body.activateFlow && v2Context) {
    const activation = await launchNetworkActivationForOpportunity({
      supabase: v2Context.supabase,
      accountId,
      tenantId: v2Context.franchiseTenantId,
      actorUserId: v2Context.userId,
      opportunityId: id,
      autoOutreach: body.autoOutreach !== false
    });

    let smartlead = null;
    const campaignId = String(body.smartleadCampaignId || "").trim();
    if (body.autoSync && campaignId) {
      if (isSmartleadConfigured()) {
        const synced = await syncNetworkActivationList({
          supabase,
          accountId,
          listId: activation.listId,
          campaignId,
          addLeads: addLeadsToSmartleadCampaign,
          mapLead: mapOutboundRecordToSmartleadLead
        });
        smartlead = {
          synced: true,
          campaignId,
          leadCount: synced.leadCount
        };
      } else {
        await supabase
          .from("outbound_lists")
          .update({
            export_status: "csv_ready",
            smartlead_campaign_id: campaignId
          })
          .eq("account_id", accountId)
          .eq("id", activation.listId);
        smartlead = {
          synced: false,
          fallback: "csv_ready",
          campaignId
        };
      }
    }

    return NextResponse.json({
      outboundList: {
        id: activation.listId,
        name: activation.listName,
        list_type: activation.listType,
        territory: activation.territory,
        member_count: activation.matchedCount
      },
      buyerFlow: {
        matchedCount: activation.matchedCount,
        leadsCreated: activation.leadsCreated,
        outreachSent: activation.outreachSent,
        contactableSmsCount: activation.contactableSmsCount,
        contactableEmailCount: activation.contactableEmailCount,
        segments: activation.segments,
        smartlead
      }
    });
  }

  const triggered = await buildIncidentTriggeredListInput({
    supabase,
    accountId,
    opportunityId: id
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
