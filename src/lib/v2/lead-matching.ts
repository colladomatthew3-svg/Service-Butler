type MatchOutcome = "create_new" | "reuse_existing" | "reuse_and_update";

type LeadMatchRecord = {
  id: string;
  opportunityId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  serviceType?: string | null;
  createdAt?: string | null;
  verificationStatus?: string | null;
  verificationScore?: number | null;
  evidence?: string[];
  reasons?: string[];
  raw?: Record<string, unknown>;
};

export type LeadMatchCandidate = {
  opportunityId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  serviceType?: string | null;
  verificationStatus?: string | null;
  verificationScore?: number | null;
  evidence?: string[];
  reasons?: string[];
  now?: string | Date;
};

export type LeadMatchResult = {
  outcome: MatchOutcome;
  matchedLeadId: string | null;
  matchedBy: "opportunity_id" | "phone" | "email" | "address_service_window" | null;
  shouldUpdate: boolean;
  reason: string;
};

function toText(value: unknown) {
  return String(value || "").trim();
}

function lower(value: unknown) {
  return toText(value).toLowerCase();
}

export function normalizeLeadPhone(raw: unknown) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return "";
}

export function normalizeLeadEmail(raw: unknown) {
  const email = lower(raw);
  if (!email) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeToken(value: unknown) {
  return lower(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeServiceType(value: unknown) {
  return normalizeToken(value);
}

export function buildLeadAddressKey(input: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}) {
  const address = normalizeToken(input.address);
  const city = normalizeToken(input.city);
  const state = normalizeToken(input.state);
  const postalCode = toText(input.postalCode);
  return [address, city, state, postalCode].filter(Boolean).join("|");
}

function daysBetween(now: Date, createdAt?: string | null) {
  const ts = Date.parse(toText(createdAt));
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return Math.abs(now.getTime() - ts) / 86_400_000;
}

function hasConflictingVerifiedChannel(existing: LeadMatchRecord, incoming: LeadMatchCandidate) {
  const existingPhone = normalizeLeadPhone(existing.phone);
  const incomingPhone = normalizeLeadPhone(incoming.phone);
  if (existingPhone && incomingPhone && existingPhone !== incomingPhone) return true;

  const existingEmail = normalizeLeadEmail(existing.email);
  const incomingEmail = normalizeLeadEmail(incoming.email);
  if (existingEmail && incomingEmail && existingEmail !== incomingEmail) return true;

  return false;
}

export function findLeadMatch(input: {
  existing: LeadMatchRecord[];
  incoming: LeadMatchCandidate;
  recentWindowDays?: number;
}): LeadMatchResult {
  const recentWindowDays = input.recentWindowDays ?? 21;
  const now = input.incoming.now instanceof Date ? input.incoming.now : new Date(input.incoming.now || Date.now());
  const incomingOpportunityId = toText(input.incoming.opportunityId);
  const incomingPhone = normalizeLeadPhone(input.incoming.phone);
  const incomingEmail = normalizeLeadEmail(input.incoming.email);
  const incomingAddressKey = buildLeadAddressKey(input.incoming);
  const incomingServiceType = normalizeServiceType(input.incoming.serviceType);

  if (incomingOpportunityId) {
    const exactOpportunity = input.existing.find((row) => toText(row.opportunityId) === incomingOpportunityId);
    if (exactOpportunity) {
      return {
        outcome: "reuse_existing",
        matchedLeadId: exactOpportunity.id,
        matchedBy: "opportunity_id",
        shouldUpdate: false,
        reason: `reused existing lead by opportunity_id=${incomingOpportunityId}`
      };
    }
  }

  if (incomingPhone) {
    const byPhone = input.existing.find((row) => normalizeLeadPhone(row.phone) === incomingPhone);
    if (byPhone) {
      return {
        outcome: "reuse_and_update",
        matchedLeadId: byPhone.id,
        matchedBy: "phone",
        shouldUpdate: true,
        reason: `reused existing lead by verified phone ${incomingPhone}`
      };
    }
  }

  if (incomingEmail) {
    const byEmail = input.existing.find((row) => normalizeLeadEmail(row.email) === incomingEmail);
    if (byEmail) {
      return {
        outcome: "reuse_and_update",
        matchedLeadId: byEmail.id,
        matchedBy: "email",
        shouldUpdate: true,
        reason: `reused existing lead by verified email ${incomingEmail}`
      };
    }
  }

  if (incomingAddressKey && incomingServiceType) {
    const addressMatch = input.existing.find((row) => {
      const existingAddressKey = buildLeadAddressKey(row);
      const existingServiceType = normalizeServiceType(row.serviceType);
      if (!existingAddressKey || existingAddressKey !== incomingAddressKey) return false;
      if (!existingServiceType || existingServiceType !== incomingServiceType) return false;
      if (daysBetween(now, row.createdAt) > recentWindowDays) return false;
      if (hasConflictingVerifiedChannel(row, input.incoming)) return false;
      return true;
    });

    if (addressMatch) {
      return {
        outcome: "reuse_and_update",
        matchedLeadId: addressMatch.id,
        matchedBy: "address_service_window",
        shouldUpdate: true,
        reason: `reused existing lead by property/service window ${incomingAddressKey}`
      };
    }
  }

  return {
    outcome: "create_new",
    matchedLeadId: null,
    matchedBy: null,
    shouldUpdate: false,
    reason: "no safe existing lead match found"
  };
}

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map((value) => toText(value)).filter(Boolean)));
}

function verificationRank(status: unknown) {
  const normalized = lower(status);
  if (normalized === "verified") return 3;
  if (normalized === "review") return 2;
  if (normalized === "rejected") return 1;
  return 0;
}

export function mergeContactChannels(existing: Record<string, unknown>, incoming: Record<string, unknown>) {
  const existingScore = Number(existing.verification_score);
  const incomingScore = Number(incoming.verification_score);
  const keepExistingScore = Number.isFinite(existingScore) && existingScore >= (Number.isFinite(incomingScore) ? incomingScore : -1);
  const keepExistingStatus = verificationRank(existing.verification_status) >= verificationRank(incoming.verification_status);

  return {
    ...existing,
    ...incoming,
    phone: normalizeLeadPhone(existing.phone) || normalizeLeadPhone(incoming.phone) || null,
    email: normalizeLeadEmail(existing.email) || normalizeLeadEmail(incoming.email) || null,
    verification_status: keepExistingStatus ? existing.verification_status || incoming.verification_status || null : incoming.verification_status || existing.verification_status || null,
    verification_score: keepExistingScore ? existing.verification_score || incoming.verification_score || null : incoming.verification_score || existing.verification_score || null,
    verification_reasons: uniqueStrings([
      ...(Array.isArray(existing.verification_reasons) ? existing.verification_reasons : []),
      ...(Array.isArray(incoming.verification_reasons) ? incoming.verification_reasons : [])
    ]),
    contact_evidence: uniqueStrings([
      ...(Array.isArray(existing.contact_evidence) ? existing.contact_evidence : []),
      ...(Array.isArray(incoming.contact_evidence) ? incoming.contact_evidence : [])
    ]),
    dedupe_reasons: uniqueStrings([
      ...(Array.isArray(existing.dedupe_reasons) ? existing.dedupe_reasons : []),
      ...(Array.isArray(incoming.dedupe_reasons) ? incoming.dedupe_reasons : [])
    ])
  };
}
