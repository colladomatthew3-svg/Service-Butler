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
      "Our AI scans weather APIs, municipal permits, public incidents, and local demand signals to identify high-intent property-service opportunities before competitors react."
  },
  {
    icon: Database,
    title: "Lead Enrichment",
    description: "Every signal is enriched with service fit, contact context, source provenance, and urgency scoring so operators work actionable leads instead of raw noise."
  },
  {
    icon: Route,
    title: "Smart Routing",
    description: "Leads route to the right territory and service line with operator controls, overflow handling, and audit-safe workflow rules."
  },
  {
    icon: Bell,
    title: "Automated Outreach",
    description: "Trigger email, SMS, and operator follow-up sequences with channel safeguards, safe mode, and tenant-scoped controls."
  },
  {
    icon: MapPin,
    title: "Command Center",
    description: "A live operations view for opportunities, lead status, routing context, and source health so teams can move from signal to booked work quickly."
  },
  {
    icon: Shield,
    title: "Catastrophe Mode",
    description: "When severe events hit, operators can shift into surge workflows with stronger prioritization, territory support, and visible readiness controls."
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
            <h1 className="title-hero mx-auto mt-6 max-w-4xl text-semantic-text">How Service Butler finds you more jobs.</h1>
            <p className="text-body-lg mx-auto mt-4 max-w-3xl text-semantic-muted">
              From signal detection to booked revenue, Service Butler automates the restoration and home-service lead pipeline with operator-grade control.
            </p>
          </div>
        </section>

        <section className="page-section border-y border-semantic-border/70 bg-white/72 py-12">
          <div className="container">
            <h2 className="section-title text-center text-semantic-text">How it works</h2>
            <div className="mt-8 grid gap-4 lg:grid-cols-4">
              {[
                { step: "1", title: "Detect", desc: "AI scans weather, public incidents, and permit sources around the clock." },
                { step: "2", title: "Enrich", desc: "Opportunities are scored and enriched with contact and property context." },
                { step: "3", title: "Route", desc: "Matched to the right territory and assigned into your operator workflow." },
                { step: "4", title: "Convert", desc: "Outreach and dispatch actions move leads into booked jobs." }
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
            <p className="text-body-lg mx-auto mt-4 max-w-3xl text-center text-semantic-muted">
              Every tool you need to capture, manage, and convert restoration opportunities at scale.
            </p>
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
            <h2 className="section-title text-white">See it in action</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-white/80">
              Start a demo and see how opportunities move from live signals to booked work in one command center.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/login" className={buttonStyles({ size: "lg", variant: "secondary", className: "border-white/20 bg-white/10 text-white hover:bg-white/20" })}>
                Try Demo
              </Link>
              <Link href="/pricing" className={buttonStyles({ size: "lg", className: "bg-white text-[rgb(var(--sb-text))] hover:bg-white/90" })}>
                Get Started
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
