import { redirect } from "next/navigation";
import { LeadDetailView } from "@/components/dashboard/lead-detail-view";
import { getCurrentUserContext } from "@/lib/auth/rbac";
import { getDemoLead, getFirstDemoLeadId } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/services/review-mode";

export default async function LeadDetailMockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isDemoMode()) {
    const exists = getDemoLead(id);
    if (!exists) {
      const firstLeadId = getFirstDemoLeadId();
      if (firstLeadId) {
        redirect(`/dashboard/leads/${firstLeadId}`);
      }
      redirect(`/dashboard/leads?missingLead=${encodeURIComponent(id)}`);
    }

    return <LeadDetailView leadId={id} />;
  }

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
