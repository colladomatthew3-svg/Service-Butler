import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/rbac";

export async function GET() {
  const { accountId, supabase } = await getCurrentUserContext();
  const { data, error } = await supabase
    .from("outbound_contacts")
    .select("id,name,phone,email,service_type,city,state,postal_code,tags,created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ contacts: data || [] });
}
