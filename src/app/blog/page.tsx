import Link from "next/link";
import { MarketingFooter } from "@/components/brand/MarketingFooter";
import { TopNav } from "@/components/brand/TopNav";
import { formatBlogDate, getBlogPosts } from "@/lib/content/blog";

export default function BlogIndexPage() {
  const posts = getBlogPosts();

  return (
    <>
      <TopNav />
      <main className="pb-12 pt-10">
        <section className="container">
          <p className="inline-flex rounded-full border border-[#c8d4dc] bg-[#eef4f8] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#31536c]">
            Service Butler Blog
          </p>
          <h1 className="mt-4 max-w-[24ch] text-4xl font-semibold leading-tight text-[#112b3d] sm:text-5xl">
            Practical growth and operations playbooks for home service teams
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[#4b667a]">
            Field-tested guidance for dispatchers, office managers, and owners focused on converting more leads and
            keeping work moving.
          </p>
        </section>
        <section className="container mt-10">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <article key={post.slug} className="rounded-2xl border border-[#d4dde4] bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#567188]">{post.tag}</p>
                <h2 className="mt-3 text-2xl font-semibold leading-tight text-[#122e42]">{post.title}</h2>
                <p className="mt-2 text-sm text-[#5c7385]">{formatBlogDate(post.date)}</p>
                <p className="mt-4 text-base leading-relaxed text-[#3e5669]">{post.excerpt}</p>
                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-6 inline-flex h-11 items-center rounded-xl border border-[#cad4dc] px-4 text-sm font-semibold text-[#1e425b] transition hover:border-[#a9bbc9] hover:bg-[#f4f8fb]"
                >
                  Read article
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
