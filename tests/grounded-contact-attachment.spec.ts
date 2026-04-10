import { expect, test } from "@playwright/test";
import { findGroundedLeadContactMatch, parseGroundedLeadContactCandidate } from "@/lib/v2/grounded-contact-attachment";

test("attaches grounded contact from same property and service line", () => {
  const result = findGroundedLeadContactMatch({
    address: "101 Atlantic Ave",
    city: "BROOKLYN",
    state: "NY",
    postalCode: "11201",
    serviceLine: "restoration",
    now: "2026-04-07T12:00:00.000Z",
    existingLeadContacts: [
      parseGroundedLeadContactCandidate(
        {
          id: "lead-1",
          contact_name: "Atlantic Bakery",
          property_address: "101 Atlantic Ave",
          city: "BROOKLYN",
          state: "NY",
          postal_code: "11201",
          created_at: "2026-04-03T12:00:00.000Z",
          lead_status: "verified",
          contact_channels_json: {
            phone: "7185551000",
            email: "ops@atlanticbakery.com",
            verification_status: "verified",
            verification_score: 91,
            contact_provenance: "crm:verified_call_back",
            contact_evidence: ["crm:verified_call_back"]
          }
        },
        "restoration"
      )
    ]
  });

  expect(result.status).toBe("attached");
  if (result.status !== "attached") return;
  expect(result.lead.phone).toBe("+17185551000");
  expect(result.lead.email).toBe("ops@atlanticbakery.com");
});

test("does not attach verified contact when service line does not match", () => {
  const result = findGroundedLeadContactMatch({
    address: "101 Atlantic Ave",
    city: "BROOKLYN",
    state: "NY",
    postalCode: "11201",
    serviceLine: "restoration",
    now: "2026-04-07T12:00:00.000Z",
    existingLeadContacts: [
      parseGroundedLeadContactCandidate(
        {
          id: "lead-2",
          contact_name: "Atlantic Bakery",
          property_address: "101 Atlantic Ave",
          city: "BROOKLYN",
          state: "NY",
          postal_code: "11201",
          created_at: "2026-04-03T12:00:00.000Z",
          lead_status: "verified",
          contact_channels_json: {
            phone: "7185552000",
            verification_status: "verified",
            verification_score: 85,
            contact_provenance: "crm:verified_call_back",
            contact_evidence: ["crm:verified_call_back"]
          }
        },
        "plumbing"
      )
    ]
  });

  expect(result.status).toBe("weak_match");
  if (result.status !== "weak_match") return;
  expect(result.reasonCode).toBe("contact_found_but_not_sufficiently_grounded");
  expect(result.lead?.phone).toBe("+17185552000");
});
