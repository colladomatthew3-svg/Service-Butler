import { expect, test } from "@playwright/test";
import {
  buildQualificationUpdate,
  getOpportunityQualificationSnapshot,
  qualificationAllowsDispatch
} from "@/lib/v2/opportunity-qualification";
import { getFranchiseDashboardReadModel } from "@/lib/v2/dashboard-read-models";

type JsonRecord = Record<string, unknown>;

class QueryBuilder {
  private readonly rows: JsonRecord[];
  private filters: Array<(row: JsonRecord) => boolean> = [];
  private orderField: string | null = null;
  private ascending = true;
  private rowLimit: number | null = null;

  constructor(rows: JsonRecord[]) {
    this.rows = rows;
  }

  select() {
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push((row) => String(row[field] ?? "") === String(value ?? ""));
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.ascending = options?.ascending !== false;
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  private materialize() {
    let data = [...this.rows];
    for (const filter of this.filters) {
      data = data.filter(filter);
    }
    if (this.orderField) {
      const field = this.orderField;
      data.sort((left, right) => {
        const a = String(left[field] ?? "");
        const b = String(right[field] ?? "");
        return this.ascending ? a.localeCompare(b) : b.localeCompare(a);
      });
    }
    if (this.rowLimit != null) {
      data = data.slice(0, this.rowLimit);
    }
    return { data };
  }

  then<TResult1 = { data: JsonRecord[] }, TResult2 = never>(
    onfulfilled?: ((value: { data: JsonRecord[] }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.materialize()).then(onfulfilled, onrejected);
  }
}

function createSupabaseMock(tables: Record<string, JsonRecord[]>) {
  return {
    from(table: string) {
      return new QueryBuilder(tables[table] || []);
    }
  };
}

test("buyer smoke flow promotes a queued scanner signal into buyer-proof lead and job evidence", async () => {
  const queued = buildQualificationUpdate({
    explainability: {
      proof_authenticity: "live_provider",
      scanner_event_id: "scanner-1",
      scanner_opportunity_id: "scan-1",
      source_type: "weather.noaa"
    },
    mutation: {
      qualification_status: "queued_for_sdr",
      qualification_source: "scanner_operator",
      qualification_notes: "Queued from scanner for SDR follow-up"
    },
    actorUserId: "user-sdr"
  });

  const qualified = buildQualificationUpdate({
    explainability: queued.explainability,
    mutation: {
      qualification_status: "qualified_contactable",
      contact_name: "Taylor Lead",
      phone: "631-555-0199",
      verification_status: "verified",
      qualification_source: "sdr_follow_up_lane",
      qualification_notes: "Verified owner callback and mobile number"
    },
    actorUserId: "user-sdr"
  });

  const queuedSnapshot = getOpportunityQualificationSnapshot({
    explainability: queued.explainability,
    lifecycleStatus: queued.lifecycleStatus,
    contactStatus: queued.contactStatus
  });
  expect(queuedSnapshot.qualificationStatus).toBe("queued_for_sdr");

  const qualifiedSnapshot = getOpportunityQualificationSnapshot({
    explainability: qualified.explainability,
    lifecycleStatus: qualified.lifecycleStatus,
    contactStatus: qualified.contactStatus,
    proofAuthenticity: "live_provider"
  });

  expect(qualifiedSnapshot.qualificationStatus).toBe("qualified_contactable");
  expect(qualificationAllowsDispatch(qualifiedSnapshot)).toBeTruthy();

  const readModel = await getFranchiseDashboardReadModel({
    supabase: createSupabaseMock({
      v2_opportunities: [
        {
          id: "opp-1",
          tenant_id: "tenant-1",
          title: "Storm-driven mitigation call",
          opportunity_type: "restoration",
          service_line: "restoration",
          postal_code: "11788",
          source_event_id: "source-1",
          urgency_score: 86,
          job_likelihood_score: 88,
          source_reliability_score: 82,
          catastrophe_linkage_score: 74,
          incident_cluster_id: "cluster-1",
          explainability_json: qualified.explainability,
          routing_status: "routed",
          lifecycle_status: qualified.lifecycleStatus,
          created_at: "2026-03-30T12:00:00.000Z"
        }
      ],
      v2_assignments: [],
      v2_jobs: [
        {
          id: "job-1",
          tenant_id: "tenant-1",
          lead_id: "lead-1",
          status: "booked",
          revenue_amount: 8200,
          booked_at: "2026-03-30T13:00:00.000Z",
          scheduled_at: "2026-03-31T09:00:00.000Z",
          created_at: "2026-03-30T13:00:00.000Z"
        }
      ],
      v2_leads: [
        {
          id: "lead-1",
          tenant_id: "tenant-1",
          opportunity_id: "opp-1",
          lead_status: "verified",
          contact_name: "Taylor Lead",
          owner_user_id: "user-sdr",
          contact_channels_json: {
            phone: "+16315550199",
            verification_status: "verified",
            verification_score: 92,
            verification_reasons: ["sdr_verified_contact"],
            contact_provenance: "scanner_sdr"
          },
          created_at: "2026-03-30T12:30:00.000Z"
        }
      ],
      v2_outreach_events: [
        {
          id: "outreach-1",
          tenant_id: "tenant-1",
          lead_id: "lead-1",
          channel: "sms",
          event_type: "sent",
          outcome: "delivered",
          created_at: "2026-03-30T12:45:00.000Z"
        }
      ],
      v2_territories: [
        {
          id: "territory-1",
          tenant_id: "tenant-1",
          name: "Suffolk County",
          zip_codes: ["11788"],
          active: true
        }
      ],
      v2_data_sources: [
        {
          id: "source-row-1",
          tenant_id: "tenant-1",
          name: "NOAA Weather Alerts",
          source_type: "weather.noaa",
          reliability_score: 82,
          freshness_timestamp: "2026-03-30T11:50:00.000Z",
          terms_status: "approved",
          status: "active"
        }
      ],
      v2_connector_runs: [
        {
          id: "run-1",
          tenant_id: "tenant-1",
          source_id: "source-row-1",
          status: "completed",
          completed_at: "2026-03-30T11:55:00.000Z",
          records_seen: 12,
          records_created: 2,
          metadata: { connector_input_mode: "live_provider" }
        }
      ],
      v2_source_events: [
        {
          id: "source-1",
          tenant_id: "tenant-1",
          source_id: "source-row-1",
          connector_run_id: "run-1",
          source_name: "NOAA Weather Alerts",
          source_type: "weather.noaa",
          source_provenance: "api.weather.gov",
          compliance_status: "approved",
          data_freshness_score: 91,
          source_reliability_score: 82,
          connector_version: "1",
          normalized_payload: {
            connector_key: "weather.noaa",
            source_provenance: "api.weather.gov"
          },
          event_category: "weather_damage",
          service_line_candidates: ["restoration"],
          severity_hint: "high",
          urgency_hint: "high",
          event_timestamp: "2026-03-30T11:45:00.000Z",
          ingested_at: "2026-03-30T11:46:00.000Z"
        }
      ]
    }) as never,
    franchiseTenantId: "tenant-1"
  });

  expect(readModel.lead_quality_proof?.verified_lead_count).toBe(1);
  expect(readModel.lead_quality_proof?.booked_jobs_from_verified_leads).toBe(1);
  expect(readModel.lead_quality_proof?.proof_samples?.[0]?.contact_name).toBe("Taylor Lead");
  expect(readModel.lead_quality_proof?.proof_samples?.[0]?.proof_authenticity).toBe("live_provider");
  expect(readModel.capture_proof_summary).toEqual(
    expect.objectContaining({
      sourceEventsCaptured: 1,
      realSourceEventsCaptured: 1,
      opportunitiesCreated: 1,
      realOpportunitiesCaptured: 1,
      opportunitiesRequiringSdr: 0,
      qualifiedContactableOpportunities: 1,
      leadsCreated: 1,
      realLeadsCreated: 1,
      bookedJobsAttributed: 1
    })
  );
});
