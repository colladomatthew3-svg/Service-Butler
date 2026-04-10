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
    description:
      "Monitor flood zones, pipe burst reports, and insurance claims. Get notified the moment water damage occurs in your territory.",
    benefits: ["FEMA flood alert integration", "Insurance claim monitoring", "Plumbing emergency detection"]
  },
  {
    icon: Flame,
    title: "Fire Damage Restoration",
    description:
      "Track fire department dispatches and insurance claim filings. Be the first contractor on-site after a fire event.",
    benefits: ["Fire incident detection", "Smoke damage lead scoring", "Automated rapid response"]
  },
  {
    icon: Bug,
    title: "Mold Remediation",
    description:
      "Identify properties with moisture and mold indicators from inspection reports, health department filings, and real estate listings.",
    benefits: ["Moisture risk scoring", "Post-flood mold detection", "Inspection report mining"]
  },
  {
    icon: CloudLightning,
    title: "Storm Restoration",
    description:
      "When severe weather hits, activate catastrophe mode with surge outreach, overflow routing, and mass lead processing.",
    benefits: ["NWS storm tracking", "Hail and wind damage mapping", "Surge capacity management"]
  },
  {
    icon: Building2,
    title: "Commercial Restoration",
    description:
      "Tap into commercial property damage opportunities from building permits, code violations, and facility management RFPs.",
    benefits: ["Commercial property monitoring", "Facility manager outreach", "High-value job scoring"]
  },
  {
    icon: Wrench,
    title: "Home Services & HVAC",
    description:
      "Expand beyond restoration and capture plumbing, HVAC, and electrical leads from the same property intelligence platform.",
    benefits: ["HVAC failure detection", "Plumbing emergency alerts", "Seasonal demand forecasting"]
  }
] as const;

export default function SolutionsPage() {
  return (
    <>
      <TopNav />
      <main>
        <section className="page-section py-20 md:py-24 text-center">
          <div className="container">
            <h1 className="title-hero mx-auto max-w-4xl text-semantic-text">Solutions for every service line</h1>
            <p className="text-body-lg mx-auto mt-4 max-w-3xl text-semantic-muted">
              Whether you&apos;re a single-territory contractor or a multi-state franchise, Service Butler adapts to your service specialties.
            </p>
          </div>
        </section>

        <section className="page-section pb-20">
          <div className="container grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {solutions.map((solution) => (
              <Card key={solution.title} className="rounded-2xl border-semantic-border p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
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

        <section className="border-y border-semantic-border/70 bg-white/72 py-20">
          <div className="container">
            <h2 className="section-title text-center text-semantic-text">Built for both audiences</h2>
            <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
              <Card className="rounded-2xl border-semantic-border p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">Independent Contractors</p>
                <p className="mt-4 text-xl font-semibold text-semantic-text">Stop relying on referrals alone.</p>
                <p className="mt-3 text-sm leading-7 text-semantic-muted">
                  Service Butler gives you a steady pipeline of high-intent leads in your service area, priced for solo operators.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-semantic-text">
                  {["Affordable Starter plan", "Easy 5-minute setup", "AI does the prospecting for you"].map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="rounded-2xl border-semantic-border p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">Franchise Operators</p>
                <p className="mt-4 text-xl font-semibold text-semantic-text">Manage large multi-location operations from one command center.</p>
                <p className="mt-3 text-sm leading-7 text-semantic-muted">
                  Centralized lead routing, catastrophe response, and performance analytics across your network.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-semantic-text">
                  {["Unlimited territory management", "Role-based team access", "Enterprise SLA and onboarding"].map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </section>

        <section className="page-section py-16 text-center">
          <div className="container">
            <h2 className="section-title text-semantic-text">Find your perfect fit</h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-semantic-muted">
              Pick the plan that matches your business. Every plan includes a 14-day free trial.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/pricing" className={buttonStyles({ size: "lg", className: "min-w-52" })}>
                View Pricing
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className={buttonStyles({ size: "lg", variant: "secondary", className: "min-w-52" })}>
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
