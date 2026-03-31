/**
 * Opportunity Deduplication
 *
 * Prevents v2_opportunities from being created multiple times for the same
 * real-world event. For each incoming signal we compute a dedup key from
 * the address, service line, and source type, then check whether an
 * existing opportunity already covers that signal within the configured
 * time window.
 *
 * The dedup window varies by vertical and source type (e.g. weather events
 * have a short window because conditions change quickly; permit signals
 * have a long window because they represent a single ongoing project).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FranchiseVertical } from "@/lib/v2/franchise-verticals";
import { getDedupWindowHours } from "@/lib/v2/franchise-verticals";

// ---------------------------------------------------------------------------
// Dedup key construction
// ---------------------------------------------------------------------------

function normalize(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}

/**
 * Normalize an address string for dedup comparison.
 * Strips unit numbers and suite info that differ on the same building.
 *
 * Examples:
 *   "123 Main St Apt 4B"  → "123 main st"
 *   "123 Main Street"     → "123 main st"
 */
export function normalizeAddress(raw: unknown): string {
  const text = normalize(raw);
  // Drop common unit suffixes
  return text
    .replace(/\b(apt|unit|ste|suite|fl|floor|rm|room|#)\s*[\w\d-]+/gi, "")
    .replace(/\b(street|avenue|boulevard|drive|lane|road|court|place|way)\b/gi, (m) => {
      const map: Record<string, string> = {
        street: "st", avenue: "ave", boulevard: "blvd", drive: "dr",
        lane: "ln", road: "rd", court: "ct", place: "pl", way: "way",
      };
      return map[m.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

export type DedupInput = {
  /** Street address (e.g. "123 Main St") */
  address?: string | null;
  /** City */
  city?: string | null;
  /** State abbreviation */
  state?: string | null;
  /** 5-digit postal code */
  postalCode?: string | null;
  /** Service line (e.g. "restoration", "pest_control") */
  serviceType?: string | null;
  /**
   * Source type from connector (e.g. "weather", "incident", "permit").
   * Used to select the right dedup time window.
   */
  sourceType?: string | null;
};

/**
 * Build a stable dedup key for an opportunity signal.
 * Two signals with the same key represent the same real-world lead.
 */
export function buildDedupKey(input: DedupInput): string {
  const parts = [
    normalizeAddress(input.address),
    normalize(input.postalCode) || normalize(input.city),
    normalize(input.state),
    normalize(input.serviceType),
    // Include source category but not exact source (weather vs specific storm name)
    normalize(input.sourceType)?.split("_")[0] ?? "",
  ].filter(Boolean);
  return parts.join("::");
}

// ---------------------------------------------------------------------------
// Duplicate check against Supabase
// ---------------------------------------------------------------------------

export type DedupCheckResult =
  | { isDuplicate: true; existingOpportunityId: string; existingCreatedAt: string }
  | { isDuplicate: false };

/**
 * Check whether an existing v2_opportunity already covers this signal
 * within the configured dedup window for the given vertical.
 *
 * Returns the existing opportunity ID if a duplicate is found.
 */
export async function checkOpportunityDuplicate(
  supabase: SupabaseClient,
  tenantId: string,
  input: DedupInput,
  vertical: FranchiseVertical
): Promise<DedupCheckResult> {
  const dedupKey = buildDedupKey(input);
  if (!dedupKey) return { isDuplicate: false };

  const windowHours = getDedupWindowHours(vertical, input.sourceType || "default");
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  // We store the dedup key inside explainability_json.dedup_key
  // This avoids requiring a schema migration for the initial rollout
  const { data, error } = await supabase
    .from("v2_opportunities")
    .select("id, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", windowStart)
    .not("lifecycle_status", "in", '("closed_lost")')
    .contains("explainability_json", { dedup_key: dedupKey })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return { isDuplicate: false };

  return {
    isDuplicate: true,
    existingOpportunityId: String(data.id),
    existingCreatedAt: String(data.created_at),
  };
}

// ---------------------------------------------------------------------------
// Dedup-enriched explainability
// ---------------------------------------------------------------------------

/**
 * Inject dedup metadata into an explainability_json object so future
 * calls can find this opportunity by its dedup key.
 */
export function injectDedupKey(
  explainability: Record<string, unknown>,
  input: DedupInput
): Record<string, unknown> {
  return {
    ...explainability,
    dedup_key: buildDedupKey(input),
    dedup_address_normalized: normalizeAddress(input.address),
    dedup_postal_code: normalize(input.postalCode),
    dedup_service_type: normalize(input.serviceType),
    dedup_source_category: normalize(input.sourceType)?.split("_")[0] ?? "",
  };
}

// ---------------------------------------------------------------------------
// Address-level merge candidate scoring
// ---------------------------------------------------------------------------

/**
 * Given two normalized addresses, returns a similarity score [0,1].
 * Simple token-based overlap — sufficient for address dedup without
 * requiring a full Levenshtein or phonetic comparison.
 */
export function addressSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeAddress(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalizeAddress(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}
