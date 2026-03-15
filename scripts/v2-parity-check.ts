import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

type RowSummary = {
  entity: string;
  legacyCount: number;
  v2MatchedCount: number;
  v2TotalCount: number;
  missingInV2: number;
  legacyChecksum: string;
  v2MatchedChecksum: string;
  parity: "PASS" | "FAIL";
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function checksumFromIds(ids: string[]) {
  const digest = crypto.createHash("sha256");
  digest.update(ids.sort().join("|"));
  return digest.digest("hex").slice(0, 16);
}

function rowId(row: unknown, idColumn: string) {
  if (!row || typeof row !== "object") return "";
  const record = row as Record<string, unknown>;
  return String(record[idColumn] || "").trim();
}

async function fetchAllIds(table: string, idColumn = "id") {
  const pageSize = 1000;
  let from = 0;
  const ids: string[] = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(idColumn)
      .range(from, to);

    if (error) throw new Error(`[${table}] ${error.message}`);

    const batch = (data || [])
      .map((row) => rowId(row, idColumn))
      .filter(Boolean);

    ids.push(...batch);

    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return ids;
}

async function fetchAllIdsInSet(table: string, ids: string[], idColumn = "id") {
  if (ids.length === 0) return [] as string[];

  const chunkSize = 200;
  const collected: string[] = [];

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from(table)
      .select(idColumn)
      .in(idColumn, chunk);

    if (error) throw new Error(`[${table}] ${error.message}`);

    collected.push(
      ...((data || [])
        .map((row) => rowId(row, idColumn))
        .filter(Boolean))
    );
  }

  return collected;
}

async function fetchCount(table: string) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) throw new Error(`[${table}] ${error.message}`);
  return Number(count || 0);
}

async function compareEntity(entity: string, legacyTable: string, v2Table: string): Promise<RowSummary> {
  const legacyIds = await fetchAllIds(legacyTable);
  const v2MatchedIds = await fetchAllIdsInSet(v2Table, legacyIds);
  const v2TotalCount = await fetchCount(v2Table);

  return {
    entity,
    legacyCount: legacyIds.length,
    v2MatchedCount: v2MatchedIds.length,
    v2TotalCount,
    missingInV2: Math.max(0, legacyIds.length - v2MatchedIds.length),
    legacyChecksum: checksumFromIds(legacyIds),
    v2MatchedChecksum: checksumFromIds(v2MatchedIds),
    parity: legacyIds.length === v2MatchedIds.length ? "PASS" : "FAIL"
  };
}

async function main() {
  const summaries: RowSummary[] = [];

  summaries.push(await compareEntity("source_events", "source_events", "v2_source_events"));
  summaries.push(await compareEntity("opportunities", "opportunities", "v2_opportunities"));
  summaries.push(await compareEntity("leads", "leads", "v2_leads"));
  summaries.push(await compareEntity("jobs", "jobs", "v2_jobs"));

  console.log("v2 parity check");
  console.table(
    summaries.map((row) => ({
      entity: row.entity,
      legacy_count: row.legacyCount,
      v2_matched_count: row.v2MatchedCount,
      v2_total_count: row.v2TotalCount,
      missing_in_v2: row.missingInV2,
      legacy_checksum: row.legacyChecksum,
      v2_matched_checksum: row.v2MatchedChecksum,
      parity: row.parity
    }))
  );

  const failed = summaries.filter((row) => row.parity === "FAIL");
  if (failed.length > 0) {
    console.error("Parity failures detected:", failed.map((row) => row.entity).join(", "));
    process.exit(2);
  }

  console.log("Parity checks passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
