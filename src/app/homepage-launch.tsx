import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Clock,
  MapPin,
  Shield,
  TrendingUp,
  Users,
  Zap
} from "lucide-react";
import { Footer } from "@/components/brand/Footer";
import { TopNav } from "@/components/brand/TopNav";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const features = [
  {
    icon: Zap,
    title: "AI Opportunity Detection",
    description:
      "Automatically surface water damage, fire, mold, and storm restoration opportunities from insurance claims, weather alerts, and permit data."
  },
  {
    icon: MapPin,
    title: "Territory Intelligence",
    description:
      "Route leads to the right franchise territory instantly. Geo-fence zip codes, manage coverage zones, and eliminate missed opportunities."
  },
  {
    icon: BarChart3,
    title: "Revenue Pipeline",
    description:
      "Track every opportunity from signal to booked job. See urgency scores, job likelihood, and estimated revenue at a glance."
  },
  {
    icon: Shield,
    title: "Catastrophe Response",
    description:
      "When disasters strike, automatically trigger outreach campaigns to affected zones. Surge pricing and overflow routing built in."
  },
  {
    icon: Clock,
    title: "Realtime Command Center",
    description:
      "Live operations map with instant updates. Monitor active opportunities, lead status, and team performance in real time."
  },
  {
    icon: Users,
    title: "Multi-Location Management",
    description:
      "Manage dozens of territories from a single dashboard. Role-based access for operators, dispatchers, and admins."
  }
] as const;

const stats = [
  { value: "3x", label: "Faster lead response" },
  { value: "40%", label: "More jobs booked" },
  { value: "90%", label: "Territory coverage" },
  { value: "$2.4M", label: "Avg. revenue lift per franchise" }
] as const;

export default function LaunchHomepage() {
  return (
    <>
      <TopNav />
      <main>
        <section className="page-section relative overflow-hidden py-20 md:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(48,101,244,0.10),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(37,179,135,0.10),transparent_30%)]" />
          <div className="container relative">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-100/80 px-4 py-1.5 text-sm font-medium text-brand-700">
                <TrendingUp className="h-3.5 w-3.5" />
                AI-Powered Opportunity Intelligence
              </div>
              <h1 className="title-hero mx-auto mt-6 max-w-4xl text-semantic-text">
                Never miss a restoration <span className="text-brand-700">opportunity</span> again
              </h1>
              <p className="text-body-lg mx-auto mt-5 max-w-2xl text-semantic-muted">
                Service Butler scans insurance claims, weather alerts, and property data to surface high-value leads
                and route them to the right territory instantly.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/pricing" className={buttonStyles({ size: "lg", className: "min-w-52" })}>
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/product" className={buttonStyles({ size: "lg", variant: "secondary", className: "min-w-52" })}>
                  See How It Works
                </Link>
              </div>
              <p className="mt-4 text-xs text-semantic-muted">
                No credit card required · 14-day free trial · Cancel anytime
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-semantic-border/70 bg-white/72 py-12">
          <div className="container grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-display text-3xl font-bold text-brand-700 md:text-4xl">{stat.value}</div>
                <div className="mt-1 text-sm text-semantic-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="page-section py-20 md:py-24">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="section-title text-semantic-text">Everything you need to dominate your territory</h2>
              <p className="text-body-lg mt-4 text-semantic-muted">
                From signal detection to booked job, Service Butler automates the full pipeline for restoration and home
                service companies.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title} className="rounded-2xl border-semantic-border p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
                    <feature.icon className="h-5 w-5 text-brand-700" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-semantic-text">{feature.title}</p>
                  <p className="mt-2 text-sm leading-7 text-semantic-muted">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[rgb(var(--sb-text))] py-20 text-white">
          <div className="container text-center">
            <h2 className="section-title text-white">Ready to grow your restoration business?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/80">
              Join contractors and franchise operators using Service Butler to find and convert more opportunities.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/pricing"
                className={buttonStyles({
                  size: "lg",
                  className: "min-w-52 bg-white text-[rgb(var(--sb-text))] hover:bg-white/90"
                })}
              >
                View Pricing
              </Link>
              <Link
                href="/product"
                className={buttonStyles({
                  size: "lg",
                  variant: "secondary",
                  className: "min-w-52 border-white/20 bg-white/10 text-white hover:bg-white/20"
                })}
              >
                Learn More
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
