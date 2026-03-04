import { notFound } from "next/navigation";
import { JobDetailView } from "@/components/dashboard/job-detail-view";
import { getCurrentUserContext } from "@/lib/auth/rbac";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { accountId, supabase } = await getCurrentUserContext();
  const { data: exists } = await supabase.from("jobs").select("id").eq("account_id", accountId).eq("id", id).maybeSingle();

  if (!exists) notFound();

  return <JobDetailView jobId={id} />;
}
