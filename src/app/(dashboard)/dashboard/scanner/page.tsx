import { LeadScannerView } from "@/components/dashboard/lead-scanner-view";

export default async function ScannerPage({
  searchParams
}: {
  searchParams: Promise<{ onboarding?: string; queue?: string; opportunity?: string }>;
}) {
  const params = await searchParams;
  const onboardingMode = params.onboarding === "first-scan" ? "first-scan" : undefined;
  const initialTab = params.queue === "sdr" ? "sdr" : "feed";
  const focusOpportunityId = typeof params.opportunity === "string" ? params.opportunity : undefined;

  return <LeadScannerView initialTab={initialTab} onboardingMode={onboardingMode} focusOpportunityId={focusOpportunityId} />;
}
