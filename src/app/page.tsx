import Link from "next/link";
import Image from "next/image";
import { MarketingFooter } from "@/components/brand/MarketingFooter";
import { TopNav } from "@/components/brand/TopNav";
import { formatBlogDate, getBlogPosts } from "@/lib/content/blog";

export default function HomePage() {
  const featuredPosts = getBlogPosts().slice(0, 3);

  return (
    <>
      <TopNav />
      <main className="pb-10">
        <section className="container pt-10 sm:pt-14">
          <div className="rounded-3xl border border-[#cfdae2] bg-gradient-to-br from-[#f8fbfd] via-[#eef4f8] to-[#edf2f5] p-7 shadow-sm sm:p-10 lg:p-14">
            <div className="grid items-center gap-9 lg:grid-cols-[1.03fr_1fr]">
              <div>
                <p className="inline-flex rounded-full bg-[#dce9f2] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#254b64]">
                  Built for home service contractors
                </p>
                <h1 className="mt-5 max-w-[18ch] text-balance text-4xl font-semibold leading-[1.08] text-[#102c40] sm:text-5xl lg:text-[3.4rem]">
                  Never Lose Another Lead - Automate Follow-Ups &amp; Get Jobs Done Faster
                </h1>
                <p className="mt-5 max-w-[50ch] text-lg leading-relaxed text-[#3d5a6e]">
                  Service Butler gives your office one clear workflow from first contact to booked work, without adding
                  complexity for dispatch or field teams.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <Link
                    href="/login"
                    className="inline-flex h-14 items-center rounded-xl bg-[#0f3554] px-7 text-base font-semibold text-white shadow-sm transition hover:bg-[#124469]"
                  >
                    Start Free Trial
                  </Link>
                  <Link
                    href="#features"
                    className="inline-flex h-14 items-center rounded-xl border border-[#b8c8d3] bg-white px-7 text-base font-semibold text-[#2b5169] transition hover:bg-[#f4f8fb]"
                  >
                    See Product Tour
                  </Link>
                </div>
              </div>
              <div className="rounded-2xl border border-[#cbd7e0] bg-white p-4 shadow-sm sm:p-6">
                <div className="rounded-xl bg-[#f4f8fb] p-4">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#16384f]">Lead Inbox Snapshot</p>
                    <span className="rounded-full bg-[#dbe9f4] px-3 py-1 text-xs font-semibold text-[#2a5370]">12 new today</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      ["James Roper", "Missed call - HVAC", "Convert to Job"],
                      ["Maria Fernandez", "Web form - Plumbing", "Schedule"],
                      ["Chris Parker", "SMS reply - Roofing", "Schedule"]
                    ].map(([name, source, next]) => (
                      <div key={name} className="rounded-lg border border-[#d4dde4] bg-white p-3">
                        <p className="font-semibold text-[#193d56]">{name}</p>
                        <p className="text-xs text-[#5b7386]">{source}</p>
                        <p className="mt-1 text-sm text-[#244760]">Next step: {next}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="container py-14">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Jobs", "Move qualified leads into jobs with one clear handoff."],
              ["Pipeline", "Track every opportunity so no estimate slips through."],
              ["Inbox", "Manage calls, texts, and replies in a single queue."],
              ["Scheduling", "Give dispatch one board to assign windows and crews."]
            ].map(([title, copy]) => (
              <article key={title} className="rounded-2xl border border-[#d2dbe2] bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-[#16384f]">{title}</h2>
                <p className="mt-3 text-base leading-relaxed text-[#3e5b6f]">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="container pb-14">
          <div className="rounded-3xl border border-[#cbd8e2] bg-[#f3f8fc] p-7 shadow-sm sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4f687b]">How it Works</p>
            <h2 className="mt-3 text-3xl font-semibold text-[#14344b] sm:text-4xl">A simple lead-to-job operating flow</h2>
            <div className="mt-7 grid gap-3 md:grid-cols-4">
              {[
                ["1. Capture", "Calls, texts, and web leads enter one inbox."],
                ["2. Qualify", "Your team confirms service details and urgency."],
                ["3. Convert to Job", "Qualified leads are turned into active jobs."],
                ["4. Schedule", "Dispatch assigns time windows and the right technician."]
              ].map(([title, copy]) => (
                <article key={title} className="rounded-xl border border-[#d3dee6] bg-white p-4">
                  <h3 className="text-base font-semibold text-[#16384f]">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#3e5b6f]">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container pb-14">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#d2dce3] bg-white p-3 shadow-sm">
              <Image src="/stock/crew.svg" alt="Dispatch team in office" width={1200} height={800} className="h-52 w-full rounded-xl object-cover" />
            </div>
            <div className="rounded-2xl border border-[#d2dce3] bg-white p-3 shadow-sm">
              <Image src="/stock/truck.svg" alt="Service truck on route" width={1200} height={800} className="h-52 w-full rounded-xl object-cover" />
            </div>
            <div className="rounded-2xl border border-[#d2dce3] bg-white p-3 shadow-sm">
              <Image src="/stock/tools.svg" alt="Technician tool kit" width={1200} height={800} className="h-52 w-full rounded-xl object-cover" />
            </div>
          </div>
        </section>

        <section id="pricing" className="container pb-14">
          <div className="rounded-3xl border border-[#cbd8e2] bg-[#f3f8fc] p-7 shadow-sm sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4f687b]">Pricing</p>
            <h2 className="mt-3 text-3xl font-semibold text-[#14344b] sm:text-4xl">Simple plans for growing contractors</h2>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-[#446074]">
              Flexible packages based on team size and workflow needs. Start with core lead-to-job workflows and expand
              into automation as volume grows.
            </p>
            <div className="mt-7">
              <Link
                href="/login"
                className="inline-flex h-12 items-center rounded-xl bg-[#0f3554] px-6 text-sm font-semibold text-white transition hover:bg-[#124469]"
              >
                Book a Demo
              </Link>
            </div>
          </div>
        </section>

        <section className="container pb-14">
          <div className="rounded-3xl border border-[#cfdae2] bg-white p-7 shadow-sm sm:p-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#50697c]">From the Blog</p>
                <h2 className="mt-2 text-3xl font-semibold text-[#173950]">Advice for dispatch, lead response, and growth</h2>
              </div>
              <Link href="/blog" className="text-sm font-semibold text-[#25506a] transition hover:text-[#173f59]">
                View all posts
              </Link>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {featuredPosts.map((post) => (
                <article key={post.slug} className="rounded-2xl border border-[#d3dde5] bg-[#fbfdff] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#587286]">{post.tag}</p>
                  <h3 className="mt-3 text-xl font-semibold leading-tight text-[#1a3d55]">{post.title}</h3>
                  <p className="mt-2 text-sm text-[#60788a]">{formatBlogDate(post.date)}</p>
                  <p className="mt-3 text-sm leading-relaxed text-[#3d5b6f]">{post.excerpt}</p>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="mt-5 inline-flex text-sm font-semibold text-[#285772] transition hover:text-[#1b435d]"
                  >
                    Read more
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
