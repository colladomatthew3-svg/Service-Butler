import { expect, test } from "@playwright/test";
import {
  buildPermitFirstTouchSms,
  deriveDispatchableLeadOutreachSummary,
  triggerDispatchableLeadOutreach
} from "../src/lib/v2/dispatchable-outreach";
import type { DispatchableLeadCandidate } from "../src/lib/v2/dispatchable-leads";

function buildCandidate(overrides: Partial<DispatchableLeadCandidate> = {}): DispatchableLeadCandidate {
  return {
    id: "opp-1",
    title: "Permit lead",
    business_name: "RISHON HOMES CORP",
    phone: "+15164354570",
    email: null,
    location: "90-22 196 STREET, Queens, NY 11432",
    source: "Municipal Permits Feed",
    source_type: "permits",
    service_signal: "restoration",
    timestamp: "2026-04-10T12:00:00.000Z",
    age_hours: 1,
    confidence_score: 88,
    trust_status: "Dispatchable live lead",
    qualification_status: "qualified_contactable",
    verification_status: "verified",
    contact_provenance: "dob-license",
    contact_attachment_status: "grounded_attached",
    contact_grounded_reason: "Exact permit applicant license matched to official DOB License Info.",
    outreach_eligible: true,
    outreach_blocked_reason: null,
    outreach_channel: null,
    outreach_status: null,
    outreach_send_mode: null,
    outreach_last_sent_at: null,
    follow_up_state: "dispatchable",
    dispatch_eligible: true,
    blocked_reason: null,
    counts_as_real_capture: true,
    review_required: false,
    assignment_status: null,
    ...overrides
  };
}

test("dispatchable permit lead with verified phone is outreach eligible", () => {
  const summary = deriveDispatchableLeadOutreachSummary({
    candidate: buildCandidate(),
    opportunity: { id: "opp-1", lifecycle_status: "new", explainability_json: {} }
  });

  expect(summary.outreach_eligible).toBeTruthy();
  expect(summary.outreach_channel).toBe("sms");
  expect(summary.follow_up_state).toBe("dispatchable");
});

test("blocked permit lead is not outreach eligible", () => {
  const summary = deriveDispatchableLeadOutreachSummary({
    candidate: buildCandidate({ dispatch_eligible: false, blocked_reason: "Blocked: no verified phone or email is available." }),
    opportunity: { id: "opp-1", lifecycle_status: "new", explainability_json: {} }
  });

  expect(summary.outreach_eligible).toBeFalsy();
  expect(summary.outreach_blocked_reason).toBe("not_dispatchable");
});

test("recent outreach triggers cooling window block", () => {
  const summary = deriveDispatchableLeadOutreachSummary({
    candidate: buildCandidate(),
    opportunity: {
      id: "opp-1",
      lifecycle_status: "contacted",
      explainability_json: {
        outreach_last_status: "sent",
        outreach_last_sent_at: new Date().toISOString()
      }
    }
  });

  expect(summary.outreach_eligible).toBeFalsy();
  expect(summary.outreach_blocked_reason).toBe("already_contacted_recently");
});

test("dispatchable outreach creates lead, persists safe-mode send, and marks opportunity contacted", async () => {
  const touched: Array<{ table: string; action: string; payload?: unknown }> = [];
  const state = {
    leads: [] as Array<Record<string, unknown>>,
    opportunities: [{ id: "opp-1", lifecycle_status: "new", explainability_json: {}, location_text: "90-22 196 STREET", postal_code: "11432" }],
    outreach: [] as Array<Record<string, unknown>>
  };

  const supabaseMock = {
    from(table: string) {
      if (table === "v2_leads") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: state.leads[0] || null, error: null }),
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: state.leads[0] || null, error: null })
                  })
                })
              })
            })
          }),
          insert: (payload: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const row = { id: "lead-1", ...payload };
                state.leads.push(row);
                touched.push({ table, action: "insert", payload });
                return { data: row, error: null };
              }
            })
          })
        };
      }

      if (table === "v2_outreach_events") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  in: () => ({
                    gte: async () => ({ count: 0, error: null })
                  }),
                  gte: async () => ({ count: 0, error: null })
                })
              })
            })
          }),
          insert: async (payload: Record<string, unknown>) => {
            state.outreach.push(payload);
            touched.push({ table, action: "insert", payload });
            return { data: null, error: null };
          }
        };
      }

      if (table === "v2_opportunities") {
        return {
          update: (payload: Record<string, unknown>) => ({
            eq: (_field: string, _value: unknown) => ({
              eq: async (_field2: string, _value2: unknown) => {
                state.opportunities[0] = { ...state.opportunities[0], ...payload };
                touched.push({ table, action: "update", payload });
                return { data: null, error: null };
              }
            })
          })
        };
      }

      if (table === "v2_suppression_list") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null })
                })
              })
            })
          })
        };
      }

      if (table === "v2_audit_logs") {
        return {
          insert: async () => ({ data: null, error: null })
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }
  };

  const prev = {
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    phone: process.env.TWILIO_PHONE_NUMBER,
    safe: process.env.SB_TWILIO_SAFE_MODE,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY
  };

  process.env.TWILIO_ACCOUNT_SID = "";
  process.env.TWILIO_AUTH_TOKEN = "";
  process.env.TWILIO_PHONE_NUMBER = "";
  process.env.SB_TWILIO_SAFE_MODE = "true";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

  try {
    const result = await triggerDispatchableLeadOutreach({
      supabase: supabaseMock as never,
      tenantId: "tenant-1",
      actorUserId: "user-1",
      actorResolutionSource: "tenant_operator_fallback",
      franchiseVertical: "home_services",
      opportunity: state.opportunities[0],
      candidate: buildCandidate()
    });

    expect("blocked" in result ? result.blocked : false).toBeFalsy();
    expect(result.sent).toBeTruthy();
    if (!("sendMode" in result)) throw new Error("Expected sendMode on outreach result");
    expect(result.sendMode).toBe("review_safe");
    expect(state.leads).toHaveLength(1);
    expect(state.outreach.length).toBe(2);
    expect(String((state.outreach[1].metadata as Record<string, unknown>).actor_resolution_source)).toBe("tenant_operator_fallback");
    expect((state.opportunities[0].lifecycle_status as string)).toBe("contacted");
    expect(String((state.opportunities[0].explainability_json as Record<string, unknown>).outreach_last_send_mode)).toBe("review_safe");
    expect(String((state.opportunities[0].explainability_json as Record<string, unknown>).outreach_actor_resolution_source)).toBe("tenant_operator_fallback");
  } finally {
    process.env.TWILIO_ACCOUNT_SID = prev.sid;
    process.env.TWILIO_AUTH_TOKEN = prev.token;
    process.env.TWILIO_PHONE_NUMBER = prev.phone;
    process.env.SB_TWILIO_SAFE_MODE = prev.safe;
    process.env.NEXT_PUBLIC_SUPABASE_URL = prev.supabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = prev.serviceRole;
  }
});

test("permit outreach SMS copy stays permit-specific and operator-safe", () => {
  const message = buildPermitFirstTouchSms({
    businessName: "RISHON HOMES CORP",
    location: "90-22 196 STREET",
    serviceSignal: "restoration",
    verticalKey: "home_services"
  });

  expect(message).toContain("permit activity");
  expect(message).toContain("Reply STOP to opt out.");
});
