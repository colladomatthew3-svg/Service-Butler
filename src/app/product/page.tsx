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
      "Our AI scans dozens of data sources, including FEMA alerts, insurance claim databases, municipal permits, and weather APIs, to identify high-intent property damage signals before your competitors."
  },
  {
    icon: Database,
    title: "Lead Enrichment",
    description:
      "Every signal is automatically enriched with property data, owner contact info, estimated job value, and urgency scoring. Get actionable leads, not raw data."
  },
  {
    icon: Route,
    title: "Smart Routing",
    description:
      "Leads are automatically routed to the correct territory based on zip code matching. Overflow rules kick in when territories are at capacity."
  },
  {
    icon: Bell,
    title: "Automated Outreach",
    description:
      "Trigger multi-channel outreach sequences via email, SMS, and phone. Templates adapt based on job type, urgency, and customer profile."
  },
  {
    icon: MapPin,
    title: "Command Center",
    description:
      "A live operations map showing every active opportunity, lead status, and team member location. Real-time updates without page refresh."
  },
  {
    icon: Shield,
    title: "Catastrophe Mode",
    description:
      "When severe weather events hit, the system automatically activates surge protocols, boosting outreach, adjusting pricing, and routing overflow to partner territories."
  }
] as const;

export default function ProductPage() {
  return (
    <>
      <TopNav />
      <main>
        <section className="page-section py-20 md:py-24">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="title-hero mx-auto max-w-4xl text-semantic-text">How Service Butler finds you more jobs</h1>
              <p className="text-body-lg mx-auto mt-4 max-w-2xl text-semantic-muted">
                From signal detection to booked revenue, see how the platform automates the entire restoration lead pipeline.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-semantic-border/70 bg-white/72 py-20">
          <div className="container">
            <h2 className="section-title text-center text-semantic-text">How it works</h2>
            <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-4">
              {[
                { step: "1", title: "Detect", desc: "AI scans weather, insurance, and permit data sources 24/7." },
                { step: "2", title: "Enrich", desc: "Leads are scored and enriched with property and contact data." },
                { step: "3", title: "Route", desc: "Matched to the right territory and assigned to your team." },
                { step: "4", title: "Convert", desc: "Automated outreach drives leads to booked jobs." }
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 text-lg font-semibold text-white">
                    {item.step}
                  </div>
                  <p className="mt-4 text-lg font-semibold text-semantic-text">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-semantic-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="page-section py-20 md:py-24">
          <div className="container">
            <h2 className="section-title text-center text-semantic-text">Platform capabilities</h2>
            <p className="text-body-lg mx-auto mt-4 max-w-3xl text-center text-semantic-muted">
              Every tool you need to capture, manage, and convert restoration opportunities at scale.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((capability) => (
                <Card key={capability.title} className="rounded-2xl border-semantic-border p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
                    <capability.icon className="h-5 w-5 text-brand-700" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-semantic-text">{capability.title}</p>
                  <p className="mt-2 text-sm leading-7 text-semantic-muted">{capability.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[rgb(var(--sb-text))] py-16 text-white">
          <div className="container text-center">
            <h2 className="section-title text-white">See it in action</h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/80">
              Start your free trial and see how opportunities move from signal to booked work.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/pricing"
                className={buttonStyles({
                  size: "lg",
                  className: "min-w-52 bg-white text-[rgb(var(--sb-text))] hover:bg-white/90"
                })}
              >
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
