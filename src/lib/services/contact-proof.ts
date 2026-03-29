type ContactVerification = "verified" | "public-record";

export type VerifiedOwnerContact = {
  name: string | null;
  phone: string | null;
  email: string | null;
  verification: ContactVerification;
  confidenceLabel: string | null;
};

function cleanString(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeVerification(value: unknown): ContactVerification | null {
  const raw = cleanString(value)?.toLowerCase();
  if (raw === "verified") return "verified";
  if (raw === "public-record") return "public-record";
  return null;
}

export function extractVerifiedOwnerContactFromEnrichment(enrichment: unknown): VerifiedOwnerContact | null {
  if (!isRecord(enrichment) || enrichment.simulated === true) return null;

  const ownerContact = isRecord(enrichment.ownerContact) ? enrichment.ownerContact : null;
  if (!ownerContact) return null;

  const verification = normalizeVerification(ownerContact.verification);
  if (!verification) return null;

  const phone = cleanString(ownerContact.phone);
  const email = cleanString(ownerContact.email);
  if (!phone && !email) return null;

  return {
    name: cleanString(ownerContact.name),
    phone,
    email,
    verification,
    confidenceLabel: cleanString(ownerContact.confidenceLabel)
  };
}

export function hasVerifiedOwnerContact(enrichment: unknown) {
  return Boolean(extractVerifiedOwnerContactFromEnrichment(enrichment));
}
