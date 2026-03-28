import { expect, test } from "@playwright/test";
import {
  extractLeadContactCandidate,
  normalizeEmail,
  normalizePhone,
  verifyLeadContactCandidate
} from "../src/lib/v2/lead-verification";

test("lead verification normalizes phone/email safely", () => {
  expect(normalizePhone("(631) 555-0199")).toBe("+16315550199");
  expect(normalizePhone("1-516-222-8888")).toBe("+15162228888");
  expect(normalizePhone("abc")).toBeNull();

  expect(normalizeEmail("Ops@Example.org ")).toBe("ops@example.org");
  expect(normalizeEmail("invalid-email")).toBeNull();
});

test("lead verification extracts contact from source event payload", () => {
  const candidate = extractLeadContactCandidate({
    sourceEvent: {
      normalized_payload: {
        contact_name: "Harbor Property Group",
        contact_phone: "516-222-8888",
        contact_email: "ops@harborpm.com"
      }
    },
    opportunity: {
      title: "Commercial property alert"
    }
  });

  expect(candidate.name).toBe("Harbor Property Group");
  expect(candidate.phone).toBe("+15162228888");
  expect(candidate.email).toBe("ops@harborpm.com");
  expect(candidate.evidence.length).toBeGreaterThan(0);
});

test("lead verification rejects placeholder contact and verifies real contact", () => {
  const rejected = verifyLeadContactCandidate(
    {
      name: "Test Contact",
      phone: "+16315550123",
      email: "demo@example.com",
      provenance: "source:test",
      evidence: ["source:phone", "source:email"]
    },
    {
      sourceReliability: 80,
      freshnessScore: 85,
      hasMultiSignal: true,
      duplicatePhone: false,
      duplicateEmail: false,
      duplicateAddress: false
    }
  );

  expect(rejected.status).toBe("rejected");
  expect(rejected.contactable).toBeFalsy();

  const verified = verifyLeadContactCandidate(
    {
      name: "Harbor Property Group",
      phone: "+15162228888",
      email: "ops@harborpm.com",
      provenance: "source:overpass",
      evidence: ["source:phone", "source:email"]
    },
    {
      sourceReliability: 82,
      freshnessScore: 78,
      hasMultiSignal: true,
      duplicatePhone: false,
      duplicateEmail: false,
      duplicateAddress: false
    }
  );

  expect(verified.status).toBe("verified");
  expect(verified.score).toBeGreaterThanOrEqual(70);
  expect(verified.contactable).toBeTruthy();
});
