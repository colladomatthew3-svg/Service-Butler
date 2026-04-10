import { expect, test } from "@playwright/test";
import { deriveDispatchableLeadCandidate } from "@/lib/v2/dispatchable-leads";

const NOW = new Date("2026-04-07T12:00:00.000Z").getTime();

function buildLiveSafeSource() {
  return {
    id: "source-1",
    source_type: "open311",
    name: "NYC Open311",
    status: "active",
    terms_status: "approved",
    compliance_status: "approved",
    rollout_state: "pilot",
    readiness_status: "pass",
    health_status: "ok",
    freshness_timestamp: "2026-04-07T11:30:00.000Z",
    freshness_sla_minutes: 180,
    provenance: "open311.public.api"
  };
}

test("dispatchable candidate requires live-safe recent verified contact data", () => {
  const candidate = deriveDispatchableLeadCandidate({
    nowMs: NOW,
    opportunity: {
      id: "opp-1",
      title: "Basement flood complaint",
      service_line: "restoration",
      location_text: "Brooklyn, NY 11201",
      lifecycle_status: "new",
      routing_status: "pending",
      contact_status: "identified",
      source_reliability_score: 88,
      created_at: "2026-04-07T11:35:00.000Z",
      explainability_json: {
        qualification_status: "qualified_contactable",
        verification_status: "verified",
        phone: "+1 718-555-1111",
        contact_name: "Red Hook Bakery",
        source_type: "open311",
        source_event_id: "event-1"
      }
    },
    sourceEvent: {
      id: "event-1",
      source_id: "source-1",
      source_type: "open311",
      source_name: "NYC Open311",
      source_provenance: "open311.public.api",
      occurred_at: "2026-04-07T11:00:00.000Z",
      ingested_at: "2026-04-07T11:10:00.000Z",
      compliance_status: "approved",
      normalized_payload: {
        source_type: "open311"
      }
    },
    source: buildLiveSafeSource()
  });

  expect(candidate.dispatch_eligible).toBeTruthy();
  expect(candidate.blocked_reason).toBeNull();
  expect(candidate.business_name).toBe("Red Hook Bakery");
  expect(candidate.contact_provenance).toBeNull();
});

test("synthetic or validation-backed rows are excluded from dispatchable leads", () => {
  const candidate = deriveDispatchableLeadCandidate({
    nowMs: NOW,
    opportunity: {
      id: "opp-2",
      title: "Seeded demo permit",
      service_line: "restoration",
      location_text: "Queens, NY 11368",
      lifecycle_status: "new",
      routing_status: "pending",
      contact_status: "identified",
      created_at: "2026-04-07T11:35:00.000Z",
      explainability_json: {
        qualification_status: "qualified_contactable",
        verification_status: "verified",
        phone: "+1 718-555-2222",
        contact_name: "Demo Lead",
        source_type: "scanner_signal",
        source_event_id: "event-2",
        integration_validation: true
      }
    },
    sourceEvent: {
      id: "event-2",
      source_id: "source-2",
      source_type: "scanner_signal",
      source_name: "Scanner Validation",
      source_provenance: "operator.synthetic.permits",
      occurred_at: "2026-04-07T11:00:00.000Z",
      compliance_status: "approved",
      normalized_payload: {
        source_type: "scanner_signal",
        source_provenance: "operator.synthetic.permits"
      }
    },
    source: {
      ...buildLiveSafeSource(),
      id: "source-2",
      source_type: "scanner_signal",
      name: "Validation source",
      provenance: "operator.synthetic.permits"
    }
  });

  expect(candidate.dispatch_eligible).toBeFalsy();
  expect(candidate.blocked_reason).toContain("synthetic/test");
});

test("recent real candidates without verified contact stay blocked with a clear reason", () => {
  const candidate = deriveDispatchableLeadCandidate({
    nowMs: NOW,
    opportunity: {
      id: "opp-3",
      title: "Water damage report",
      service_line: "restoration",
      location_text: "Bronx, NY 10451",
      lifecycle_status: "new",
      routing_status: "pending",
      contact_status: "unknown",
      created_at: "2026-04-07T11:35:00.000Z",
      explainability_json: {
        qualification_status: "research_only",
        verification_status: "review",
        source_type: "open311",
        source_event_id: "event-3"
      }
    },
    sourceEvent: {
      id: "event-3",
      source_id: "source-1",
      source_type: "open311",
      source_name: "NYC Open311",
      source_provenance: "open311.public.api",
      occurred_at: "2026-04-07T11:00:00.000Z",
      compliance_status: "approved",
      normalized_payload: {
        source_type: "open311"
      }
    },
    source: buildLiveSafeSource()
  });

  expect(candidate.dispatch_eligible).toBeFalsy();
  expect(candidate.blocked_reason).toContain("verified phone or email");
});

