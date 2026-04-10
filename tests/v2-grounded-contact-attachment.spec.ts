import { expect, test } from "@playwright/test";
import { findGroundedLeadContactMatch } from "@/lib/v2/grounded-contact-attachment";

test("grounded contact attachment reuses a recent verified lead at the same property and service line", () => {
  const match = findGroundedLeadContactMatch({
    address: "101 Atlantic Ave",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11201",
    serviceLine: "restoration",
    now: "2026-04-07T10:00:00.000Z",
    existingLeadContacts: [
      {
        leadId: "lead-1",
        opportunityId: "opp-1",
        contactName: "Atlantic Owner",
        phone: "+17185550199",
        email: null,
        address: "101 Atlantic Ave",
        city: "BROOKLYN",
        state: "NY",
        postalCode: "11201",
        serviceLine: "restoration",
        createdAt: "2026-04-01T12:00:00.000Z",
        verificationStatus: "verified",
        verificationScore: 90,
        contactProvenance: "scanner_sdr",
        contactEvidence: ["sdr:callback"],
        doNotContact: false
      }
    ]
  });

  expect(match.status).toBe("attached");
  if (match.status !== "attached") throw new Error("Expected attached result");
  expect(match.lead.leadId).toBe("lead-1");
  expect(match.reasonCode).toBe("historical_verified_contact");
});

test("grounded contact attachment rejects verified property contacts when the service line does not match", () => {
  const match = findGroundedLeadContactMatch({
    address: "101 Atlantic Ave",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11201",
    serviceLine: "restoration",
    now: "2026-04-07T10:00:00.000Z",
    existingLeadContacts: [
      {
        leadId: "lead-2",
        opportunityId: "opp-2",
        contactName: "Atlantic Owner",
        phone: "+17185550199",
        email: null,
        address: "101 Atlantic Ave",
        city: "BROOKLYN",
        state: "NY",
        postalCode: "11201",
        serviceLine: "plumbing",
        createdAt: "2026-04-01T12:00:00.000Z",
        verificationStatus: "verified",
        verificationScore: 90,
        contactProvenance: "scanner_sdr",
        contactEvidence: ["sdr:callback"],
        doNotContact: false
      }
    ]
  });

  expect(match.status).toBe("weak_match");
  expect(match.reasonCode).toBe("contact_found_but_not_sufficiently_grounded");
});

test("grounded contact attachment ignores stale or unverified historical leads", () => {
  const match = findGroundedLeadContactMatch({
    address: "101 Atlantic Ave",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11201",
    serviceLine: "restoration",
    now: "2026-04-07T10:00:00.000Z",
    existingLeadContacts: [
      {
        leadId: "lead-3",
        opportunityId: "opp-3",
        contactName: "Atlantic Owner",
        phone: "+17185550199",
        email: null,
        address: "101 Atlantic Ave",
        city: "BROOKLYN",
        state: "NY",
        postalCode: "11201",
        serviceLine: "restoration",
        createdAt: "2025-12-01T12:00:00.000Z",
        verificationStatus: "verified",
        verificationScore: 90,
        contactProvenance: "scanner_sdr",
        contactEvidence: ["sdr:callback"],
        doNotContact: false
      },
      {
        leadId: "lead-4",
        opportunityId: "opp-4",
        contactName: "Atlantic Owner",
        phone: "+17185550198",
        email: null,
        address: "101 Atlantic Ave",
        city: "BROOKLYN",
        state: "NY",
        postalCode: "11201",
        serviceLine: "restoration",
        createdAt: "2026-04-02T12:00:00.000Z",
        verificationStatus: "review",
        verificationScore: 65,
        contactProvenance: "scanner_sdr",
        contactEvidence: ["sdr:callback"],
        doNotContact: false
      }
    ]
  });

  expect(match.status).toBe("missing");
  expect(match.reasonCode).toBe("missing_verified_contact");
});
