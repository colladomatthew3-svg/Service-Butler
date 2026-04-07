import { expect, test } from "@playwright/test";
import { convertOpportunityToJobV2 } from "../src/lib/v2/opportunity-conversion";

function createSupabaseMock() {
  const tables = {
    opportunities: [
      {
        id: "opp-1",
        tenant_id: "tenant-1",
        title: "Water emergency",
        service_line: "restoration",
        location_text: "Buffalo, NY 14201",
        postal_code: "14201",
        lifecycle_status: "assigned",
        contact_status: "identified",
        routing_status: "routed",
        explainability_json: {
          qualification_status: "qualified_contactable",
          verification_status: "verified",
          phone: "+17165550000",
          review_required: false,
          recommended_action_sla_minutes: 30
        }
      }
    ] as Array<Record<string, unknown>>,
    leads: [] as Array<Record<string, unknown>>,
    jobs: [] as Array<Record<string, unknown>>,
    assignments: [
      {
        id: "assignment-1",
        tenant_id: "tenant-1",
        opportunity_id: "opp-1",
        status: "pending_acceptance",
        lead_id: null,
        created_at: "2026-04-06T10:00:00.000Z"
      }
    ] as Array<Record<string, unknown>>
  };

  const supabase = {
    from(table: string) {
      if (table === "v2_opportunities") {
        return {
          select: () => {
            const state = { tenantId: "", opportunityId: "" };
            const builder = {
              eq: (field: string, value: unknown) => {
                if (field === "tenant_id") state.tenantId = String(value || "");
                if (field === "id") state.opportunityId = String(value || "");
                return builder;
              },
              maybeSingle: async () => ({
                data:
                  tables.opportunities.find(
                    (row) => String(row.tenant_id) === state.tenantId && String(row.id) === state.opportunityId
                  ) || null,
                error: null
              })
            };
            return builder;
          },
          update: (patch: Record<string, unknown>) => ({
            eq: (_field1: string, tenantId: unknown) => ({
              eq: async (_field2: string, opportunityId: unknown) => {
                const index = tables.opportunities.findIndex(
                  (row) => String(row.tenant_id) === String(tenantId) && String(row.id) === String(opportunityId)
                );
                if (index >= 0) tables.opportunities[index] = { ...tables.opportunities[index], ...patch };
                return { data: null, error: null };
              }
            })
          })
        };
      }

      if (table === "v2_leads") {
        return {
          select: () => {
            const state = { tenantId: "", opportunityId: "", leadId: "" };
            const builder = {
              eq: (field: string, value: unknown) => {
                if (field === "tenant_id") state.tenantId = String(value || "");
                if (field === "opportunity_id") state.opportunityId = String(value || "");
                if (field === "id") state.leadId = String(value || "");
                return builder;
              },
              order: () => builder,
              limit: async () => ({
                data: tables.leads.filter((row) => String(row.tenant_id) === state.tenantId),
                error: null
              }),
              maybeSingle: async () => ({
                data:
                  tables.leads.find((row) => {
                    if (state.leadId) return String(row.id) === state.leadId;
                    return String(row.tenant_id) === state.tenantId && String(row.opportunity_id) === state.opportunityId;
                  }) || null,
                error: null
              })
            };
            return builder;
          },
          update: (patch: Record<string, unknown>) => ({
            eq: async (_field: string, leadId: unknown) => {
              const index = tables.leads.findIndex((row) => String(row.id) === String(leadId));
              if (index >= 0) tables.leads[index] = { ...tables.leads[index], ...patch };
              return { data: null, error: null };
            }
          }),
          insert: (payload: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const row = { id: `lead-${tables.leads.length + 1}`, ...payload };
                tables.leads.push(row);
                return { data: row, error: null };
              }
            })
          })
        };
      }

      if (table === "v2_jobs") {
        return {
          select: () => ({
            eq: (_field1: string, tenantId: unknown) => ({
              eq: (_field2: string, leadId: unknown) => ({
                maybeSingle: async () => ({
                  data:
                    tables.jobs.find(
                      (row) => String(row.tenant_id) === String(tenantId) && String(row.lead_id) === String(leadId)
                    ) || null,
                  error: null
                })
              })
            })
          }),
          insert: (payload: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const row = { id: `job-${tables.jobs.length + 1}`, ...payload };
                tables.jobs.push(row);
                return { data: row, error: null };
              }
            })
          })
        };
      }

      if (table === "v2_assignments") {
        return {
          select: () => ({
            eq: (_field1: string, tenantId: unknown) => ({
              eq: (_field2: string, opportunityId: unknown) => ({
                in: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data:
                          tables.assignments.find(
                            (row) => String(row.tenant_id) === String(tenantId) && String(row.opportunity_id) === String(opportunityId)
                          ) || null,
                        error: null
                      })
                    })
                  })
                })
              })
            })
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async (_field: string, assignmentId: unknown) => {
              const index = tables.assignments.findIndex((row) => String(row.id) === String(assignmentId));
              if (index >= 0) tables.assignments[index] = { ...tables.assignments[index], ...patch };
              return { data: null, error: null };
            }
          })
        };
      }

      throw new Error(`Unhandled table ${table}`);
    }
  };

  return { supabase: supabase as never, tables };
}

