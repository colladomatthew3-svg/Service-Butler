import { expect, test } from "@playwright/test";
import {
  extractVerifiedOwnerContactFromEnrichment,
  hasVerifiedOwnerContact
} from "@/lib/services/contact-proof";

test("contact proof accepts verified owner contact records", () => {
  const enrichment = {
    simulated: false,
    ownerContact: {
      name: "Jordan Brooks",
      phone: "+16315550142",
      email: "jordan@example.com",
      verification: "verified",
      confidenceLabel: "Verified owner contact"
    }
  };

  expect(hasVerifiedOwnerContact(enrichment)).toBeTruthy();
  expect(extractVerifiedOwnerContactFromEnrichment(enrichment)).toEqual({
    name: "Jordan Brooks",
    phone: "+16315550142",
    email: "jordan@example.com",
    verification: "verified",
    confidenceLabel: "Verified owner contact"
  });
});

test("contact proof rejects demo or simulated owner contact records", () => {
  const enrichment = {
    simulated: true,
    ownerContact: {
      name: "Illustrative Contact",
      phone: "+16315550142",
      verification: "demo",
      confidenceLabel: "Illustrative preview only"
    }
  };

  expect(hasVerifiedOwnerContact(enrichment)).toBeFalsy();
  expect(extractVerifiedOwnerContactFromEnrichment(enrichment)).toBeNull();
});

test("contact proof rejects records without a usable channel", () => {
  const enrichment = {
    simulated: false,
    ownerContact: {
      name: "Public Record Owner",
      phone: "",
      email: "",
      verification: "public-record"
    }
  };

  expect(hasVerifiedOwnerContact(enrichment)).toBeFalsy();
  expect(extractVerifiedOwnerContactFromEnrichment(enrichment)).toBeNull();
});
