import { redirect } from "next/navigation";
import { LeadDetailView } from "@/components/dashboard/lead-detail-view";
import { getCurrentUserContext } from "@/lib/auth/rbac";

export default async function LeadDetailMockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { accountId, supabase } = await getCurrentUserContext();
  const { data: exists } = await supabase.from("leads").select("id").eq("account_id", accountId).eq("id", id).maybeSingle();
  if (!exists) {
    const { data: firstLead } = await supabase.from("leads").select("id").eq("account_id", accountId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (firstLead?.id) {
      redirect(`/dashboard/leads/${firstLead.id}`);
    }
    redirect(`/dashboard/leads?missingLead=${encodeURIComponent(id)}`);
  }

  return <LeadDetailView leadId={id} />;
}
