import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, CloudLightning, Droplets, Flame, Wrench } from "lucide-react";
import { Footer } from "@/components/brand/Footer";
import { TopNav } from "@/components/brand/TopNav";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const solutions = [
  {
    icon: Droplets,
    title: "Water Damage Response",
    description: "Track flood and water-loss patterns so dispatch can react before claims and referral loops saturate.",
    benefits: ["Flood and weather overlap signals", "Water mitigation intent scoring", "Provenance-backed operator queue"]
  },
  {
    icon: Flame,
    title: "Fire and Smoke Restoration",
    description: "Surface fire-adjacent incidents and urgency indicators with auditable source evidence.",
    benefits: ["Incident lane coverage", "Catastrophe readiness context", "Faster triage to inspection workflows"]
  },
  {
    icon: CloudLightning,
    title: "Storm and Catastrophe",
    description: "Use weather-driven surge detection to prioritize high-impact territories when severe events hit.",
    benefits: ["NOAA and disaster context", "Territory-aware prioritization", "Outage and storm response support"]
  },
  {
    icon: Building2,
    title: "Commercial Property Signals",
    description: "Identify commercial facilities with risk and incident overlap to guide high-value outreach.",
    benefits: ["Property signal enrichment", "Market-risk overlays", "Service-line fit scoring"]
  },
  {
    icon: Wrench,
    title: "Home Services Expansion",
    description: "Extend incident and distress coverage into plumbing, HVAC, and outage-driven demand.",
    benefits: ["Utility outage ingestion", "HVAC and plumbing routing", "Mixed-service operator visibility"]
  },
  {
    icon: CheckCircle2,
    title: "Buyer-Proof Operations",
    description: "Expose what is live, blocked, or simulated so teams can trust what counts toward real revenue proof.",
    benefits: ["Capture-status transparency", "Compliance and terms visibility", "Rollout-safe environment gating"]
  }
] as const;

export default function SolutionsPage() {
  return (
    <>
      <TopNav />
      <main>
        <section className="page-section py-16">
          <div className="container text-center">
            <p className="eyebrow justify-center">Solutions</p>
            <h1 className="title-hero mx-auto mt-6 max-w-4xl text-semantic-text">Built for restoration and home-service operators who need reliable demand flow.</h1>
            <p className="text-body-lg mx-auto mt-4 max-w-3xl text-semantic-muted">
              Service Butler supports single-market teams and multi-territory franchises with the same operator-grade control plane.
            </p>
          </div>
        </section>

        <section className="page-section pb-12">
          <div className="container grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {solutions.map((solution) => (
              <Card key={solution.title} className="rounded-2xl border-semantic-border p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                  <solution.icon className="h-5 w-5 text-brand-700" />
                </div>
                <p className="mt-4 text-base font-semibold text-semantic-text">{solution.title}</p>
                <p className="mt-2 text-sm leading-7 text-semantic-muted">{solution.description}</p>
                <ul className="mt-4 space-y-2 text-sm text-semantic-text">
                  {solution.benefits.map((benefit) => (
                    <li key={benefit} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>

        <section className="page-section border-y border-semantic-border/70 bg-white/72 py-12">
          <div className="container grid gap-4 md:grid-cols-2">
            <Card className="rounded-2xl border-semantic-border p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">Independent teams</p>
              <p className="mt-3 text-base font-semibold text-semantic-text">Launch quickly and prioritize local jobs with confidence.</p>
              <p className="mt-2 text-sm leading-7 text-semantic-muted">
                Start with core sources, run scanner daily, and convert high-intent opportunities into scheduled inspections.
              </p>
            </Card>
            <Card className="rounded-2xl border-semantic-border p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">Franchise networks</p>
              <p className="mt-3 text-base font-semibold text-semantic-text">Coordinate territory coverage, readiness, and surge response from one command center.</p>
              <p className="mt-2 text-sm leading-7 text-semantic-muted">
                Use connector truth, compliance gates, and operational dashboards to keep distributed teams aligned.
              </p>
            </Card>
          </div>
        </section>

        <section className="page-section py-12">
          <div className="container text-center">
            <h2 className="section-title text-semantic-text">Choose the rollout path that fits your operation.</h2>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/pricing" className={buttonStyles({ size: "lg" })}>
                View Pricing
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className={buttonStyles({ size: "lg", variant: "secondary" })}>
                Try Demo
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
