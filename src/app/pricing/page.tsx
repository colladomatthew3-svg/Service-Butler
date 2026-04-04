import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Footer } from "@/components/brand/Footer";
import { TopNav } from "@/components/brand/TopNav";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const tiers = [
  {
    name: "Starter",
    price: "$99",
    period: "/month",
    description: "For owner-operators validating local demand intelligence.",
    badge: null,
    features: [
      "Up to 2 territories",
      "Core scanner and pipeline views",
      "Data source health and readiness checks",
      "Basic lead and workflow tracking"
    ]
  },
  {
    name: "Pro",
    price: "$299",
    period: "/month",
    description: "For growth teams running multi-channel capture and conversion workflows.",
    badge: "Most Popular",
    features: [
      "Up to 10 territories",
      "Expanded source and connector controls",
      "Operator-grade outbound and routing workflows",
      "Advanced dashboard and opportunity intelligence"
    ]
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For franchise operators and multi-market organizations with strict controls.",
    badge: null,
    features: [
      "Unlimited territories and operator seats",
      "Network and buyer-proof readiness surfaces",
      "Custom onboarding and rollout support",
      "Tenant and compliance policy alignment"
    ]
  }
] as const;

export default function PricingPage() {
  return (
    <>
      <TopNav />
      <main>
        <section className="page-section py-16">
          <div className="container text-center">
            <p className="eyebrow justify-center">Pricing</p>
            <h1 className="title-hero mx-auto mt-6 max-w-4xl text-semantic-text">Transparent plans for every stage of operator maturity.</h1>
            <p className="text-body-lg mx-auto mt-4 max-w-3xl text-semantic-muted">
              Start with a pilot motion, then scale into multi-territory command and buyer-proof operations.
            </p>
          </div>
        </section>

        <section className="page-section pb-12">
          <div className="container grid gap-4 md:grid-cols-3">
            {tiers.map((tier) => (
              <Card key={tier.name} className={`relative rounded-2xl border-semantic-border p-6 ${tier.badge ? "ring-1 ring-brand-700/25" : ""}`}>
                {tier.badge ? <Badge className="absolute -top-3 left-6 bg-brand-700 text-white">{tier.badge}</Badge> : null}
                <p className="text-base font-semibold text-semantic-text">{tier.name}</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-4xl font-semibold text-semantic-text">{tier.price}</span>
                  <span className="pb-1 text-sm text-semantic-muted">{tier.period}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-semantic-muted">{tier.description}</p>
                <ul className="mt-5 space-y-2 text-sm text-semantic-text">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Link href="/login" className={buttonStyles({ fullWidth: true })}>
                    {tier.name === "Enterprise" ? "Contact Sales" : "Try Demo"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="page-section border-y border-semantic-border/70 bg-white/72 py-12">
          <div className="container max-w-3xl">
            <h2 className="section-title text-center text-semantic-text">Frequently asked questions</h2>
            <div className="mt-8 space-y-6">
              {[
                {
                  q: "Can we change plans as we grow?",
                  a: "Yes. Plans can be upgraded as your territory footprint and operator workflow needs expand."
                },
                {
                  q: "What counts as a live source?",
                  a: "A source counts as live when terms and compliance are approved, credentials are configured, and runtime mode is not simulated."
                },
                {
                  q: "Do you support pilot onboarding?",
                  a: "Yes. Service Butler supports pilot activation with source readiness checks and operator runbooks."
                }
              ].map((faq) => (
                <div key={faq.q}>
                  <p className="text-base font-semibold text-semantic-text">{faq.q}</p>
                  <p className="mt-2 text-sm leading-7 text-semantic-muted">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
