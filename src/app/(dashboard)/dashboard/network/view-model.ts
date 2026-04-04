import { listDataSourceSummaries } from "@/lib/control-plane/data-sources";
import type { DataSourceSummary, ReadinessState } from "@/lib/control-plane/types";
import { isDemoMode } from "@/lib/services/review-mode";
import type { CaptureProofSummary } from "@/lib/v2/capture-proof";
import { getV2TenantContext } from "@/lib/v2/context";
import { getCorporateDashboardReadModel, getFranchiseDashboardReadModel } from "@/lib/v2/dashboard-read-models";
import { getProductionReadinessSummary } from "@/lib/v2/readiness";

type SourcePreviewRow = {
  source_id: string;
  source_name: string;
  source_type: string;
  authenticity?: string;
  event_count?: number;
  score: number;
  recommendation: string;
  verified_lead_count: number;
  booked_job_count: number;
};

type TerritoryPerformanceRow = {
  territory_id: string;
  territory_name: string;
  assignments: number;
  accepted: number;
  completed: number;
};

type ProofSampleRow = {
  lead_id: string;
  contact_name: string;
  source_name: string;
  service_line: string;
  verification_score: number;
  proof_authenticity?: string;
  proof_summary: string;
};

export type FranchiseReadModel = {
  intelligence?: {
    source_quality_preview?: SourcePreviewRow[];
    source_trust_summary?: { keep: number; tune: number; pause: number };
  };
  lead_quality_proof?: {
    verified_lead_count?: number;
    live_provider_verified_lead_count?: number;
    network_verified_lead_count?: number;
    booked_jobs_from_verified_leads?: number;
    booked_jobs_from_live_provider_verified_leads?: number;
    booked_jobs_from_network_leads?: number;
    network_activated_opportunity_count?: number;
    network_outreach_event_count?: number;
    contactable_lead_count?: number;
    proof_samples?: ProofSampleRow[];
  };
  capture_proof_summary?: CaptureProofSummary | null;
  outreach_activity?: {
    total?: number;
  };
  territory_performance?: TerritoryPerformanceRow[];
  freshness?: {
    connector_runs_considered?: number;
    outreach_events_considered?: number;
  };
} | null;

export type CorporateReadModel = {
  metrics?: Array<{ label: string; value: number }>;
  byFranchise?: Array<{ tenant_id: string; franchise: string; opportunities: number; booked_jobs: number; booking_rate: number }>;
} | null;

export type NetworkViewModel = {
  viewState: "live" | "demo" | "blocked";
  demoMode: boolean;
  franchise: FranchiseReadModel | null;
  corporate: CorporateReadModel | null;
  dataSources: DataSourceSummary[];
  readiness: ReadinessState | null;
};

export async function loadNetworkViewModel(): Promise<NetworkViewModel> {
  if (isDemoMode()) {
    return {
      viewState: "blocked",
      demoMode: false,
      franchise: null,
      corporate: null,
      dataSources: await listDataSourceSummaries(),
      readiness: {
        mode: "blocked",
        live: false,
        reason: "Buyer-proof surfaces are disabled in demo mode.",
        blockingIssues: [
          {
            code: "not_live_in_environment",
            message: "Buyer-proof surfaces are disabled in demo mode.",
            detail: "Switch to a tenant-mapped live environment before using the network proof view."
          }
        ],
        recommendedActions: [
          "Switch to a tenant-mapped live environment before using the network proof view.",
          "Sign in with a tenant-mapped live account before reviewing buyer-proof metrics."
        ]
      }
    };
  }

  const context = await getV2TenantContext().catch(() => null);
  if (!context) {
    return {
      viewState: "blocked",
      demoMode: false,
      franchise: null,
      corporate: null,
      dataSources: [],
      readiness: {
        mode: "blocked",
        live: false,
        reason: "No live tenant context is available for buyer-proof reporting.",
        blockingIssues: [
          {
            code: "not_live_in_environment",
            message: "No live tenant context is available for buyer-proof reporting.",
            detail: "Sign in with a tenant-mapped live account instead of falling back to demo proof."
          }
        ],
        recommendedActions: [
          "Sign in with a tenant-mapped live account instead of falling back to demo proof.",
          "Enable live v2 reads and writes for the tenant-mapped environment before opening this buyer-facing route."
        ]
      }
    };
  }

  const [dataSources, readinessSummary] = await Promise.all([
    listDataSourceSummaries({
      supabase: context.supabase as never,
      tenantId: context.franchiseTenantId
    }),
    getProductionReadinessSummary({
      supabase: context.supabase
    })
  ]);

  const blockingChecks = readinessSummary.checks.filter(
    (check) =>
      check.required &&
      check.status === "fail" &&
      new Set(["v2_flags", "supabase_rest", "active_territories", "service_area", "active_data_sources", "live_safe_sources"]).has(check.key)
  );

  if (blockingChecks.length > 0) {
    return {
      viewState: "blocked",
      demoMode: false,
      franchise: null,
      corporate: null,
      dataSources,
      readiness: {
        mode: "blocked",
        live: false,
        reason: "Buyer-proof metrics are blocked until tenant readiness and live-safe source prerequisites pass.",
        blockingIssues: blockingChecks.map((check) => ({
          code: check.key === "live_safe_sources" ? "not_live_in_environment" : "live_partial",
          message: check.message,
          detail: check.detail
        })),
        recommendedActions: [
          "Enable SB_USE_V2_READS and SB_USE_V2_WRITES in the live environment.",
          "Configure at least one active, live-safe data source for the tenant.",
          "Set active territories and service area before using the buyer network view."
        ]
      }
    };
  }

  try {
    const [franchise, corporate] = await Promise.all([
      getFranchiseDashboardReadModel({
        supabase: context.supabase,
        franchiseTenantId: context.franchiseTenantId
      }),
      getCorporateDashboardReadModel({
        supabase: context.supabase,
        enterpriseTenantId: context.enterpriseTenantId
      })
    ]);

    return {
      viewState: "live",
      demoMode: false,
      franchise,
      corporate,
      dataSources,
      readiness: null
    };
  } catch (error) {
    return {
      viewState: "blocked",
      demoMode: false,
      franchise: null,
      corporate: null,
      dataSources,
      readiness: {
        mode: "blocked",
        live: false,
        reason: "Buyer-proof read models could not be loaded from the live environment.",
        blockingIssues: [
          {
            code: "not_live_in_environment",
            message: error instanceof Error ? error.message : "Live buyer-proof read models are unavailable."
          }
        ],
        recommendedActions: ["Restore live read-model access before using this buyer-facing surface."]
      }
    };
  }
}
