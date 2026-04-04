import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, CloudLightning, Droplets, Flame, Bug, Wrench } from "lucide-react";
import { Footer } from "@/components/brand/Footer";
import { TopNav } from "@/components/brand/TopNav";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const solutions = [
  {
    icon: Droplets,
    title: "Water Damage Restoration",
    description: "Monitor flood zones, pipe burst reports, and water-loss signals so teams can react the moment damage appears in territory.",
    benefits: ["Flood alert integration", "Water mitigation intent scoring", "Plumbing emergency overlap"]
  },
  {
    icon: Flame,
    title: "Fire Damage Restoration",
    description: "Track fire-adjacent incidents and urgency signals so operators can move fast after a major property event.",
    benefits: ["Fire incident detection", "Smoke damage lead scoring", "Rapid-response triage workflows"]
  },
  {
    icon: Bug,
    title: "Mold Remediation",
    description: "Identify moisture and mold-related demand using post-flood patterns, public health indicators, and property risk context.",
    benefits: ["Moisture risk scoring", "Post-flood mold detection", "Inspection-driven routing context"]
  },
  {
    icon: CloudLightning,
    title: "Storm Restoration",
    description: "When severe weather hits, move into surge mode with stronger prioritization, overflow support, and territory-level response.",
    benefits: ["Storm tracking context", "Hail and wind damage mapping", "Surge capacity management"]
  },
  {
    icon: Building2,
    title: "Commercial Restoration",
    description: "Track commercial properties with permits, incidents, and facility risk overlap to support higher-value jobs.",
    benefits: ["Commercial property monitoring", "Facility outreach context", "High-value job scoring"]
  },
  {
    icon: Wrench,
    title: "Home Services & HVAC",
    description: "Expand beyond restoration into plumbing, HVAC, electrical, and outage-driven demand from the same command platform.",
    benefits: ["HVAC failure detection", "Utility outage ingestion", "Seasonal demand forecasting"]
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
            <h1 className="title-hero mx-auto mt-6 max-w-4xl text-semantic-text">Solutions for every service line.</h1>
            <p className="text-body-lg mx-auto mt-4 max-w-3xl text-semantic-muted">
              Whether you run a single territory or a multi-state franchise, Service Butler adapts to your service specialties.
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
          <div className="container">
            <h2 className="section-title text-center text-semantic-text">Built for both audiences</h2>
          </div>
          <div className="container grid gap-4 md:grid-cols-2">
            <Card className="rounded-2xl border-semantic-border p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">Independent contractors</p>
              <p className="mt-3 text-base font-semibold text-semantic-text">Stop relying on referrals alone.</p>
              <p className="mt-2 text-sm leading-7 text-semantic-muted">
                Service Butler gives solo operators and small teams a steady stream of high-intent opportunities in their service area.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-semantic-text">
                {["Affordable Starter plan", "Easy setup", "AI does the prospecting for you"].map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="rounded-2xl border-semantic-border p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">Franchise operators</p>
              <p className="mt-3 text-base font-semibold text-semantic-text">Run distributed territory operations from one command center.</p>
              <p className="mt-2 text-sm leading-7 text-semantic-muted">
                Centralized lead routing, catastrophe response, and operational visibility help larger networks stay aligned.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-semantic-text">
                {["Unlimited territory management", "Role-based team access", "Enterprise onboarding support"].map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section className="page-section py-12">
          <div className="container text-center">
            <h2 className="section-title text-semantic-text">Find your perfect fit.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-semantic-muted">
              Pick the plan that matches your business and rollout stage.
            </p>
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
