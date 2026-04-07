import { expect, test } from "@playwright/test";
import { findLeadMatch, mergeContactChannels } from "../src/lib/v2/lead-matching";

test("lead matching reuses exact opportunity match without forcing update", () => {
  const result = findLeadMatch({
    existing: [
      {
        id: "lead-1",
        opportunityId: "opp-1",
        phone: "+17165550000",
        address: "123 Main St",
        city: "Buffalo",
        state: "NY",
        postalCode: "14201",
        serviceType: "Restoration",
        createdAt: "2026-04-06T10:00:00.000Z"
      }
    ],
    incoming: {
      opportunityId: "opp-1",
      phone: "+17165550000",
      address: "123 Main St",
      city: "Buffalo",
      state: "NY",
      postalCode: "14201",
      serviceType: "Restoration"
    }
  });

  expect(result.outcome).toBe("reuse_existing");
  expect(result.matchedLeadId).toBe("lead-1");
  expect(result.shouldUpdate).toBeFalsy();
});

test("lead matching reuses verified phone duplicates", () => {
  const result = findLeadMatch({
    existing: [
      {
        id: "lead-1",
        phone: "(716) 555-0000",
        address: "123 Main St",
        city: "Buffalo",
        state: "NY",
        postalCode: "14201",
        serviceType: "Restoration",
        createdAt: "2026-04-06T10:00:00.000Z"
      }
    ],
    incoming: {
      phone: "+17165550000",
      address: "123 Main St",
      city: "Buffalo",
      state: "NY",
      postalCode: "14201",
      serviceType: "Restoration"
    }
  });

  expect(result.matchedBy).toBe("phone");
  expect(result.shouldUpdate).toBeTruthy();
});

test("lead matching does not over-merge same zip and service when verified phone conflicts", () => {
  const result = findLeadMatch({
    existing: [
      {
        id: "lead-1",
        phone: "+17165550000",
        address: "123 Main St",
        city: "Buffalo",
        state: "NY",
        postalCode: "14201",
        serviceType: "Restoration",
        createdAt: "2026-04-06T10:00:00.000Z"
      }
    ],
    incoming: {
      phone: "+17165550111",
      address: "123 Main St",
      city: "Buffalo",
      state: "NY",
      postalCode: "14201",
      serviceType: "Restoration"
    }
  });

  expect(result.outcome).toBe("create_new");
});

test("merge contact channels preserves stronger verification while appending evidence", () => {
  const merged = mergeContactChannels(
    {
      phone: "+17165550000",
      verification_status: "verified",
      verification_score: 92,
      verification_reasons: ["source:phone"],
      contact_evidence: ["phone"]
    },
    {
      email: "owner@example.com",
      verification_status: "review",
      verification_score: 70,
      verification_reasons: ["source:email"],
      contact_evidence: ["email"],
      dedupe_reasons: ["reused existing lead by verified phone +17165550000"]
    }
  );

  expect(merged.verification_status).toBe("verified");
  expect(merged.verification_score).toBe(92);
  expect(merged.contact_evidence).toEqual(expect.arrayContaining(["phone", "email"]));
  expect(merged.dedupe_reasons).toEqual(expect.arrayContaining(["reused existing lead by verified phone +17165550000"]));
});
