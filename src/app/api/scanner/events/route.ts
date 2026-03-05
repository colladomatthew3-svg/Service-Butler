import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/rbac";

export async function GET(req: NextRequest) {
  const { accountId, supabase } = await getCurrentUserContext();
  const source = req.nextUrl.searchParams.get("source");
  const category = req.nextUrl.searchParams.get("category");
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 50);
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));
  const q = (req.nextUrl.searchParams.get("q") || "").trim();

  let query = supabase
    .from("scanner_events")
    .select("id,source,category,title,description,location_text,lat,lon,intent_score,confidence,tags,raw,created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (source && source !== "all") query = query.eq("source", source);
  if (category && category !== "all") query = query.eq("category", category);
  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,location_text.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    const message = String(error.message || "");
    const missingScannerTable =
      message.includes("scanner_events") &&
      (message.includes("schema cache") || message.includes("does not exist") || message.includes("not found"));
    if (missingScannerTable) {
      return NextResponse.json({
        events: [],
        warning: "Scanner events table is unavailable locally. Run migrations to enable persisted feed."
      });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ events: data || [] });
}
