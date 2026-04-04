import Link from "next/link";
import { ArrowRight, Bell, Database, MapPin, Radar, Route, Shield } from "lucide-react";
import { Footer } from "@/components/brand/Footer";
import { TopNav } from "@/components/brand/TopNav";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const capabilities = [
  {
    icon: Radar,
    title: "Signal Intelligence",
    description:
      "Weather, permits, municipal incidents, and public distress signals feed one operator view so demand is visible before competitors react."
  },
  {
    icon: Database,
    title: "Lead Enrichment",
    description: "Signals are normalized with service fit, confidence, and provenance so dispatch works from context instead of raw noise."
  },
  {
    icon: Route,
    title: "Smart Routing",
    description: "Opportunities route by territory and service line while preserving compliance, suppression, and audit controls."
  },
  {
    icon: Bell,
    title: "Coordinated Outreach",
    description: "Operators launch outreach with safeguards, channel readiness checks, and tenant-scoped guardrails."
  },
  {
    icon: MapPin,
    title: "Command Center",
    description: "Dashboard surfaces scanner, pipeline, jobs, and source health so teams can move from incident to booked work quickly."
  },
  {
    icon: Shield,
    title: "Trust Controls",
    description: "Buyer-proof capture status, compliance policy, and source provenance are visible across the workflow."
  }
] as const;

export default function ProductPage() {
  return (
    <>
      <TopNav />
      <main>
        <section className="page-section py-16">
          <div className="container text-center">
            <p className="eyebrow justify-center">Product</p>
            <h1 className="title-hero mx-auto mt-6 max-w-4xl text-semantic-text">How Service Butler turns market signals into booked jobs.</h1>
            <p className="text-body-lg mx-auto mt-4 max-w-3xl text-semantic-muted">
              The platform combines acquisition-ready data sources, operator workflows, and proof-safe automation for restoration and home-service teams.
            </p>
          </div>
        </section>

        <section className="page-section border-y border-semantic-border/70 bg-white/72 py-12">
          <div className="container">
            <h2 className="section-title text-center text-semantic-text">How it works</h2>
            <div className="mt-8 grid gap-4 lg:grid-cols-4">
              {[
                { step: "1", title: "Detect", desc: "Connectors pull weather, permits, incidents, and public distress data." },
                { step: "2", title: "Normalize", desc: "Signals become ranked opportunities with provenance and confidence." },
                { step: "3", title: "Route", desc: "Opportunities map into service-line and territory workflows." },
                { step: "4", title: "Convert", desc: "Dispatch and outreach move qualified demand into scheduled work." }
              ].map((item) => (
                <Card key={item.step} className="rounded-2xl border-semantic-border p-5 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">{item.step}</div>
                  <p className="mt-3 text-base font-semibold text-semantic-text">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-semantic-muted">{item.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="page-section py-14">
          <div className="container">
            <h2 className="section-title text-center text-semantic-text">Platform capabilities</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((capability) => (
                <Card key={capability.title} className="rounded-2xl border-semantic-border p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                    <capability.icon className="h-5 w-5 text-brand-700" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-semantic-text">{capability.title}</p>
                  <p className="mt-2 text-sm leading-7 text-semantic-muted">{capability.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="page-section bg-[rgb(var(--sb-text))] py-12 text-white">
          <div className="container text-center">
            <h2 className="section-title text-white">See the operator workflow live</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-white/80">
              Walk through scanner, source health, lead routing, and pipeline execution in one demo.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/login" className={buttonStyles({ size: "lg", variant: "secondary", className: "border-white/20 bg-white/10 text-white hover:bg-white/20" })}>
                Try Demo
              </Link>
              <Link href="/pricing" className={buttonStyles({ size: "lg", className: "bg-white text-[rgb(var(--sb-text))] hover:bg-white/90" })}>
                View Pricing
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
