import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Star,
  Workflow,
  Wrench
} from "lucide-react";
import { Footer } from "@/components/brand/Footer";
import { TopNav } from "@/components/brand/TopNav";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";

const trustMetrics = [
  ["38%", "faster first response"],
  ["3.2x", "more opportunities converted"],
  ["24/7", "weather-triggered lead detection"]
] as const;

const workflowSteps = [
  ["Weather signal", "Storm risk and heavy rain spike urgency in the service area."],
  ["Scanner", "Service Butler finds opportunities with matched service demand and location context."],
  ["Opportunity", "Dispatch sees why the job exists before deciding what to do next."],
  ["Lead", "The best opportunities convert into triaged leads with context already attached."],
  ["Scheduled Job", "The team books a slot and moves work into the operating calendar."]
] as const;

const productProofs = [
  {
    title: "Scanner",
    eyebrow: "Opportunity detection",
    description: "Weather signals, service fit, and distance are surfaced in one decision card.",
    accent: "Scanner",
    stats: ["Storm risk detected", "12 mi radius", "Restoration demand"]
  },
  {
    title: "Pipeline",
    eyebrow: "Revenue flow",
    description: "See which jobs need follow-up and which opportunities are closest to booked revenue.",
    accent: "Pipeline",
    stats: ["18 new", "11 qualified", "7 booked"]
  },
  {
    title: "Inbox",
    eyebrow: "Lead triage",
    description: "Every missed call and follow-up request lands in one prioritized work queue.",
    accent: "Inbox",
    stats: ["High intent first", "Shared team context", "Quick replies ready"]
  },
  {
    title: "Schedule",
    eyebrow: "Dispatch view",
    description: "Convert approved work into scheduled jobs with crew visibility and timing context.",
    accent: "Schedule",
    stats: ["Crew availability", "Same-day slots", "Calendar confidence"]
  }
] as const;

const industries = [
  ["HVAC", "Catch emergency service demand before competitors answer the phone."],
  ["Roofing", "Turn storm pressure into booked inspections and fast insurance-response work."],
  ["Plumbing", "Prioritize leaks, drain issues, and water damage calls with urgency context."],
  ["Restoration", "Route weather-triggered claims into lead intake and scheduled mitigation faster."]
] as const;

const testimonials = [
  ["Service Butler made the weather story obvious for my dispatchers. We know what to call first and why.", "HVAC operator placeholder"],
  ["It feels like our lead inbox, scanner, and schedule finally belong to one product.", "Roofing owner placeholder"],
  ["The demo shows the full path from storm signal to booked job without any hand-waving.", "Restoration GM placeholder"]
] as const;

