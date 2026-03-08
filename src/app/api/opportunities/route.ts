import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/rbac";

export async function GET(req: NextRequest) {
  const { accountId, supabase } = await getCurrentUserContext();
  const category = (req.nextUrl.searchParams.get("category") || "").trim().toLowerCase();
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 50);
  const limit = Math.max(1, Math.min(250, Number.isFinite(limitRaw) ? limitRaw : 50));

  let query = supabase
    .from("opportunities")
    .select("id,category,title,description,location_text,city,state,zip,territory,lat,lon,intent_score,confidence,urgency_score,tags,suggested_action,recommended_action,status,raw,created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category && category !== "all") query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ opportunities: data || [] });
}
