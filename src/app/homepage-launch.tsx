import Link from "next/link";
import { ArrowRight, CalendarClock, CloudRain, MapPinned, Radar, ShieldCheck, Wrench } from "lucide-react";
import { Footer } from "@/components/brand/Footer";
import { TopNav } from "@/components/brand/TopNav";
import { buttonStyles } from "@/components/ui/button";

const heroSignals = [
  "NOAA storm and flood alerts",
  "Fire incidents and structure damage",
  "Permit and violation filings",
  "Weather-driven restoration demand"
] as const;

const trustMetrics = [
  ["Storm signal detected", "Opportunity surfaced in minutes"],
  ["Lead created", "Crew scheduled before competitors respond"],
  ["One dispatch flow", "Scanner -> Lead -> Schedule -> Job"]
] as const;

const workflow = [
  ["Signal detected", "Weather, fire, permit, and property-risk events enter the Scanner."],
  ["Opportunity surfaced", "Service Butler ranks the incident, distance, urgency, and service fit."],
  ["Lead created", "Dispatch claims the opportunity and routes it into the operating workflow."],
  ["Meeting scheduled", "The team books inspection or mitigation while the job is still hot."]
] as const;

const industries = [
  ["Restoration", "Water loss, board-up, fire cleanup, mitigation"],
  ["Roofing", "Storm damage, tarping, leak inspections, repairs"],
  ["HVAC", "Outage response, emergency no-cool, same-day service"],
  ["Plumbing", "Burst pipes, flooding, drain issues, emergency dispatch"]
] as const;

const testimonials = [
  ["We can see the storm, claim the lead, and book the inspection from one screen.", "Restoration operator placeholder"],
  ["The Scanner finally feels like a revenue tool, not a dashboard toy.", "Roofing owner placeholder"]
] as const;

