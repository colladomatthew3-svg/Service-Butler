import { notFound } from "next/navigation";
import { findLeadById } from "@/lib/mock/dashboard";
import { LeadDetailView } from "@/components/dashboard/lead-detail-view";

export default async function LeadDetailMockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = findLeadById(id);
  if (!lead) notFound();

  return <LeadDetailView lead={lead} />;
}
