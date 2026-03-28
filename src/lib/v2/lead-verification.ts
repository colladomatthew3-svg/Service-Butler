type ContactFields = {
  name: string | null;
  phone: string | null;
  email: string | null;
};

type CandidateContext = {
  sourceReliability: number;
  freshnessScore: number;
  hasMultiSignal: boolean;
  duplicatePhone: boolean;
  duplicateEmail: boolean;
  duplicateAddress: boolean;
};

export type LeadContactCandidate = ContactFields & {
  provenance: string;
  evidence: string[];
};

export type LeadVerificationStatus = "verified" | "review" | "rejected";

export type LeadVerificationResult = ContactFields & {
  status: LeadVerificationStatus;
  score: number;
  contactable: boolean;
  reasons: string[];
  provenance: string;
  evidence: string[];
};

const NAME_PLACEHOLDERS = new Set(["", "unknown", "n/a", "none", "demo", "sample", "test"]);

function toText(value: unknown) {
  return String(value || "").trim();
}

function lower(value: unknown) {
  return toText(value).toLowerCase();
}

function isPlaceholderName(value: string) {
  const normalized = lower(value).replace(/\./g, "");
  return NAME_PLACEHOLDERS.has(normalized);
}

function isPlaceholderPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return true;
  if (digits.includes("5550") || digits.startsWith("1555") || digits.startsWith("555")) return true;
  if (/^(\d)\1+$/.test(digits)) return true;
  return false;
}

function isPlaceholderEmail(value: string) {
  const email = lower(value);
  return (
    email.endsWith("@example.com") ||
    email.endsWith("@example.org") ||
    email.endsWith("@test.com") ||
    email.endsWith("@demo.com") ||
    email.includes("noreply@")
  );
}

export function normalizePhone(raw: unknown) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function normalizeEmail(raw: unknown) {
  const email = lower(raw);
  if (!email) return null;
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return valid ? email : null;
}

function getByPath(input: Record<string, unknown>, path: string) {
  const parts = path.split(".");
  let cursor: unknown = input;
  for (const part of parts) {
    if (!cursor || typeof cursor !== "object") return null;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor ?? null;
}

function pickFirst(input: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = toText(getByPath(input, path));
    if (value) return value;
  }
  return "";
}

export function extractLeadContactCandidate(input: {
  sourceEvent?: Record<string, unknown> | null;
  opportunity?: Record<string, unknown> | null;
  enrichmentContact?: Partial<ContactFields> | null;
}): LeadContactCandidate {
  const normalized = ((input.sourceEvent?.normalized_payload || {}) as Record<string, unknown>) || {};
  const raw = ((input.sourceEvent?.raw_payload || {}) as Record<string, unknown>) || {};
  const opportunity = input.opportunity || {};

  const merged = {
    ...raw,
    ...normalized,
    raw,
    normalized,
    tags:
      (normalized.tags as Record<string, unknown> | undefined) ||
      (raw.tags as Record<string, unknown> | undefined) ||
      {}
  } as Record<string, unknown>;

  const candidateName = pickFirst(merged, [
    "owner_name",
    "ownerName",
    "contact_name",
    "contactName",
    "applicant_name",
    "contractor_name",
    "business_name",
    "tags.name",
    "name"
  ]);
  const candidatePhone = pickFirst(merged, [
    "owner_phone",
    "contact_phone",
    "applicant_phone",
    "contractor_phone",
    "phone",
    "telephone",
    "mobile",
    "tags.phone",
    "tags.contact:phone"
  ]);
  const candidateEmail = pickFirst(merged, [
    "owner_email",
    "contact_email",
    "applicant_email",
    "contractor_email",
    "email",
    "tags.email",
    "tags.contact:email"
  ]);

  const fromEnrichment = input.enrichmentContact || {};
  const name = toText(candidateName || fromEnrichment.name || opportunity["contact_name"]);
  const phone = normalizePhone(candidatePhone || fromEnrichment.phone);
  const email = normalizeEmail(candidateEmail || fromEnrichment.email);

  const evidence = [
    candidateName ? "source:name" : "",
    candidatePhone ? "source:phone" : "",
    candidateEmail ? "source:email" : "",
    fromEnrichment.name || fromEnrichment.phone || fromEnrichment.email ? "enrichment:contact" : ""
  ].filter(Boolean);

  return {
    name: name && !isPlaceholderName(name) ? name : null,
    phone,
    email,
    provenance: evidence.length > 0 ? evidence.join(",") : "none",
    evidence
  };
}

export function verifyLeadContactCandidate(candidate: LeadContactCandidate, context: CandidateContext): LeadVerificationResult {
  const reasons: string[] = [];
  let score = 0;

  const phoneValid = Boolean(candidate.phone) && !isPlaceholderPhone(String(candidate.phone));
  const emailValid = Boolean(candidate.email) && !isPlaceholderEmail(String(candidate.email));
  const nameValid = Boolean(candidate.name) && !isPlaceholderName(String(candidate.name));

  if (phoneValid) {
    score += 46;
    reasons.push("valid phone");
  } else if (candidate.phone) {
    score -= 22;
    reasons.push("placeholder/invalid phone");
  } else {
    reasons.push("phone missing");
  }

  if (emailValid) {
    score += 32;
    reasons.push("valid email");
  } else if (candidate.email) {
    score -= 16;
    reasons.push("placeholder/invalid email");
  } else {
    reasons.push("email missing");
  }

  if (phoneValid && emailValid) {
    score += 8;
    reasons.push("multi-channel contact");
  }

  if (nameValid) {
    score += 8;
    reasons.push("contact name present");
  }

  if (context.sourceReliability >= 72) {
    score += 8;
    reasons.push(`source reliability ${context.sourceReliability}`);
  } else if (context.sourceReliability >= 55) {
    score += 4;
    reasons.push(`source reliability moderate ${context.sourceReliability}`);
  }

  if (context.freshnessScore >= 60) {
    score += 6;
    reasons.push(`freshness ${context.freshnessScore}`);
  } else if (context.freshnessScore >= 35) {
    score += 3;
    reasons.push(`freshness moderate ${context.freshnessScore}`);
  } else {
    reasons.push(`stale freshness ${context.freshnessScore}`);
  }

  if (context.hasMultiSignal) {
    score += 6;
    reasons.push("multi-signal agreement");
  }

  if (context.duplicatePhone) {
    score -= 35;
    reasons.push("duplicate phone");
  }
  if (context.duplicateEmail) {
    score -= 26;
    reasons.push("duplicate email");
  }
  if (context.duplicateAddress) {
    score -= 10;
    reasons.push("duplicate address");
  }

  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  const contactable = phoneValid || emailValid;

  let status: LeadVerificationStatus = "rejected";
  if (contactable && bounded >= 70 && !context.duplicatePhone && !context.duplicateEmail) {
    status = "verified";
  } else if (contactable && bounded >= 45) {
    status = "review";
  }

  return {
    status,
    score: bounded,
    contactable,
    reasons,
    provenance: candidate.provenance,
    evidence: candidate.evidence,
    name: nameValid ? candidate.name : null,
    phone: phoneValid ? candidate.phone : null,
    email: emailValid ? candidate.email : null
  };
}