test("recent real candidates with ungrounded contact show a stronger blocked reason", () => {
  const candidate = deriveDispatchableLeadCandidate({
    nowMs: NOW,
    opportunity: {
      id: "opp-4",
      title: "Water damage report",
      service_line: "restoration",
      location_text: "Bronx, NY 10451",
      lifecycle_status: "new",
      routing_status: "pending",
      contact_status: "unknown",
      created_at: "2026-04-07T11:35:00.000Z",
      explainability_json: {
        qualification_status: "research_only",
        qualification_reason_code: "contact_found_but_not_sufficiently_grounded",
        verification_status: "review",
        source_type: "open311",
        source_event_id: "event-4",
        contact_attachment_status: "insufficient_grounding",
        qualification_contact: {
          contact_name: "Bronx Bakery",
          phone: "+17185552000",
          verification_status: "review"
        }
      }
    },
    sourceEvent: {
      id: "event-4",
      source_id: "source-1",
      source_type: "open311",
      source_name: "NYC Open311",
      source_provenance: "open311.public.api",
      occurred_at: "2026-04-07T11:00:00.000Z",
      compliance_status: "approved",
      normalized_payload: {
        source_type: "open311"
      }
    },
    source: buildLiveSafeSource()
  });

  expect(candidate.dispatch_eligible).toBeFalsy();
  expect(candidate.blocked_reason).toContain("provenance is not strong enough");
});

test("operator surface distinguishes ungrounded contact from missing contact", () => {
  const candidate = deriveDispatchableLeadCandidate({
    nowMs: NOW,
    opportunity: {
      id: "opp-4",
      title: "Water damage report",
      service_line: "restoration",
      location_text: "Bronx, NY 10451",
      lifecycle_status: "new",
      routing_status: "pending",
      contact_status: "unknown",
      created_at: "2026-04-07T11:35:00.000Z",
      explainability_json: {
        qualification_status: "research_only",
        qualification_reason_code: "source_contact_unverified",
        qualification_source: "source_payload_contact",
        verification_status: "review",
        phone: "+1 718-555-3333",
        source_type: "open311",
        source_event_id: "event-4",
        contact_attachment_status: "insufficient_grounding",
        contact_attachment_provenance: "source:name,source:phone"
      }
    },
    sourceEvent: {
      id: "event-4",
      source_id: "source-1",
      source_type: "open311",
      source_name: "NYC Open311",
      source_provenance: "open311.public.api",
      occurred_at: "2026-04-07T11:00:00.000Z",
      compliance_status: "approved",
      normalized_payload: {
        source_type: "open311"
      }
    },
    source: buildLiveSafeSource()
  });

  expect(candidate.dispatch_eligible).toBeFalsy();
  expect(candidate.contact_attachment_status).toBe("insufficient_grounding");
  expect(candidate.contact_provenance).toBe("source:name,source:phone");
  expect(candidate.contact_grounded_reason).toBeNull();
  expect(candidate.blocked_reason).toContain("provenance is not strong enough");
});

test("operator surface exposes grounded permit contact provenance and reason", () => {
  const candidate = deriveDispatchableLeadCandidate({
    nowMs: NOW,
    opportunity: {
      id: "opp-5",
      title: "DOB permit",
      service_line: "restoration",
      location_text: "Queens, NY 11432",
      lifecycle_status: "new",
      routing_status: "pending",
      contact_status: "identified",
      created_at: "2026-04-07T11:35:00.000Z",
      explainability_json: {
        qualification_status: "qualified_contactable",
        qualification_reason_code: "verified_contact_attached_from_dob_license",
        qualification_source: "official_dob_license_info",
        verification_status: "verified",
        phone: "+15164354570",
        contact_name: "RISHON HOMES CORP",
        source_type: "permits",
        source_event_id: "event-5",
        contact_attachment_status: "grounded_attached",
        contact_attachment_provenance: "https://data.cityofnewyork.us/Housing-Development/DOB-License-Info/t8hj-ruu2#license_number=625287&license_type=GENERAL%20CONTRACTOR",
        contact_grounded_reason: "Attached phone/email from official DOB License Info using exact permit applicant license and license type."
      }
    },
    sourceEvent: {
      id: "event-5",
      source_id: "source-5",
      source_type: "permits",
      source_name: "NYC DOB NOW Approved Permits",
      source_provenance: "https://data.cityofnewyork.us/Housing-Development/DOB-NOW-Build-Approved-Permits/rbx6-tga4",
      occurred_at: "2026-04-07T11:00:00.000Z",
      compliance_status: "approved",
      normalized_payload: {
        source_type: "permits"
      }
    },
    source: {
      ...buildLiveSafeSource(),
      id: "source-5",
      source_type: "permits",
      name: "NYC DOB NOW Approved Permits",
      provenance: "https://data.cityofnewyork.us/Housing-Development/DOB-NOW-Build-Approved-Permits/rbx6-tga4"
    }
  });

  expect(candidate.dispatch_eligible).toBeTruthy();
  expect(candidate.contact_provenance).toContain("DOB-License-Info");
  expect(candidate.contact_grounded_reason).toContain("exact permit applicant license");
});
