import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Footer } from "@/components/brand/Footer";
import { TopNav } from "@/components/brand/TopNav";
import { buttonStyles } from "@/components/ui/button";

const whyItMatters = [
  ["Find opportunities sooner", "Spot storm damage, water loss, fire cleanup, and repair demand before the phone starts ringing."],
  ["Capture better leads", "Give dispatch a clear address, service type, urgency, and next action instead of vague signal noise."],
  ["Schedule work faster", "Move from detected incident to lead to booked inspection while competitors are still reacting."]
] as const;

const scannerPoints = [
  "Weather alerts, permit filings, fire incidents, and property-risk signals enter one scanner feed.",
  "Each opportunity shows the address, city, distance, service fit, urgency, and why it matters.",
  "Dispatch can create a lead, assign follow-up, or schedule an inspection from the same workflow."
] as const;

const workflow = [
  ["Signal detected", "Storm, flood, fire, permit, or damage activity is captured in the market."],
  ["Opportunity surfaced", "Scanner ranks the location, service category, distance, and urgency."],
  ["Lead created", "Dispatch claims the opportunity and routes it into the operating workflow."],
  ["Scheduled work", "The team books inspection or mitigation while demand is still active."]
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
        <section id="home" className="page-section overflow-hidden pb-14 pt-8">
          <div className="container">
            <div className="grid gap-12 lg:grid-cols-[0.94fr_1.06fr] lg:items-center">
              <div className="max-w-2xl">
                <p className="eyebrow">
                  <ShieldCheck className="h-4 w-4" />
                  Built for restoration and home service operators
                </p>
                <h1 className="title-hero mt-8 max-w-[11ch] text-semantic-text">
                  Find the jobs before competitors do and turn them into booked work.
                </h1>
                <p className="text-body-lg mt-5 max-w-xl text-semantic-muted">
                  Service Butler helps your team spot real incidents, surface nearby opportunities, and move quickly from
                  demand signal to scheduled work.
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
              </div>

              <div className="relative">
                <div className="absolute inset-x-14 top-10 h-40 rounded-full bg-[rgb(var(--sb-primary-soft))/0.95] blur-3xl" />
                <div className="relative overflow-hidden rounded-[2rem] border border-semantic-border bg-white p-4 shadow-[var(--shadow-lift)] sm:p-5">
                  <div className="overflow-hidden rounded-[1.6rem] border border-semantic-border bg-[linear-gradient(180deg,rgba(244,247,245,1),rgba(233,238,235,1))]">
                    <div className="p-4 sm:p-5">
                      <div className="overflow-hidden rounded-[1.4rem] border border-white/70 bg-white">
                        <Image
                          src="/marketing/hero-property-visual.svg"
                          alt="Property preview showing the kind of homes surfaced by Service Butler"
                          width={1200}
                          height={860}
                          className="h-auto w-full object-cover"
                          priority
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="page-section border-t border-semantic-border/70 bg-white/72 py-12">
          <div className="container">
            <div className="max-w-2xl">
              <p className="eyebrow">Why it matters</p>
              <h2 className="section-title mt-5 text-semantic-text">A simple system for finding work and moving fast.</h2>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {whyItMatters.map(([title, detail]) => (
                <article key={title} className="rounded-[1.35rem] border border-semantic-border bg-white px-5 py-5 shadow-sm">
                  <p className="text-base font-semibold text-semantic-text">{title}</p>
                  <p className="mt-2 text-sm leading-7 text-semantic-muted">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="page-section py-14">
          <div className="container">
            <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
              <div className="max-w-xl">
                <p className="eyebrow">Opportunity scanner</p>
                <h2 className="section-title mt-5 text-semantic-text">
                  Scanner surfaces real opportunities from signals your team can act on.
                </h2>
                <p className="text-body-lg mt-4 text-semantic-muted">
                  Service Butler turns weather damage, permit activity, fire incidents, and neighborhood demand into a
                  clean opportunity list built for dispatch.
                </p>
                <div className="mt-6 space-y-3">
                  {scannerPoints.map((point) => (
                    <div key={point} className="flex gap-3 rounded-2xl border border-semantic-border bg-white px-4 py-4 shadow-sm">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-700" />
                      <p className="text-sm leading-7 text-semantic-text">{point}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.9rem] border border-semantic-border bg-white p-5 shadow-card">
                <div className="rounded-[1.5rem] border border-semantic-border bg-semantic-surface2 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Scanner result</p>
                      <p className="mt-2 text-xl font-semibold text-semantic-text">Water damage mitigation opportunity</p>
                    </div>
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">Intent 91</span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <ProofMetric label="Address" value="29 Harbor Lane, Patchogue, NY 11772" />
                    <ProofMetric label="Distance" value="9 miles away" />
                    <ProofMetric label="Service" value="Restoration" />
                    <ProofMetric label="Urgency" value="Same-day inspection" />
                  </div>

                  <div className="mt-5 rounded-2xl border border-semantic-border bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-semantic-muted">Why it matters</p>
                    <ul className="mt-3 space-y-2 text-sm text-semantic-text">
                      <li className="flex gap-3">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-700" />
                        Heavy rain and flood-zone overlap are driving mitigation demand nearby.
                      </li>
                      <li className="flex gap-3">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-700" />
                        The property is inside your service radius and fits the selected campaign.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="page-section border-y border-semantic-border/70 bg-white/72 py-12">
          <div className="container">
            <div className="max-w-2xl">
              <p className="eyebrow">Workflow</p>
              <h2 className="section-title mt-5 text-semantic-text">Signal to opportunity to lead to scheduled work.</h2>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-4">
              {workflow.map(([title, detail]) => (
                <article key={title} className="rounded-[1.35rem] border border-semantic-border bg-white px-5 py-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">{title}</p>
                  <p className="mt-3 text-sm leading-7 text-semantic-text">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="page-section py-14">
          <div className="container">
            <div className="rounded-[2rem] border border-semantic-border bg-white px-6 py-10 shadow-[var(--shadow-card)] sm:px-10 sm:py-12">
              <div className="max-w-2xl">
                <p className="eyebrow">See the demo</p>
                <h2 className="section-title mt-5 text-semantic-text">See how Service Butler helps your team find work and book it faster.</h2>
                <p className="mt-4 text-lg leading-8 text-semantic-muted">
                  Start with the homepage, open the demo, set the service area, run the scanner, and move an opportunity
                  into a lead or booked inspection.
                </p>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className={buttonStyles({ size: "lg" })}>
                  Try Demo
                </Link>
                <a
                  href="mailto:sales@servicebutler.ai?subject=Service%20Butler%20Launch%20Demo"
                  className={buttonStyles({ size: "lg", variant: "secondary" })}
                >
                  Book Demo
                  <ArrowRight className="h-4 w-4" />
                </a>
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

function ProofMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-semantic-border bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-semantic-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-semantic-text">{value}</p>
    </div>
  );
}
