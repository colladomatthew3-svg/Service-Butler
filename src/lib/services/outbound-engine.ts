import {
  buildCsv,
  buildTriggeredListName,
  deriveOpportunityTerritory,
  getIncidentTriggeredSegments,
  normalizeTagList
} from "@/lib/services/outbound";

type QueryResponse<T = Record<string, unknown>> = {
  data: T | null;
  error?: { message?: string } | null;
};

type QueryLike = {
  select: (_query: string) => QueryLike;
  eq: (_column: string, _value: unknown) => QueryLike;
  in: (_column: string, _values: unknown[]) => QueryLike;
  insert: (_payload: unknown) => QueryLike;
  order: (_column: string, _options?: Record<string, unknown>) => QueryLike;
  limit: (_count: number) => QueryLike;
  single: () => Promise<QueryResponse>;
};

type SupabaseLike = unknown;

function fromTable(client: SupabaseLike, table: string) {
  return (client as { from: (_table: string) => QueryLike }).from(table);
}

type OutboundMember = {
  record_type: "prospect" | "referral_partner";
  record_id: string;
};

type CreateOutboundListInput = {
  accountId: string;
  supabase: SupabaseLike;
  name: string;
  listType: string;
  territory?: string | null;
  sourceTrigger?: string | null;
  campaignName?: string | null;
  smartleadCampaignId?: string | null;
  segmentDefinition?: Record<string, unknown>;
  members?: OutboundMember[];
};

export async function resolveMembersForSegments({
  supabase,
  accountId,
  territory,
  segmentTypes,
  nearIncident
}: {
  supabase: SupabaseLike;
  accountId: string;
  territory?: string | null;
  segmentTypes: string[];
  nearIncident?: boolean | null;
}) {
  const normalizedSegments = segmentTypes.map((value) => String(value).trim().toLowerCase()).filter(Boolean);
  if (normalizedSegments.length === 0) return [];

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
  ])) as unknown as [QueryResponse<Array<{ id: string }>>, QueryResponse<Array<{ id: string }>>];

  return [
    ...((prospects || []) as Array<{ id: string }>).map((row) => ({ record_type: "prospect" as const, record_id: row.id })),
    ...((partners || []) as Array<{ id: string }>).map((row) => ({ record_type: "referral_partner" as const, record_id: row.id }))
  ];
}

export async function createOutboundListWithMembers(input: CreateOutboundListInput) {
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
  const listRow = list as Record<string, unknown> | null;
  if (error || !listRow) throw new Error(error?.message || "Failed to create outbound list");

  const members = input.members || [];
  if (members.length > 0) {
    const { error: memberError } = (await fromTable(input.supabase, "outbound_list_members").insert(
      members.map((member) => ({
        account_id: input.accountId,
        outbound_list_id: listRow.id,
        record_type: member.record_type,
        record_id: member.record_id
      }))
    )) as unknown as QueryResponse;

    if (memberError) throw new Error(memberError.message || "Failed to create outbound list members");
  }

  return {
    ...listRow,
    member_count: members.length
  };
}

export async function buildIncidentTriggeredListInput({
  supabase,
  accountId,
  opportunityId
}: {
  supabase: SupabaseLike;
  accountId: string;
  opportunityId: string;
}) {
  const { data, error } = await fromTable(supabase, "opportunities")
    .select("id,title,category,location_text,territory,city,state,zip,raw")
    .eq("account_id", accountId)
    .eq("id", opportunityId)
    .single();
  const opportunity = data as {
    id: string;
    title: string | null;
    category: string | null;
    location_text: string | null;
    territory?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    raw?: Record<string, unknown> | null;
  } | null;

  if (error || !opportunity) {
    throw new Error(error?.message || "Opportunity not found");
  }

  const territory = deriveOpportunityTerritory(opportunity);
  const segments = getIncidentTriggeredSegments(opportunity);
  const members = await resolveMembersForSegments({
    supabase,
    accountId,
    territory,
    segmentTypes: segments,
    nearIncident: null
  });

  return {
    name: buildTriggeredListName(opportunity),
    listType: "incident_triggered",
    territory,
    sourceTrigger: String(opportunity.title || "Incident trigger"),
    segmentDefinition: {
      segments,
      territory,
      near_incident: true,
      opportunity_id: opportunity.id,
      tags: normalizeTagList((opportunity.raw as Record<string, unknown> | null)?.tags)
    },
    members
  };
}

export async function fetchOutboundListRecords({
  supabase,
  accountId,
  listId
}: {
  supabase: SupabaseLike;
  accountId: string;
  listId: string;
}) {
  const { data: listData, error: listError } = await fromTable(supabase, "outbound_lists")
    .select("*")
    .eq("account_id", accountId)
    .eq("id", listId)
    .single();
  const list = listData as Record<string, unknown> | null;

  if (listError || !list) {
    throw new Error(listError?.message || "Outbound list not found");
  }

  const { data: memberData, error: memberError } = (await fromTable(supabase, "outbound_list_members")
    .select("record_type,record_id")
    .eq("account_id", accountId)
    .eq("outbound_list_id", listId)) as unknown as QueryResponse<Array<{ record_type: string; record_id: string }>>;
  const members = memberData as Array<{ record_type: string; record_id: string }> | null;

  if (memberError) {
    throw new Error(memberError.message || "Outbound list members could not be loaded");
  }

  const typedMembers = (members || []) as Array<{ record_type: string; record_id: string }>;
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
  ])) as unknown as [QueryResponse<Array<Record<string, unknown>>>, QueryResponse<Array<Record<string, unknown>>>];

  return {
    list,
    members: members || [],
    prospects: (prospects || []) as Array<Record<string, unknown>>,
    partners: (partners || []) as Array<Record<string, unknown>>
  } as {
    list: Record<string, unknown> & { smartlead_campaign_id?: string | null };
    members: Array<{ record_type: string; record_id: string }>;
    prospects: Array<Record<string, unknown>>;
    partners: Array<Record<string, unknown>>;
  };
}

export function buildOutboundCsvExport({
  prospects,
  partners
}: {
  prospects: Array<Record<string, unknown>>;
  partners: Array<Record<string, unknown>>;
}) {
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

  return buildCsv(
    ["record_type", "company_name", "contact_name", "email", "phone", "segment", "territory", "city", "state"],
    rows
  );
}
