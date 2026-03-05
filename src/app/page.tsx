import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarClock, ChartColumnIncreasing, ShieldCheck, Sparkles, Star, Workflow } from "lucide-react";
import { Footer } from "@/components/brand/Footer";
import { TopNav } from "@/components/brand/TopNav";
import { Badge } from "@/components/ui/badge";

const featureCards = [
  {
    title: "Instant lead capture",
    copy: "Missed calls, web forms, and text replies arrive in one triaged inbox with urgency and service tags already applied.",
    icon: Workflow
  },
  {
    title: "Automated follow-up",
    copy: "AI sequences keep the conversation moving, collect scope details, and stop the moment a human should take over.",
    icon: Sparkles
  },
  {
    title: "Scheduling that closes faster",
    copy: "Dispatchers assign the right crew, protect response-time SLAs, and keep technicians informed before wheels roll.",
    icon: CalendarClock
  },
  {
    title: "Clear operational reporting",
    copy: "Owners see lead response, booked revenue, and pipeline health in one place without juggling separate tools.",
    icon: ChartColumnIncreasing
  }
] as const;

const timelineSteps = [
  ["00:00", "Lead created", "New missed call from a homeowner is captured, tagged, and routed to dispatch."],
  ["00:45", "AI qualifies", "Customer receives a fast text follow-up and confirms service type and preferred window."],
  ["03:10", "Dispatcher books", "Estimate and technician notes are prepared with the full conversation attached."],
  ["05:00", "Job confirmed", "Customer receives confirmation, reminders, and a clean next-step handoff."]
] as const;

const trustMetrics = [
  ["38%", "faster response times"],
  ["3.2x", "more booked jobs from missed calls"],
  ["24/7", "coverage without adding headcount"]
] as const;

const testimonials = [
  ["It finally feels like our phones, dispatch board, and follow-up playbooks belong to the same company.", "Jackson Price", "HVAC owner, Tampa"],
  ["Customers get answers quicker, and my team no longer has to reconstruct context from five different tools.", "Erica Molina", "Plumbing dispatcher, Orlando"],
  ["We look more professional because every handoff is cleaner, faster, and documented.", "Marcus Vaughn", "Electrical contractor, Jacksonville"]
] as const;

