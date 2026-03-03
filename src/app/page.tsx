export default function HomePage() {
  return (
    <main className="pb-24">
      <section className="container pt-12 sm:pt-16">
        <div className="grid items-center gap-10 rounded-3xl border border-semantic-border bg-semantic-surface px-6 py-10 shadow-card sm:px-10 sm:py-14 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <p className="inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
              Built for home service teams
            </p>
            <h1 className="mt-5 max-w-2xl text-balance text-4xl font-semibold leading-[1.08] text-semantic-text sm:text-5xl lg:text-[3.4rem]">
              Never Lose Another Lead - Automate Follow-Ups &amp; Get Jobs Done Faster
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-semantic-muted">
              Capture every call and text, route jobs to the right tech, and keep dispatch, messaging, and follow-up in one fast workspace.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="/login" className="inline-flex h-14 items-center rounded-xl bg-semantic-brand px-6 text-sm font-semibold text-white shadow-sm hover:bg-semantic-brandHover">
                Start Free Trial
              </a>
              <a
                href="/dashboard"
                className="inline-flex h-14 items-center rounded-xl border border-semantic-border bg-semantic-surface px-6 text-sm font-semibold text-semantic-text hover:bg-semantic-surface2"
              >
                Open Product Tour
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-semantic-border bg-semantic-surface2 p-4 shadow-soft sm:p-6">
            <div className="rounded-xl bg-semantic-surface p-4 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-semantic-text">Lead Inbox</p>
                <span className="rounded-full bg-success-100 px-3 py-1 text-xs font-semibold text-success-700">12 new today</span>
              </div>
              <div className="space-y-3">
                {[
                  ["James Roper", "Missed call · HVAC", "Call in 10 min"],
                  ["Maria Fernandez", "Web form · Plumbing", "Send estimate"],
                  ["Chris Parker", "SMS reply · Roofing", "Schedule tomorrow"]
                ].map(([name, source, next]) => (
                  <div key={name} className="rounded-lg border border-semantic-border p-3">
                    <p className="font-semibold text-semantic-text">{name}</p>
                    <p className="text-xs text-semantic-muted">{source}</p>
                    <p className="mt-1 text-sm text-semantic-text">Next: {next}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mt-16">
        <div className="rounded-3xl border border-semantic-border bg-semantic-surface px-6 py-8 shadow-soft sm:px-10">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Workflow Preview</p>
              <h2 className="mt-3 text-3xl font-semibold text-semantic-text">From missed call to booked job in under 5 minutes</h2>
              <p className="mt-3 text-semantic-muted">
                A clear handoff between automation and dispatch keeps every lead moving, even during peak hours.
              </p>
            </div>
            <div className="space-y-3">
              {[
                ["00:00", "Inbound call missed", "Lead created instantly and urgency tagged."],
                ["00:15", "Auto follow-up sent", "Customer confirms service need and preferred window."],
                ["02:20", "Dispatcher qualifies", "Estimate sent and job details captured."],
                ["04:45", "Job scheduled", "Tech assigned, customer gets confirmation SMS."]
              ].map(([time, title, text]) => (
                <div key={time} className="grid grid-cols-[70px_1fr] gap-3 rounded-xl border border-semantic-border bg-semantic-surface2 p-3">
                  <p className="text-sm font-semibold text-brand-700">{time}</p>
                  <div>
                    <p className="font-semibold text-semantic-text">{title}</p>
                    <p className="text-sm text-semantic-muted">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Lead Capture", "Capture calls, texts, and forms into one lead inbox instantly."],
          ["Smart Automated Follow-Ups", "Auto-send SMS and email sequences that stop on reply."],
          ["Job Dispatch & Tracking", "Assign jobs with clear windows and field-ready notes."],
          ["One Dashboard for Ops", "Dispatch, lead status, and inbox updates in one place."]
        ].map(([title, copy]) => (
          <article key={title} className="rounded-2xl border border-semantic-border bg-semantic-surface p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-semantic-text">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-semantic-muted">{copy}</p>
          </article>
        ))}
      </section>

      <section className="container mt-16">
        <div className="rounded-3xl border border-semantic-border bg-semantic-surface p-6 shadow-soft sm:p-10">
          <h2 className="text-2xl font-semibold text-semantic-text sm:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[
              ["1. Lead Capture", "Inbound calls, SMS, and forms are captured instantly."],
              ["2. Qualification", "Auto-replies gather details and flag urgency."],
              ["3. Schedule", "Dispatcher books jobs and assigns the right tech."],
              ["4. Follow-Up", "Automations send reminders and review requests."]
            ].map(([title, copy]) => (
              <div key={title} className="rounded-xl bg-semantic-surface2 p-5">
                <h3 className="text-base font-semibold text-semantic-text">{title}</h3>
                <p className="mt-2 text-sm text-semantic-muted">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mt-16 grid gap-4 md:grid-cols-3">
        {[
          ['"We stopped losing missed-call jobs in week one."', "HVAC owner · Tampa"],
          ['"Techs arrive with cleaner notes and fewer callbacks."', "Plumbing dispatcher · Orlando"],
          ['"Our response time dropped from 45 minutes to under 7."', "Electrical contractor · Jacksonville"]
        ].map(([quote, byline]) => (
          <blockquote key={byline} className="rounded-2xl border border-semantic-border bg-semantic-surface p-6 shadow-soft">
            <p className="text-base text-semantic-text">{quote}</p>
            <footer className="mt-3 text-sm text-semantic-muted">{byline}</footer>
          </blockquote>
        ))}
      </section>

      <section className="container mt-16">
        <div className="rounded-3xl bg-neutral-900 px-6 py-10 text-white shadow-card sm:px-10 sm:py-14">
          <h2 className="text-3xl font-semibold">Operate faster with fewer missed opportunities.</h2>
          <p className="mt-3 max-w-2xl text-neutral-300">
            Give your team one clear system for lead intake, dispatch, messaging, and follow-up.
          </p>
          <div className="mt-7">
            <a href="/login" className="inline-flex h-14 items-center rounded-xl bg-accent-500 px-6 text-sm font-semibold text-white hover:bg-accent-600">
              Book Your Demo
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
