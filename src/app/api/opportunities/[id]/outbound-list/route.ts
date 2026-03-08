import { NextResponse } from "next/server";
import { assertRole, getCurrentUserContext } from "@/lib/auth/rbac";
import { createDemoIncidentTriggeredList } from "@/lib/demo/store";
import { buildIncidentTriggeredListInput, createOutboundListWithMembers } from "@/lib/services/outbound-engine";
import { isDemoMode } from "@/lib/services/review-mode";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isDemoMode()) {
    const outboundList = createDemoIncidentTriggeredList(id);
    if (!outboundList) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    return NextResponse.json({ outboundList });
  }

  const { accountId, role, supabase } = await getCurrentUserContext();
  assertRole(role, ["ACCOUNT_OWNER", "DISPATCHER", "TECH"]);

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
