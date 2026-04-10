import { buildLeadAddressKey, normalizeLeadEmail, normalizeLeadPhone } from "@/lib/v2/lead-matching";
import type { SupabaseClient } from "@supabase/supabase-js";

const DOB_LICENSE_INFO_ENDPOINT = "https://data.cityofnewyork.us/resource/t8hj-ruu2.json";
const DOB_LICENSE_INFO_PROVENANCE = "https://data.cityofnewyork.us/Housing-Development/DOB-License-Info/t8hj-ruu2";

const PERMIT_LICENSE_TYPE_MAP: Record<string, string> = {
  GC: "GENERAL CONTRACTOR",
  MP: "MASTER PLUMBER",
  EC: "ELECTRICAL CONTRACTOR",
  EF: "ELECTRICAL FIRM",
  FSC: "FIRE SUPPRESSION CONTRACTOR",
  FR: "FILING REPRESENTATIVE",
  HMO: "HOIST MACHINE OPERATOR",
  OBI: "OIL BURNER INSTALLER",
  RIGGER: "RIGGER",
  SI: "SPECIAL INSPECTION AGENCY"
};

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeServiceLine(value: unknown) {
  return asText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeIdentityKey(value: unknown) {
  return asText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeSoqlString(value: string) {
  return value.replace(/'/g, "''");
}

function daysBetween(now: Date, createdAt?: string | null) {
  const ts = Date.parse(asText(createdAt));
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return Math.abs(now.getTime() - ts) / 86_400_000;
}

export type GroundedLeadContactCandidate = {
  leadId: string;
  opportunityId: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  serviceLine: string | null;
  createdAt: string | null;
  verificationStatus: string | null;
  verificationScore: number | null;
  contactProvenance: string | null;
  contactEvidence: string[];
  doNotContact: boolean;
};

export type GroundedLeadContactMatch =
  | {
      status: "attached";
      reasonCode: "historical_verified_contact";
      reason: string;
      lead: GroundedLeadContactCandidate;
      matchedBy: "property_service_window";
    }
  | {
      status: "weak_match";
      reasonCode: "contact_found_but_not_sufficiently_grounded";
      reason: string;
      lead: GroundedLeadContactCandidate | null;
    }
  | {
      status: "missing";
      reasonCode: "missing_verified_contact";
      reason: string;
      lead: null;
    };

export type GroundedPermitLicenseContactMatch =
  | {
      status: "attached";
      reasonCode: "verified_contact_attached_from_dob_license";
      reason: string;
      contactName: string | null;
      phone: string | null;
      email: string | null;
      provenance: string;
      evidence: string[];
      matchedBy: "license_number_type";
    }
  | {
      status: "identity_only";
      reasonCode: "permit_license_identity_only";
      reason: string;
      contactName: string | null;
      provenance: string;
      evidence: string[];
    }
  | {
      status: "weak_match";
      reasonCode: "contact_found_but_not_sufficiently_grounded";
      reason: string;
      provenance: string | null;
      evidence: string[];
    }
  | {
      status: "missing";
      reasonCode: "missing_verified_contact";
      reason: string;
      provenance: null;
      evidence: [];
    };

function hasUsableVerifiedContact(candidate: GroundedLeadContactCandidate) {
  return (
    candidate.verificationStatus === "verified" &&
    (candidate.verificationScore ?? 0) >= 70 &&
    Boolean(candidate.phone || candidate.email) &&
    !candidate.doNotContact
  );
}

function sortCandidates(candidates: GroundedLeadContactCandidate[]) {
  return [...candidates].sort((left, right) => {
    const scoreDiff = (right.verificationScore ?? 0) - (left.verificationScore ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return Date.parse(right.createdAt || "") - Date.parse(left.createdAt || "");
  });
}

export function parseGroundedLeadContactCandidate(row: Record<string, unknown>, opportunityServiceLine?: string | null): GroundedLeadContactCandidate {
  const channels = asRecord(row.contact_channels_json);
  const contactEvidence = Array.isArray(channels.contact_evidence) ? channels.contact_evidence.map((value) => asText(value)).filter(Boolean) : [];

  return {
    leadId: asText(row.id),
    opportunityId: asText(row.opportunity_id) || null,
    contactName: asText(row.contact_name) || null,
    phone: normalizeLeadPhone(channels.phone) || null,
    email: normalizeLeadEmail(channels.email) || null,
    address: asText(row.property_address) || null,
    city: asText(row.city) || null,
    state: asText(row.state) || null,
    postalCode: asText(row.postal_code) || null,
    serviceLine: normalizeServiceLine(opportunityServiceLine || row.service_type),
    createdAt: asText(row.created_at) || null,
    verificationStatus: asText(channels.verification_status || row.lead_status).toLowerCase() || null,
    verificationScore: toNumber(channels.verification_score, 0),
    contactProvenance: asText(channels.contact_provenance) || null,
    contactEvidence,
    doNotContact: row.do_not_contact === true
  };
}

export function findGroundedLeadContactMatch(input: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  serviceLine?: string | null;
  existingLeadContacts: GroundedLeadContactCandidate[];
  now?: string | Date;
  recentWindowDays?: number;
}): GroundedLeadContactMatch {
  const recentWindowDays = input.recentWindowDays ?? 45;
  const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
  const addressKey = buildLeadAddressKey({
    address: input.address || null,
    city: input.city || null,
    state: input.state || null,
    postalCode: input.postalCode || null
  });
  const serviceLine = normalizeServiceLine(input.serviceLine);

  if (!addressKey || !serviceLine) {
    return {
      status: "missing",
      reasonCode: "missing_verified_contact",
      reason: "No exact property/service key was available for grounded contact reuse.",
      lead: null
    };
  }

  const verifiedAtProperty = sortCandidates(
    input.existingLeadContacts.filter((candidate) => {
      if (!hasUsableVerifiedContact(candidate)) return false;
      if (daysBetween(now, candidate.createdAt) > recentWindowDays) return false;
      const candidateAddressKey = buildLeadAddressKey({
        address: candidate.address,
        city: candidate.city,
        state: candidate.state,
        postalCode: candidate.postalCode
      });
      return candidateAddressKey === addressKey;
    })
  );

  if (verifiedAtProperty.length === 0) {
    return {
      status: "missing",
      reasonCode: "missing_verified_contact",
      reason: "No recent verified lead contact exists for this property in Service Butler.",
      lead: null
    };
  }

  const exactServiceMatch = verifiedAtProperty.find((candidate) => candidate.serviceLine === serviceLine);
  if (exactServiceMatch) {
    return {
      status: "attached",
      reasonCode: "historical_verified_contact",
      reason: "Reused a recent verified v2 lead contact matched by exact property and service line.",
      lead: exactServiceMatch,
      matchedBy: "property_service_window"
    };
  }

  return {
    status: "weak_match",
    reasonCode: "contact_found_but_not_sufficiently_grounded",
    reason: "A verified lead exists for this property, but not for the same service line.",
    lead: verifiedAtProperty[0] || null
  };
}

export async function findGroundedLeadContactMatchForOpportunity(input: {
  supabase: SupabaseClient;
  tenantId: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  serviceLine?: string | null;
  now?: string | Date;
  recentWindowDays?: number;
}) {
  const postalCode = asText(input.postalCode);
  if (!postalCode) {
    return {
      status: "missing",
      reasonCode: "missing_verified_contact",
      reason: "No exact property/service key was available for grounded contact reuse.",
      lead: null
    } as GroundedLeadContactMatch;
  }

  const { data, error } = await input.supabase
    .from("v2_leads")
    .select("id,opportunity_id,contact_name,property_address,city,state,postal_code,service_type,lead_status,created_at,contact_channels_json,do_not_contact")
    .eq("tenant_id", input.tenantId)
    .eq("postal_code", postalCode)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  return findGroundedLeadContactMatch({
    address: input.address,
    city: input.city,
    state: input.state,
    postalCode,
    serviceLine: input.serviceLine,
    existingLeadContacts: ((data || []) as Array<Record<string, unknown>>).map((row) =>
      parseGroundedLeadContactCandidate(row, input.serviceLine)
    ),
    now: input.now,
    recentWindowDays: input.recentWindowDays
  });
}

function mapPermitLicenseType(value: unknown) {
  const raw = asText(value).toUpperCase();
  if (!raw) return "";
  return PERMIT_LICENSE_TYPE_MAP[raw] || raw;
}

function permitLicenseContactName(row: Record<string, unknown>) {
  const businessName = asText(row.business_name);
  if (businessName && businessName !== "N/A" && businessName !== "NA") return businessName;
  const personName = [row.first_name, row.last_name].map((value) => asText(value)).filter(Boolean).join(" ");
  return personName || null;
}

export async function findGroundedPermitLicenseContactMatch(input: {
  sourceEvent: {
    normalized_payload?: Record<string, unknown> | null;
    raw_payload?: Record<string, unknown> | null;
  };
}): Promise<GroundedPermitLicenseContactMatch> {
  const normalized = asRecord(input.sourceEvent.normalized_payload);
  const raw = asRecord(input.sourceEvent.raw_payload);
  const licenseNumber = asText(normalized.applicant_license || raw.applicant_license);
  const permitLicenseType = mapPermitLicenseType(normalized.applicant_license_type || raw.permittee_s_license_type);

  if (!licenseNumber) {
    return {
      status: "missing",
      reasonCode: "missing_verified_contact",
      reason: "Permit record does not include an applicant license number for grounded contact lookup.",
      provenance: null,
      evidence: []
    } as GroundedPermitLicenseContactMatch;
  }

  const params = new URLSearchParams();
  params.set(
    "$select",
    "license_number,license_type,business_name,first_name,last_name,business_phone_number,business_email,license_status"
  );
  params.set(
    "$where",
    permitLicenseType
      ? `license_number=${escapeSoqlString(licenseNumber)} AND upper(license_type)='${escapeSoqlString(permitLicenseType)}'`
      : `license_number=${escapeSoqlString(licenseNumber)}`
  );
  params.set("$limit", "5");

  const response = await fetch(`${DOB_LICENSE_INFO_ENDPOINT}?${params.toString()}`, {
    headers: {
      accept: "application/json",
      "user-agent": "ServiceButler-PermitContact/1.0"
    },
    cache: "no-store"
  }).catch(() => null);

  if (!response?.ok) {
    return {
      status: "missing",
      reasonCode: "missing_verified_contact",
      reason: "DOB License Info lookup did not return a grounded permit contact.",
      provenance: null,
      evidence: []
    };
  }

  const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      status: "missing",
      reasonCode: "missing_verified_contact",
      reason: "No DOB license record matched this permit applicant license.",
      provenance: null,
      evidence: []
    };
  }

  const activeRows = rows.filter((row) => asText(row.license_status).toUpperCase() === "ACTIVE");
  if (activeRows.length !== 1) {
    return {
      status: "weak_match",
      reasonCode: "contact_found_but_not_sufficiently_grounded",
      reason:
        activeRows.length === 0
          ? "DOB license record exists, but no active license entry qualified for grounded contact attachment."
          : "DOB license lookup returned multiple active records for this applicant license.",
      provenance: DOB_LICENSE_INFO_PROVENANCE,
      evidence: ["permit:applicant_license", "dob_license:license_lookup"]
    };
  }

  const row = activeRows[0];
  const phone = normalizeLeadPhone(row.business_phone_number);
  const email = normalizeLeadEmail(row.business_email);
  const contactName = permitLicenseContactName(row);
  const provenance = `${DOB_LICENSE_INFO_PROVENANCE}#license_number=${licenseNumber}${permitLicenseType ? `&license_type=${encodeURIComponent(permitLicenseType)}` : ""}`;
  const evidence = ["permit:applicant_license", "dob_license:license_number", permitLicenseType ? "dob_license:license_type" : ""].filter(Boolean);

  const permitBusinessName = normalizeIdentityKey(normalized.applicant_business_name || raw.applicant_business_name);
  const matchedBusinessName = normalizeIdentityKey(row.business_name);
  if (permitBusinessName && matchedBusinessName && permitBusinessName !== matchedBusinessName) {
    return {
      status: "weak_match",
      reasonCode: "contact_found_but_not_sufficiently_grounded",
      reason: "DOB license record matched the applicant license, but the business identity conflicted with the permit record.",
      provenance,
      evidence
    };
  }

  if (!phone && !email) {
    return {
      status: "identity_only",
      reasonCode: "permit_license_identity_only",
      reason: "DOB license record confirms the permit applicant identity, but it does not expose a usable phone or email.",
      contactName,
      provenance,
      evidence
    };
  }

  return {
    status: "attached",
    reasonCode: "verified_contact_attached_from_dob_license",
    reason: "Attached phone/email from official DOB License Info using exact permit applicant license and license type.",
    contactName,
    phone,
    email,
    provenance,
    evidence,
    matchedBy: "license_number_type"
  } satisfies GroundedPermitLicenseContactMatch;
}