export default function LaunchHomepage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Service Butler",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Service Butler helps restoration and home service operators find real opportunities before competitors and convert them into booked jobs."
  };

  return (
    <>
      <TopNav />
      <main>
        <section id="home" className="page-section overflow-hidden pb-16 pt-10">
          <div className="container">
            <div className="grid gap-12 lg:grid-cols-[0.96fr_1.04fr] lg:items-center">
              <div className="max-w-2xl">
                <p className="eyebrow">
                  <ShieldCheck className="h-4 w-4" />
                  Opportunity discovery for restoration and home service teams
                </p>
                <h1 className="title-hero mt-8 max-w-[11ch] text-semantic-text">
                  Find the jobs before competitors do and turn them into booked work.
                </h1>
                <p className="text-body-lg mt-6 max-w-xl text-semantic-muted">
                  Service Butler watches real-world incidents, surfaces the best opportunities, and helps dispatch move
                  from signal to lead to scheduled inspection without losing speed or context.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
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

                <div className="mt-8 flex flex-wrap gap-2">
                  {heroSignals.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-semantic-border bg-semantic-surface px-4 py-2 text-sm font-medium text-semantic-text shadow-sm"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-x-10 top-8 h-44 rounded-full bg-[rgb(var(--sb-primary-soft))] blur-3xl" />
                <div className="relative overflow-hidden rounded-[2rem] border border-semantic-border bg-[rgb(var(--sb-bg))] p-4 shadow-[var(--shadow-lift)] sm:p-6">
                  <div className="rounded-[1.6rem] bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(237,242,238,0.92))] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-semantic-border pb-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Live scanner opportunity</p>
                        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-semantic-text">
                          Storm damage inspection opportunity
                        </h2>
                        <p className="mt-2 text-sm text-semantic-muted">
                          148 Cedar Ridge Drive, Brentwood, NY 11717
                        </p>
                      </div>
                      <div className="rounded-full bg-[rgb(var(--sb-bg))] px-4 py-2 text-sm font-semibold text-white">
                        Schedule inspection
                      </div>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-semantic-border bg-[rgb(var(--sb-bg))] p-5 text-white">
                      <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                        <div className="rounded-[1.35rem] bg-[linear-gradient(160deg,rgba(34,34,34,0.95),rgba(63,78,70,0.92))] p-5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
                              <Radar className="h-3.5 w-3.5" />
                              Scanner
                            </span>
                            <span className="text-sm font-semibold text-brand-200">Intent 92</span>
                          </div>
                          <div className="mt-6 rounded-[1.1rem] bg-white/5 p-4">
                            <div className="flex items-center gap-2 text-white/70">
                              <CloudRain className="h-4 w-4 text-brand-200" />
                              <p className="text-xs font-semibold uppercase tracking-[0.16em]">Signal</p>
                            </div>
                            <p className="mt-3 text-lg font-semibold text-white">NOAA high-wind alert + leak chatter</p>
                            <p className="mt-2 text-sm leading-7 text-white/70">
                              Properties inside the service radius are showing storm exposure and roofing demand.
                            </p>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-3">
                            {[
                              ["Distance", "12 mi"],
                              ["Confidence", "87"],
                              ["Urgency", "Today"]
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">{label}</p>
                                <p className="mt-2 text-sm font-semibold text-white">{value}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-[1.3rem] border border-semantic-border bg-white p-4 text-semantic-text shadow-sm">
                            <div className="flex items-center gap-2 text-brand-700">
                              <MapPinned className="h-4 w-4" />
                              <p className="text-xs font-semibold uppercase tracking-[0.16em]">Opportunity flow</p>
                            </div>
                            <div className="mt-4 space-y-3">
                              {trustMetrics.map(([title, detail]) => (
                                <div key={title} className="rounded-xl bg-semantic-surface2 px-4 py-3">
                                  <p className="text-sm font-semibold text-semantic-text">{title}</p>
                                  <p className="mt-1 text-sm text-semantic-muted">{detail}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-[1.3rem] border border-semantic-border bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Next actions</p>
                            <div className="mt-4 grid gap-3">
                              {["Create lead", "Assign technician", "Book same-day slot"].map((action) => (
                                <div
                                  key={action}
                                  className="flex items-center justify-between rounded-xl border border-semantic-border bg-semantic-surface px-4 py-3 text-sm font-semibold text-semantic-text"
                                >
                                  <span>{action}</span>
                                  <ArrowRight className="h-4 w-4 text-brand-700" />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-semantic-border/70 bg-white/55 py-6">
          <div className="container">
            <div className="grid gap-4 lg:grid-cols-4">
              {workflow.map(([title, copy]) => (
                <div key={title} className="space-y-2 px-1 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">{title}</p>
                  <p className="text-base font-medium text-semantic-text">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="page-section py-14">
          <div className="container">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="max-w-xl">
                <p className="eyebrow">Built for the field</p>
                <h2 className="section-title mt-5 text-semantic-text">
                  The scanner is built for how home service operators actually win work.
                </h2>
                <p className="text-body-lg mt-4 text-semantic-muted">
                  Instead of waiting for inbound calls, dispatch teams can see the incident, understand the opportunity,
                  and act while the market is still moving.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {industries.map(([title, copy]) => (
                  <article key={title} className="rounded-[1.4rem] border border-semantic-border bg-white px-5 py-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                      <Wrench className="h-5 w-5" />
                    </div>
                    <h3 className="title-card mt-4 text-semantic-text">{title}</h3>
                    <p className="mt-2 text-sm leading-7 text-semantic-muted">{copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="page-section pt-0">
          <div className="container">
            <div className="overflow-hidden rounded-[2rem] border border-semantic-border bg-[rgb(var(--sb-bg))] px-6 py-10 text-white shadow-[var(--shadow-lift)] sm:px-10 sm:py-14">
              <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
                <div>
                  <p className="eyebrow bg-white/10 text-white">Proof for launch</p>
                  <h2 className="section-title mt-5 text-white">
                    Show one story clearly: find the opportunity, claim it fast, and schedule the work.
                  </h2>
                  <p className="mt-4 text-lg leading-8 text-white/70">
                    Service Butler should feel calm, credible, and operationally sharp in front of owners, dispatchers,
                    and field teams.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {testimonials.map(([quote, name]) => (
                    <blockquote key={name} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                      <p className="text-sm leading-7 text-white/80">&ldquo;{quote}&rdquo;</p>
                      <footer className="mt-4 text-sm font-semibold text-white">{name}</footer>
                    </blockquote>
                  ))}
                  <div className="rounded-[1.5rem] border border-brand-200/30 bg-brand-50/10 p-5">
                    <div className="flex items-center gap-2 text-brand-200">
                      <CalendarClock className="h-5 w-5" />
                      <p className="text-xs font-semibold uppercase tracking-[0.16em]">Launch demo path</p>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-white/80">
                      Homepage {"->"} Demo login {"->"} Weather setup {"->"} Scanner {"->"} Create lead {"->"} Schedule inspection.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
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
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </>
  );
}
