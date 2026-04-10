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
    description: "Perfect for independent contractors getting started with lead intelligence.",
    badge: null,
    features: [
      "Up to 2 territories",
      "100 opportunities/month",
      "AI lead scoring",
      "Email outreach",
      "Basic analytics",
      "Weather alert monitoring",
      "Community support"
    ]
  },
  {
    name: "Pro",
    price: "$299",
    period: "/month",
    description: "For growing companies that need territory management and advanced automation.",
    badge: "Most Popular",
    features: [
      "Up to 10 territories",
      "Unlimited opportunities",
      "AI lead scoring & enrichment",
      "Multi-channel outreach (email, SMS, calls)",
      "Catastrophe response automation",
      "Territory routing & assignment",
      "Advanced analytics & reporting",
      "CRM integrations",
      "Priority support"
    ]
  },
  {
    name: "Enterprise",
    price: "$799",
    period: "/month",
    description: "For franchise operators managing large multi-location operations.",
    badge: null,
    features: [
      "Unlimited territories",
      "Unlimited opportunities",
      "Everything in Pro",
      "Custom data source integrations",
      "API access",
      "Role-based access control",
      "Overflow routing & surge pricing",
      "Dedicated account manager",
      "Custom onboarding & training",
      "SLA guarantee"
    ]
  }
] as const;

export default function PricingPage() {
  return (
    <>
      <TopNav />
      <main>
        <section className="page-section py-20 md:py-24 text-center">
          <div className="container">
            <h1 className="title-hero mx-auto max-w-4xl text-semantic-text">Simple, transparent pricing</h1>
            <p className="text-body-lg mx-auto mt-4 max-w-2xl text-semantic-muted">
              Start free for 14 days. No credit card required. Scale as your business grows.
            </p>
          </div>
        </section>

        <section className="page-section pb-20">
          <div className="container grid gap-6 md:grid-cols-3">
            {tiers.map((tier) => (
              <Card key={tier.name} className={`relative flex flex-col rounded-2xl border-semantic-border p-6 ${tier.badge ? "ring-1 ring-brand-700/20" : ""}`}>
                {tier.badge ? <Badge variant="brand" className="absolute -top-3 left-6">{tier.badge}</Badge> : null}
                <p className="text-xl font-semibold text-semantic-text">{tier.name}</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-4xl font-semibold text-semantic-text">{tier.price}</span>
                  <span className="pb-1 text-sm text-semantic-muted">{tier.period}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-semantic-muted">{tier.description}</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm text-semantic-text">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Link href="/login" className={buttonStyles({ fullWidth: true, size: "lg" })}>
                    {tier.name === "Enterprise" ? "Contact Sales" : "Start Free Trial"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y border-semantic-border/70 bg-white/72 py-20">
          <div className="container max-w-3xl">
            <h2 className="section-title text-center text-semantic-text">Frequently asked questions</h2>
            <div className="mt-10 space-y-8">
              {[
                {
                  q: "Can I change plans later?",
                  a: "Yes, you can upgrade or downgrade at any time. Changes take effect at your next billing cycle."
                },
                {
                  q: "What counts as an opportunity?",
                  a: "An opportunity is any lead signal detected from our connected data sources, weather alerts, permit data, or manual entries."
                },
                {
                  q: "Do you offer annual discounts?",
                  a: "Yes. Save 20% when you pay annually. Contact sales for enterprise annual pricing."
                },
                {
                  q: "Is there a free trial?",
                  a: "Every plan includes a 14-day free trial with full access. No credit card required to start."
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
