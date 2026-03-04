import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isReviewMode } from "@/lib/services/review-mode";

export const dynamic = "force-dynamic";

async function getWeatherStatus() {
  if (!isReviewMode()) return "unknown";
  try {
    const admin = getSupabaseAdminClient();
    const { data } = await admin
      .from("account_settings")
      .select("weather_location_label, weather_lat, weather_lng")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (data?.weather_lat != null && data?.weather_lng != null) {
      return data.weather_location_label || "set";
    }
    return "not set";
  } catch {
    return "unknown";
  }
}

export default async function ReviewHubPage() {
  const weather = await getWeatherStatus();
  const reviewMode = process.env.REVIEW_MODE || "off";

  const links = [
    "/",
    "/login",
    "/dashboard",
    "/dashboard/leads",
    "/dashboard/pipeline",
    "/dashboard/scanner",
    "/dashboard/schedule",
    "/dashboard/settings"
  ];

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-4xl font-semibold text-semantic-text">ServiceButler Review Hub</h1>
          <p className="mt-2 text-sm text-semantic-muted">One place to review product flows without authentication friction.</p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-semantic-text">Status</h2>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatusRow label="App URL" value={process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"} />
            <StatusRow label="DB_MODE" value={process.env.DB_MODE || "local"} />
            <StatusRow label="BILLING_MODE" value={process.env.BILLING_MODE || "disabled"} />
            <StatusRow label="REVIEW_MODE" value={reviewMode} tone={reviewMode === "on" ? "success" : "danger"} />
            <StatusRow label="Supabase" value={process.env.NEXT_PUBLIC_SUPABASE_URL ? "configured" : "missing"} tone={process.env.NEXT_PUBLIC_SUPABASE_URL ? "success" : "warning"} />
            <StatusRow label="Weather location" value={weather} tone={weather === "not set" ? "warning" : "default"} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-semantic-text">Open Product Flows</h2>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {links.map((href) => (
              <Link key={href} href={href}>
                <Button size="lg" fullWidth>
                  {href}
                </Button>
              </Link>
            ))}
          </CardBody>
        </Card>

        <Card className="border-warning-500/30">
          <CardHeader>
            <h2 className="text-lg font-semibold text-semantic-text">If You Got Bounced to Login</h2>
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-semantic-muted">
            <p>Make sure <code>REVIEW_MODE=on</code> in <code>.env.local</code>.</p>
            <p>Restart the dev server after updating env values.</p>
            <Link href="/dashboard/settings" className="inline-block">
              <Button variant="secondary" size="sm">Open Settings</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

function StatusRow({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const variant = tone === "success" ? "success" : tone === "warning" ? "warning" : tone === "danger" ? "danger" : "default";
  return (
    <div className="rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <div className="mt-2">
        <Badge variant={variant}>{value}</Badge>
      </div>
    </div>
  );
}
