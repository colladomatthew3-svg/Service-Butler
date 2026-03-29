import { LeadScannerView } from "@/components/dashboard/lead-scanner-view";

export default async function ScannerPage({
  searchParams
}: {
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const params = await searchParams;
  const onboardingMode = params.onboarding === "first-scan" ? "first-scan" : undefined;

  return <LeadScannerView initialTab="feed" onboardingMode={onboardingMode} />;
}