test("convert opportunity to job creates lead + job and closes assignment", async () => {
  const { supabase, tables } = createSupabaseMock();

  const result = await convertOpportunityToJobV2({
    supabase,
    tenantId: "tenant-1",
    opportunityId: "opp-1",
    actorUserId: "user-1"
  });

  expect(result.created).toBeTruthy();
  expect(result.leadId).toBe("lead-1");
  expect(result.jobId).toBe("job-1");
  expect(result.assignmentUpdated).toBeTruthy();
  expect(String(tables.opportunities[0]?.lifecycle_status)).toBe("booked_job");
  expect(String(tables.assignments[0]?.status)).toBe("complete");
});

test("convert opportunity to job is idempotent when lead/job already exist", async () => {
  const { supabase, tables } = createSupabaseMock();
  tables.leads.push({ id: "lead-existing", tenant_id: "tenant-1", opportunity_id: "opp-1" });
  tables.jobs.push({ id: "job-existing", tenant_id: "tenant-1", lead_id: "lead-existing", status: "booked" });

  const result = await convertOpportunityToJobV2({
    supabase,
    tenantId: "tenant-1",
    opportunityId: "opp-1",
    actorUserId: "user-1"
  });

  expect(result.created).toBeFalsy();
  expect(result.leadId).toBe("lead-existing");
  expect(result.jobId).toBe("job-existing");
  expect(tables.leads).toHaveLength(1);
  expect(tables.jobs).toHaveLength(1);
});

test("convert opportunity to job reuses matching lead by verified phone and updates evidence", async () => {
  const { supabase, tables } = createSupabaseMock();
  tables.leads.push({
    id: "lead-existing",
    tenant_id: "tenant-1",
    opportunity_id: null,
    property_address: "Buffalo, NY 14201",
    city: "Buffalo",
    state: "NY",
    postal_code: "14201",
    created_at: "2026-04-06T09:00:00.000Z",
    contact_channels_json: {
      phone: "+17165550000",
      verification_status: "verified",
      verification_score: 92,
      contact_evidence: ["phone"]
    }
  });

  const result = await convertOpportunityToJobV2({
    supabase,
    tenantId: "tenant-1",
    opportunityId: "opp-1",
    actorUserId: "user-1"
  });

  expect(result.leadId).toBe("lead-existing");
  expect(tables.leads).toHaveLength(1);
  expect(String(tables.leads[0]?.opportunity_id)).toBe("opp-1");
  expect((tables.leads[0]?.contact_channels_json as Record<string, unknown>).contact_evidence).toEqual(
    expect.arrayContaining(["phone", "conversion"])
  );
});

test("convert opportunity to job blocks review-required opportunities", async () => {
  const { supabase, tables } = createSupabaseMock();
  tables.opportunities[0] = {
    ...tables.opportunities[0],
    explainability_json: {
      qualification_status: "queued_for_sdr",
      review_required: true
    }
  };

  await expect(
    convertOpportunityToJobV2({
      supabase,
      tenantId: "tenant-1",
      opportunityId: "opp-1",
      actorUserId: "user-1"
    })
  ).rejects.toThrow(/requires review/i);
});
