export default function HomePage() {
  return (
    <main className="pb-20">
      <section className="container pt-12 sm:pt-16">
        <div className="grid items-center gap-10 rounded-3xl border border-neutral-200 bg-white px-6 py-8 shadow-card sm:px-10 sm:py-12 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <p className="inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
              Built for home service teams
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-neutral-900 sm:text-5xl">
              Never Lose Another Lead - Automate Follow-Ups &amp; Get Jobs Done Faster
            </h1>
            <p className="mt-5 max-w-xl text-lg text-neutral-600">
              Capture every call and text, route jobs to the right tech, and keep dispatch, messaging, and follow-up in one fast workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/login" className="inline-flex h-12 items-center rounded-xl bg-brand-500 px-6 text-sm font-semibold text-white hover:bg-brand-600">
                Start Free Trial
              </a>
              <a
                href="/dashboard"
                className="inline-flex h-12 items-center rounded-xl border border-neutral-300 bg-white px-6 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                Open Product Tour
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-soft sm:p-6">
            <div className="rounded-xl bg-white p-4 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-900">Lead Inbox</p>
                <span className="rounded-full bg-success-100 px-3 py-1 text-xs font-semibold text-success-700">12 new today</span>
              </div>
              <div className="space-y-3">
                {[
                  ["James Roper", "Missed call · HVAC", "Call in 10 min"],
                  ["Maria Fernandez", "Web form · Plumbing", "Send estimate"],
                  ["Chris Parker", "SMS reply · Roofing", "Schedule tomorrow"]
                ].map(([name, source, next]) => (
                  <div key={name} className="rounded-lg border border-neutral-200 p-3">
                    <p className="font-semibold text-neutral-900">{name}</p>
                    <p className="text-xs text-neutral-500">{source}</p>
                    <p className="mt-1 text-sm text-neutral-700">Next: {next}</p>
                  </div>
                ))}
              </div>
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
          <article key={title} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{copy}</p>
          </article>
        ))}
      </section>

      <section className="container mt-16">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-soft sm:p-10">
          <h2 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[
              ["1. Lead Capture", "Inbound calls, SMS, and forms are captured instantly."],
              ["2. Qualification", "Auto-replies gather details and flag urgency."],
              ["3. Schedule", "Dispatcher books jobs and assigns the right tech."],
              ["4. Follow-Up", "Automations send reminders and review requests."]
            ].map(([title, copy]) => (
              <div key={title} className="rounded-xl bg-neutral-50 p-5">
                <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
                <p className="mt-2 text-sm text-neutral-600">{copy}</p>
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
          <blockquote key={byline} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-soft">
            <p className="text-base text-neutral-900">{quote}</p>
            <footer className="mt-3 text-sm text-neutral-500">{byline}</footer>
          </blockquote>
        ))}
      </section>

      <section className="container mt-16">
        <div className="rounded-3xl bg-neutral-900 px-6 py-10 text-white sm:px-10 sm:py-14">
          <h2 className="text-3xl font-semibold">Operate faster with fewer missed opportunities.</h2>
          <p className="mt-3 max-w-2xl text-neutral-300">
            Give your team one clear system for lead intake, dispatch, messaging, and follow-up.
          </p>
          <div className="mt-7">
            <a href="/login" className="inline-flex h-12 items-center rounded-xl bg-accent-500 px-6 text-sm font-semibold text-white hover:bg-accent-600">
              Book Your Demo
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