const pricingTiers = [
  {
    name: "Starter",
    price: "$299",
    description: "For smaller teams replacing spreadsheets and missed-call chaos.",
    points: ["Unlimited leads", "Shared inbox", "Basic automations"],
    featured: false
  },
  {
    name: "Growth",
    price: "$699",
    description: "For scaling operators who need dispatch coordination and reporting.",
    points: ["Everything in Starter", "Dispatch workflows", "Revenue reporting"],
    featured: true
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For multi-location teams that need advanced routing, controls, and onboarding.",
    points: ["Custom playbooks", "Priority support", "Implementation services"],
    featured: false
  }
] as const;

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Service Butler",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "AI-powered lead intake, scheduling, dispatch, and follow-up software for home service businesses.",
    offers: pricingTiers.map((tier) => ({
      "@type": "Offer",
      name: tier.name,
      price: tier.price === "Custom" ? undefined : tier.price.replace("$", ""),
      priceCurrency: "USD"
    }))
  };

  return (
    <>
      <TopNav />
      <main>
        <section id="home" className="page-section overflow-hidden">
          <div className="container">
            <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div>
                <p className="eyebrow">
                  <ShieldCheck className="h-4 w-4" />
                  Premium AI operations for home service teams
                </p>
                <h1 className="title-hero mt-7 max-w-[12ch] text-semantic-text">
                  Win more leads and run a tighter service business.
                </h1>
                <p className="text-body-lg mt-6 max-w-2xl text-semantic-muted">
                  Service Butler helps contractors capture every opportunity, automate qualification, and turn messy
                  dispatch operations into a polished customer experience.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/login"
                    className="inline-flex h-14 items-center rounded-xl bg-semantic-brand px-6 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(136,188,66,0.28)] transition hover:bg-semantic-brandHover"
                  >
                    Start Free Trial
                  </Link>
                  <Link
                    href="/dashboard"
                    className="inline-flex h-14 items-center rounded-xl border border-semantic-border bg-semantic-surface px-6 text-sm font-semibold text-semantic-text transition hover:bg-semantic-surface2"
                  >
                    See Product Tour
                  </Link>
                </div>
                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                  {trustMetrics.map(([value, label]) => (
                    <div key={label} className="rounded-2xl border border-semantic-border bg-semantic-surface px-5 py-5 shadow-soft">
                      <p className="font-heading text-3xl font-bold tracking-tight text-semantic-text">{value}</p>
                      <p className="mt-2 text-sm text-semantic-muted">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="section-shell brand-gradient surface-grid relative overflow-hidden p-4 sm:p-6">
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/65 to-transparent" />
                <div className="relative space-y-4">
                  <div className="flex items-center justify-between rounded-2xl border border-semantic-border bg-semantic-surface px-5 py-4 shadow-soft">
                    <div>
                      <p className="text-sm font-semibold text-semantic-text">Lead response board</p>
                      <p className="mt-1 text-sm text-semantic-muted">Every opportunity routed, qualified, and visible.</p>
                    </div>
                    <Badge variant="brand">12 new today</Badge>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                    <div className="rounded-[1.6rem] border border-semantic-border bg-[#142118] p-5 text-white shadow-[var(--shadow-lift)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white/90">Today&apos;s booked revenue</p>
                          <p className="mt-2 font-heading text-4xl font-bold">$18,420</p>
                        </div>
                        <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
                          <p className="text-xs uppercase tracking-[0.16em] text-white/60">Close rate</p>
                          <p className="mt-1 text-2xl font-semibold text-brand-200">41%</p>
                        </div>
                      </div>
                      <div className="mt-6 grid gap-3">
                        {timelineSteps.map(([time, title, copy]) => (
                          <div key={time} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">{time}</p>
                              <p className="text-sm font-semibold text-white">{title}</p>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-white/68">{copy}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-semantic-border bg-semantic-surface p-4 shadow-soft">
                        <Image
                          src="/stock/crew.svg"
                          alt="Dispatch team using Service Butler"
                          width={1200}
                          height={900}
                          sizes="(max-width: 1279px) 100vw, 30vw"
                          priority
                          className="h-48 w-full rounded-xl object-cover"
                        />
                        <p className="mt-4 text-sm font-semibold text-semantic-text">Dispatch workspace</p>
                        <p className="mt-1 text-sm leading-6 text-semantic-muted">
                          Give every dispatcher a cleaner queue, tighter response windows, and clearer customer context.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 shadow-soft">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">AI Assistant</p>
                        <p className="mt-3 text-sm leading-6 text-semantic-text">
                          &ldquo;Customer confirms rooftop unit issue, wants same-day service, and approved a 2pm to 4pm
                          arrival window. Recommend dispatching Crew B.&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="page-section pt-0">
          <div className="container">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="eyebrow">Feature highlights</p>
                <h2 className="section-title mt-5">The operating system for fast-moving contractors</h2>
                <p className="text-body-lg mt-4 text-semantic-muted">
                  Each workflow is designed to reduce lag between inquiry, estimate, dispatch, and completed job.
                </p>
              </div>
              <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                Explore product capabilities
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {featureCards.map((card) => {
                const Icon = card.icon;

                return (
                  <article key={card.title} className="section-shell h-full p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="title-card mt-5 text-semantic-text">{card.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-semantic-muted">{card.copy}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="page-section bg-semantic-surface/55">
          <div className="container">
            <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
              <div className="max-w-xl">
                <p className="eyebrow">Product screenshots</p>
                <h2 className="section-title mt-5">See how Service Butler turns scattered work into one clear command center</h2>
                <p className="text-body-lg mt-4 text-semantic-muted">
                  The product surface is built to make the team look sharper to customers while making day-to-day
                  decisions easier for operators.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="section-shell overflow-hidden bg-neutral-900 p-5 text-white">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <p className="text-sm font-semibold text-white">Pipeline overview</p>
                      <p className="mt-1 text-sm text-white/60">See which jobs need action before revenue slips.</p>
                    </div>
                    <Badge className="bg-white/10 text-white ring-white/10">Live</Badge>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {[
                      ["New", "18", "bg-[#213228]"],
                      ["Qualified", "11", "bg-[#2d261d]"],
                      ["Booked", "7", "bg-[#1a2d38]"]
                    ].map(([label, value, tone]) => (
                      <div key={label} className={`rounded-2xl px-4 py-4 ${tone}`}>
                        <p className="text-xs uppercase tracking-[0.14em] text-white/55">{label}</p>
                        <p className="mt-2 font-heading text-3xl font-bold">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-semibold">Crew load balancing</p>
                    <div className="mt-4 space-y-3">
                      {[
                        ["Crew A", "92%", "bg-brand-400"],
                        ["Crew B", "66%", "bg-accent-500"],
                        ["Crew C", "41%", "bg-white/60"]
                      ].map(([crew, value, color]) => (
                        <div key={crew}>
                          <div className="mb-1 flex items-center justify-between text-sm text-white/70">
                            <span>{crew}</span>
                            <span>{value}</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10">
                            <div className={`h-2 rounded-full ${color}`} style={{ width: value }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="section-shell p-4">
                    <Image
                      src="/stock/truck.svg"
                      alt="Field team and branded service truck"
                      width={1200}
                      height={900}
                      sizes="(max-width: 1279px) 100vw, 24vw"
                      className="h-52 w-full rounded-xl object-cover"
                    />
                    <p className="mt-4 text-sm font-semibold text-semantic-text">Field-ready scheduling</p>
                    <p className="mt-1 text-sm leading-6 text-semantic-muted">
                      Customers, technicians, and dispatch all work from the same clean job record.
                    </p>
                  </div>
                  <div className="section-shell p-4">
                    <Image
                      src="/stock/tools.svg"
                      alt="Technician tools prepared for service call"
                      width={1200}
                      height={900}
                      sizes="(max-width: 1279px) 100vw, 24vw"
                      className="h-40 w-full rounded-xl object-cover"
                    />
                    <p className="mt-4 text-sm font-semibold text-semantic-text">Prepared technicians</p>
                    <p className="mt-1 text-sm leading-6 text-semantic-muted">
                      Notes, scope, and customer expectations follow the job so crews arrive ready.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="page-section">
          <div className="container">
            <div className="rounded-[2rem] bg-[#172119] px-6 py-10 text-white shadow-[var(--shadow-lift)] sm:px-10 sm:py-14">
              <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
                <div>
                  <p className="eyebrow bg-white/10 text-white">Trust and credibility</p>
                  <h2 className="section-title mt-5 text-white">Built to make your business look buttoned-up from first touch to final invoice</h2>
                  <p className="mt-4 text-lg leading-8 text-white/70">
                    Contractors adopt Service Butler because it improves response speed without making the team feel like
                    it&apos;s working inside a robot.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {testimonials.map(([quote, name, company]) => (
                    <blockquote key={name} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                      <div className="flex gap-1 text-brand-200">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star key={index} className="h-4 w-4 fill-current" />
                        ))}
                      </div>
                      <p className="mt-4 text-sm leading-7 text-white/80">&ldquo;{quote}&rdquo;</p>
                      <footer className="mt-5">
                        <p className="text-sm font-semibold text-white">{name}</p>
                        <p className="text-sm text-white/55">{company}</p>
                      </footer>
                    </blockquote>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="page-section pt-0">
          <div className="container">
            <div className="max-w-2xl">
              <p className="eyebrow">Pricing</p>
              <h2 className="section-title mt-5">Plans that scale with the speed of your operation</h2>
              <p className="text-body-lg mt-4 text-semantic-muted">
                Structured for owners who want software that improves the front office and field experience at the same time.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {pricingTiers.map((tier) => (
                <article
                  key={tier.name}
                  className={`section-shell flex h-full flex-col p-6 ${tier.featured ? "border-brand-300 bg-brand-50/70 shadow-card" : ""}`}
                >
                  {tier.featured && <Badge variant="brand">Most Popular</Badge>}
                  <h3 className="title-card mt-4 text-semantic-text">{tier.name}</h3>
                  <p className="mt-3 font-heading text-4xl font-bold tracking-tight text-semantic-text">{tier.price}</p>
                  <p className="mt-1 text-sm text-semantic-muted">per month</p>
                  <p className="mt-4 text-sm leading-7 text-semantic-muted">{tier.description}</p>
                  <div className="mt-6 flex flex-1 flex-col gap-3 text-sm text-semantic-text">
                    {tier.points.map((point) => (
                      <div key={point} className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/login"
                    className={`mt-8 inline-flex h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold transition ${
                      tier.featured
                        ? "bg-semantic-brand text-white hover:bg-semantic-brandHover"
                        : "border border-semantic-border bg-semantic-surface text-semantic-text hover:bg-semantic-surface2"
                    }`}
                  >
                    Talk to sales
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="page-section pt-0">
          <div className="container">
            <div className="rounded-[2rem] bg-[linear-gradient(135deg,#1f3023,#111816)] px-6 py-12 text-white shadow-[var(--shadow-lift)] sm:px-10 sm:py-16">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="eyebrow bg-white/10 text-white">Ready to upgrade the customer experience?</p>
                  <h2 className="section-title mt-5 text-white">Give your team one system that looks as professional as the work you deliver.</h2>
                  <p className="mt-4 text-lg leading-8 text-white/70">
                    Replace missed opportunities, scattered notes, and slow follow-up with a polished operating rhythm.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/login"
                    className="inline-flex h-14 items-center rounded-xl bg-accent-500 px-6 text-sm font-semibold text-white transition hover:bg-accent-600"
                  >
                    Book Your Demo
                  </Link>
                  <Link
                    href="/blog"
                    className="inline-flex h-14 items-center rounded-xl border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Read the blog
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <Footer />
    </>
  );
}
