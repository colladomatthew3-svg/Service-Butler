import { LeadScannerView } from "@/components/dashboard/lead-scanner-view";

export default async function ScannerPage({
  searchParams
}: {
  searchParams: Promise<{ onboarding?: string; queue?: string }>;
}) {
  const params = await searchParams;
  const onboardingMode = params.onboarding === "first-scan" ? "first-scan" : undefined;
  const initialTab = params.queue === "sdr" ? "sdr" : "feed";

  return <LeadScannerView initialTab={initialTab} onboardingMode={onboardingMode} />;
}
