export default function HomePage() {
  return (
    <main className="min-h-screen max-w-none px-0 py-0">
      <div className="bg-[radial-gradient(circle_at_top_right,_rgba(120,190,32,0.18),_transparent_45%),radial-gradient(circle_at_10%_20%,_rgba(217,140,95,0.16),_transparent_40%),#F7F9F8]">
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:px-10 lg:pt-24">
          <div className="inline-flex items-center rounded-full border border-[#78BE20]/35 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#1F2933]">
            Concierge Clean Ops Platform
          </div>
          <h1 className="mt-8 max-w-4xl text-balance text-4xl font-semibold leading-tight text-[#1F2933] sm:text-5xl lg:text-6xl">
            Never Lose Another Lead - Automate Follow-Ups &amp; Get Jobs Done Faster
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#52606D]">
            ServiceButler helps home service teams capture every inbound call, text, and form lead, then instantly
            respond, dispatch, and track work from one practical dashboard.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="/login"
              className="rounded-md bg-[#78BE20] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#67a71b]"
            >
              Start Free Trial
            </a>
            <a
              href="/login"
              className="rounded-md border border-[#1F2933]/20 bg-white px-7 py-3 text-sm font-semibold text-[#1F2933] transition hover:border-[#1F2933]/40"
            >
              See Live Demo
            </a>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-20 sm:grid-cols-2 sm:px-10 lg:grid-cols-4">
          {[
            ["Lead Capture", "Collect call, SMS, and web leads automatically so no inquiry slips through."],
            ["Smart Automated Follow-Ups", "Send the right text or email at the right time with stop-on-reply logic."],
            ["Job Dispatch & Tracking", "Assign techs, monitor status, and keep dispatch aligned with field activity."],
            ["One Dashboard for Ops", "Manage conversations, campaigns, jobs, and settings from one clean workspace."]
          ].map(([title, body]) => (
            <article key={title} className="rounded-xl border border-[#d7dfda] bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-[#1F2933]">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#52606D]">{body}</p>
            </article>
          ))}
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20 sm:px-10">
          <div className="rounded-2xl border border-[#d7dfda] bg-white p-8 shadow-sm sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#52606D]">How It Works</p>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                ["1. Capture", "Every call, message, or web form becomes a trackable lead in seconds."],
                ["2. Automate", "Prebuilt workflows follow up instantly, then nurture until they reply or book."],
                ["3. Dispatch", "Turn won leads into jobs, assign your team, and track completion without friction."]
              ].map(([title, body]) => (
                <div key={title} className="rounded-xl bg-[#F7F9F8] p-6">
                  <h3 className="text-lg font-semibold text-[#1F2933]">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#52606D]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20 sm:px-10">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['"We recovered 19 missed leads in our first month."', "A. Ramos, HVAC Owner"],
              ['"Dispatch finally has one source of truth."', "L. Patel, Plumbing Ops Lead"],
              ['"Follow-ups now happen automatically, every single time."', "M. Walker, Roofing GM"]
            ].map(([quote, person]) => (
              <blockquote key={person} className="rounded-xl border border-[#d7dfda] bg-white p-6 shadow-sm">
                <p className="text-base leading-relaxed text-[#1F2933]">{quote}</p>
                <footer className="mt-4 text-sm text-[#52606D]">{person}</footer>
              </blockquote>
            ))}
          </div>
        </section>

        <section className="bg-[#1F2933]">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-14 sm:px-10 md:flex-row md:items-center">
            <div>
              <h2 className="text-3xl font-semibold text-white">Ready to run a tighter operation?</h2>
              <p className="mt-2 max-w-2xl text-[#d6dde3]">
                Launch ServiceButler and convert more leads without adding admin overhead.
              </p>
            </div>
            <a
              href="/login"
              className="rounded-md bg-[#D98C5F] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#c37d53]"
            >
              Get Started Now
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