export default function LaunchHomepage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Service Butler",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Service Butler helps home service businesses detect weather-driven demand, convert opportunities into leads, and schedule jobs faster."
  };

  return (
    <>
      <TopNav />
      <main>
        <section id="home" className="page-section overflow-hidden pb-10">
          <div className="container">
            <div className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
              <div>
                <p className="eyebrow">
                  <ShieldCheck className="h-4 w-4" />
                  Launch-ready AI operations for home service teams
                </p>
                <h1 className="title-hero mt-7 max-w-[13ch] text-semantic-text">
                  Turn weather signals into more jobs, faster response, and tighter scheduling.
                </h1>
                <p className="text-body-lg mt-6 max-w-2xl text-semantic-muted">
                  Service Butler uses AI lead detection to find demand spikes, explain why each opportunity matters,
                  and move work from Scanner to Leads, Inbox, Schedule, Pipeline, and Billing without losing context.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/login" className={buttonStyles({ size: "lg" })}>
                    Try Demo
                  </Link>
                  <a
                    href="mailto:sales@servicebutler.ai?subject=Service%20Butler%20Demo"
                    className={buttonStyles({ size: "lg", variant: "secondary" })}
                  >
                    Book Demo
                  </a>
                </div>
                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                  {trustMetrics.map(([value, label]) => (
                    <div key={label} className="section-shell p-5">
                      <p className="font-heading text-3xl font-bold tracking-tight text-semantic-text">{value}</p>
                      <p className="mt-2 text-sm text-semantic-muted">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="section-shell brand-gradient surface-grid relative overflow-hidden p-5 sm:p-6">
                <div className="grid gap-4">
                  <div className="rounded-2xl border border-semantic-border bg-semantic-surface p-4 shadow-soft">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-semantic-text">Scanner sees a storm-response opening</p>
                        <p className="mt-1 text-sm text-semantic-muted">
                          Heavy rain in Brentwood is increasing restoration demand inside the saved service radius.
                        </p>
                      </div>
                      <Badge variant="brand">Weather lead</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <ProofPanel
                        title="Opportunity"
                        lines={["Heavy rain signal", "Restoration service match", "12 mi from service area"]}
                      />
                      <ProofPanel
                        title="Next action"
                        lines={["Create lead", "Route to inbox", "Offer same-day slot"]}
                        accent
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-2xl bg-neutral-950 p-5 text-white shadow-[var(--shadow-lift)]">
                      <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <div>
                          <p className="text-sm font-semibold text-white">Workflow conversion</p>
                          <p className="mt-1 text-sm text-white/60">Signal to booked job in one operating flow.</p>
                        </div>
                        <Badge className="bg-white/10 text-white ring-white/10">Live demo</Badge>
                      </div>
                      <div className="mt-5 space-y-3">
                        {[
                          ["Scanner", "12 opportunities", "Weather + distance + service match"],
                          ["Leads", "4 high-intent", "Qualified and ready for outreach"],
                          ["Schedule", "2 same-day slots", "Crew B and Crew C available"]
                        ].map(([title, value, detail]) => (
                          <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-white">{title}</p>
                              <p className="text-sm font-semibold text-brand-200">{value}</p>
                            </div>
                            <p className="mt-2 text-sm text-white/65">{detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="section-shell p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Inbox</p>
                        <div className="mt-3 space-y-3">
                          <MiniRow title="Emergency leak callback" detail="High intent · Plumbing · 8 minutes ago" />
                          <MiniRow title="Storm roof inspection" detail="New lead · Roofing · same-day window" />
                          <MiniRow title="Water damage follow-up" detail="Qualified · Restoration · insured" />
                        </div>
                      </div>
                      <div className="section-shell p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Schedule</p>
                        <div className="mt-3 space-y-3">
                          <MiniRow title="2:00 PM mitigation visit" detail="Crew B · Brentwood" />
                          <MiniRow title="4:30 PM roof inspection" detail="Crew C · Hauppauge" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="page-section pt-0">
          <div className="container">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="eyebrow">Product proof</p>
                <h2 className="section-title mt-5">Show the product, not just the promise</h2>
                <p className="text-body-lg mt-4 text-semantic-muted">
                  Service Butler is strongest when the team can see the full path from signal detection to scheduled job.
                </p>
              </div>
              <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                Open the product demo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 grid gap-4 xl:grid-cols-2">
              {productProofs.map((proof) => (
                <article key={proof.title} className="section-shell overflow-hidden p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">{proof.eyebrow}</p>
                      <h3 className="title-card mt-3 text-semantic-text">{proof.title}</h3>
                    </div>
                    <Badge variant="brand">{proof.accent}</Badge>
                  </div>
                  <div className="mt-5 rounded-2xl border border-semantic-border bg-semantic-surface2 p-4">
                    <div className="flex items-center justify-between border-b border-semantic-border pb-3">
                      <p className="text-sm font-semibold text-semantic-text">{proof.title} preview</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Launch demo</p>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {proof.stats.map((stat) => (
                        <div
                          key={stat}
                          className="rounded-xl border border-semantic-border bg-semantic-surface px-4 py-3 text-sm font-medium text-semantic-text"
                        >
                          {stat}
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-semantic-muted">{proof.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="page-section bg-semantic-surface/55">
          <div className="container">
            <div className="max-w-3xl">
              <p className="eyebrow">Workflow</p>
              <h2 className="section-title mt-5">Weather signal to scheduled job, with no broken handoff in the middle</h2>
              <p className="text-body-lg mt-4 text-semantic-muted">
                The product architecture is already there. The launch story should make each step legible in seconds.
              </p>
            </div>

            <div className="mt-10 grid gap-4 xl:grid-cols-5">
              {workflowSteps.map(([title, detail], index) => (
                <article key={title} className="section-shell h-full p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                      0{index + 1}
                    </span>
                    {index < workflowSteps.length - 1 && <Workflow className="h-4 w-4 text-semantic-muted" />}
                  </div>
                  <h3 className="title-card mt-5 text-semantic-text">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-semantic-muted">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="page-section">
          <div className="container">
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
              <div className="max-w-2xl">
                <p className="eyebrow">Built for the trades</p>
                <h2 className="section-title mt-5">One product, tuned for the urgency patterns contractors actually live in</h2>
                <p className="text-body-lg mt-4 text-semantic-muted">
                  Different service lines feel weather pressure differently. Service Butler makes that operational signal usable.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {industries.map(([title, copy]) => (
                  <article key={title} className="section-shell p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                      <Wrench className="h-5 w-5" />
                    </div>
                    <h3 className="title-card mt-5 text-semantic-text">{title}</h3>
                    <p className="mt-3 text-sm leading-7 text-semantic-muted">{copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="page-section pt-0">
          <div className="container">
            <div
              className="rounded-[2rem] px-6 py-10 text-white shadow-[var(--shadow-lift)] sm:px-10 sm:py-14"
              style={{ backgroundColor: "rgb(var(--sb-bg))" }}
            >
              <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
                <div>
                  <p className="eyebrow bg-white/10 text-white">Trust placeholders</p>
                  <h2 className="section-title mt-5 text-white">Built to look credible in front of operators, dispatchers, and owners</h2>
                  <p className="mt-4 text-lg leading-8 text-white/70">
                    Keep the messaging practical: find opportunities, explain why they matter, and turn them into booked work.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {testimonials.map(([quote, name]) => (
                    <blockquote key={name} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                      <div className="flex gap-1 text-brand-200">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star key={index} className="h-4 w-4 fill-current" />
                        ))}
                      </div>
                      <p className="mt-4 text-sm leading-7 text-white/80">&ldquo;{quote}&rdquo;</p>
                      <footer className="mt-5 text-sm font-semibold text-white">{name}</footer>
                    </blockquote>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="page-section pt-0">
          <div className="container">
            <div className="section-shell brand-gradient surface-grid overflow-hidden px-6 py-10 sm:px-10 sm:py-14">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="max-w-2xl">
                  <p className="eyebrow">Final CTA</p>
                  <h2 className="section-title mt-5">Run the launch demo: weather setup, scanner, lead conversion, scheduled job</h2>
                  <p className="text-body-lg mt-4 text-semantic-muted">
                    The current demo flow already proves the product value. This launch pass makes that value easier to understand and trust.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href="/login" className={buttonStyles({ size: "lg" })}>
                    Try Demo
                  </Link>
                  <a
                    href="mailto:sales@servicebutler.ai?subject=Service%20Butler%20Launch%20Demo"
                    className={buttonStyles({ size: "lg", variant: "secondary" })}
                  >
                    Book Demo
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </>
  );
}

function ProofPanel({
  title,
  lines,
  accent
}: {
  title: string;
  lines: string[];
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent ? "border-brand-200 bg-brand-50" : "border-semantic-border bg-semantic-surface2"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">{title}</p>
      <div className="mt-3 space-y-2">
        {lines.map((line) => (
          <div key={line} className="flex items-center gap-2 text-sm font-medium text-semantic-text">
            <CheckCircle2 className="h-4 w-4 text-brand-700" />
            <span>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-semantic-border bg-semantic-surface2 px-4 py-3">
      <p className="text-sm font-semibold text-semantic-text">{title}</p>
      <p className="mt-1 text-sm text-semantic-muted">{detail}</p>
    </div>
  );
}
