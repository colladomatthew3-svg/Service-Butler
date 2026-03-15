import type { V2DashboardMetricRow } from "@/lib/v2/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getCorporateDashboardReadModel({
  supabase,
  enterpriseTenantId
}: {
  supabase: SupabaseClient;
  enterpriseTenantId: string;
}) {
  const { data: franchises } = await supabase
    .from("v2_tenants")
    .select("id,name")
    .eq("parent_tenant_id", enterpriseTenantId)
    .eq("type", "franchise")
    .limit(500);

  const franchiseIds = (franchises || []).map((row: Record<string, unknown>) => String(row.id));

  const [{ data: opportunities }, { data: assignments }, { data: jobs }, { data: connectorRuns }] = await Promise.all([
    franchiseIds.length
      ? supabase
          .from("v2_opportunities")
          .select("tenant_id,routing_status,lifecycle_status,catastrophe_linkage_score,created_at")
          .in("tenant_id", franchiseIds)
      : Promise.resolve({ data: [] }),
    franchiseIds.length
      ? supabase.from("v2_assignments").select("tenant_id,status,sla_due_at,accepted_at")
          .in("tenant_id", franchiseIds)
      : Promise.resolve({ data: [] }),
    franchiseIds.length
      ? supabase.from("v2_jobs").select("tenant_id,status,revenue_amount,booked_at").in("tenant_id", franchiseIds)
      : Promise.resolve({ data: [] }),
    franchiseIds.length
      ? supabase.from("v2_connector_runs").select("tenant_id,status,started_at,completed_at").in("tenant_id", franchiseIds)
      : Promise.resolve({ data: [] })
  ]);

  const oppRows = (opportunities || []) as Array<Record<string, unknown>>;
  const assignmentRows = (assignments || []) as Array<Record<string, unknown>>;
  const jobRows = (jobs || []) as Array<Record<string, unknown>>;
  const connectorRows = (connectorRuns || []) as Array<Record<string, unknown>>;

  const totalOpportunities = oppRows.length;
  const routed = oppRows.filter((row) => row.routing_status === "routed" || row.routing_status === "escalated").length;
  const catastrophe = oppRows.filter((row) => toNumber(row.catastrophe_linkage_score) >= 70).length;

  const bookedJobs = jobRows.filter((row) => String(row.status || "").includes("book")).length;
  const totalRevenue = jobRows.reduce((sum, row) => sum + toNumber(row.revenue_amount), 0);

  const acceptedAssignments = assignmentRows.filter((row) => row.status === "accepted").length;
  const overdueAssignments = assignmentRows.filter((row) => {
    if (!row.sla_due_at) return false;
    if (row.status === "accepted" || row.status === "complete") return false;
    return new Date(String(row.sla_due_at)).getTime() < Date.now();
  }).length;

  const completedConnectorRuns = connectorRows.filter((row) => row.status === "completed" || row.status === "partial").length;
  const failedConnectorRuns = connectorRows.filter((row) => row.status === "failed").length;

  const metrics: V2DashboardMetricRow[] = [
    { label: "opportunity_volume", value: totalOpportunities },
    { label: "routed_opportunities", value: routed },
    { label: "booked_jobs", value: bookedJobs },
    { label: "assignment_acceptances", value: acceptedAssignments },
    { label: "assignment_overdue", value: overdueAssignments },
    { label: "catastrophe_surge_signals", value: catastrophe },
    { label: "connector_runs_completed", value: completedConnectorRuns },
    { label: "connector_runs_failed", value: failedConnectorRuns },
    { label: "estimated_revenue", value: totalRevenue }
  ];

  const byFranchise = (franchises || []).map((franchise: Record<string, unknown>) => {
    const id = String(franchise.id);
    const name = String(franchise.name || "Franchise");

    const opp = oppRows.filter((row) => String(row.tenant_id) === id).length;
    const booked = jobRows.filter((row) => String(row.tenant_id) === id && String(row.status || "").includes("book")).length;
    const bookingRate = opp > 0 ? Number(((booked / opp) * 100).toFixed(2)) : 0;

    return { tenant_id: id, franchise: name, opportunities: opp, booked_jobs: booked, booking_rate: bookingRate };
  });

  return {
    metrics,
    byFranchise,
    freshness: {
      generated_at: new Date().toISOString(),
      data_sources: completedConnectorRuns + failedConnectorRuns
    }
  };
}

export async function getFranchiseDashboardReadModel({
  supabase,
  franchiseTenantId
}: {
  supabase: SupabaseClient;
  franchiseTenantId: string;
}) {
  const [{ data: opportunities }, { data: assignments }, { data: jobs }, { data: outreachEvents }] = await Promise.all([
    supabase
      .from("v2_opportunities")
      .select("id,title,service_line,urgency_score,job_likelihood_score,routing_status,lifecycle_status,created_at")
      .eq("tenant_id", franchiseTenantId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("v2_assignments")
      .select("id,status,sla_due_at,assigned_at,accepted_at")
      .eq("tenant_id", franchiseTenantId)
      .order("assigned_at", { ascending: false })
      .limit(50),
    supabase
      .from("v2_jobs")
      .select("id,status,revenue_amount,booked_at,scheduled_at")
      .eq("tenant_id", franchiseTenantId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("v2_outreach_events")
      .select("id,channel,event_type,created_at")
      .eq("tenant_id", franchiseTenantId)
      .order("created_at", { ascending: false })
      .limit(200)
  ]);

  const oppRows = (opportunities || []) as Array<Record<string, unknown>>;
  const assignmentRows = (assignments || []) as Array<Record<string, unknown>>;
  const jobRows = (jobs || []) as Array<Record<string, unknown>>;
  const outreachRows = (outreachEvents || []) as Array<Record<string, unknown>>;

  const hotOpportunities = oppRows.filter((row) => toNumber(row.urgency_score) >= 70 || toNumber(row.job_likelihood_score) >= 70).length;
  const tasksDue = assignmentRows.filter((row) => {
    if (!row.sla_due_at) return false;
    if (row.status === "accepted" || row.status === "complete") return false;
    return new Date(String(row.sla_due_at)).getTime() <= Date.now();
  }).length;

  const bookedJobs = jobRows.filter((row) => String(row.status || "").includes("book")).length;
  const outreachSent = outreachRows.filter((row) => row.event_type === "sent" || row.event_type === "delivered").length;

  return {
    metrics: [
      { label: "new_opportunities", value: oppRows.length },
      { label: "hot_opportunities", value: hotOpportunities },
      { label: "tasks_due", value: tasksDue },
      { label: "booked_jobs", value: bookedJobs },
      { label: "outreach_sent", value: outreachSent }
    ],
    funnel: {
      opportunities: oppRows.length,
      assigned: assignmentRows.filter((row) => row.status === "accepted" || row.status === "pending_acceptance").length,
      booked_jobs: bookedJobs
    },
    opportunities: oppRows,
    assignments: assignmentRows,
    jobs: jobRows,
    freshness: {
      generated_at: new Date().toISOString(),
      outreach_events_considered: outreachRows.length
    }
  };
}
