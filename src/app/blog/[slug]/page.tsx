import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingFooter } from "@/components/brand/MarketingFooter";
import { TopNav } from "@/components/brand/TopNav";
import { formatBlogDate, getBlogPostBySlug, getBlogPosts } from "@/lib/content/blog";

export function generateStaticParams() {
  return getBlogPosts().map((post) => ({ slug: post.slug }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <TopNav />
      <main className="pb-12 pt-10">
        <article className="container max-w-3xl">
          <Link href="/blog" className="inline-flex items-center text-sm font-semibold text-[#2e5671] transition hover:text-[#163e59]">
            Back to Blog
          </Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-[#5a7285]">{post.tag}</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight text-[#102b3f] sm:text-5xl">{post.title}</h1>
          <p className="mt-4 text-sm text-[#607688]">{formatBlogDate(post.date)}</p>

          <div className="mt-8 space-y-6 text-lg leading-relaxed text-[#2f4a5e]">
            {post.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <section className="mt-10 rounded-2xl border border-[#c8d5df] bg-[#f3f8fc] p-6">
            <h2 className="text-2xl font-semibold text-[#173950]">Want help converting more leads?</h2>
            <p className="mt-2 text-base leading-relaxed text-[#3f5d72]">
              See how Service Butler helps your team move from missed calls to scheduled jobs with less manual work.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-xl bg-[#0f3554] px-5 text-sm font-semibold text-white transition hover:bg-[#124469]"
              >
                Start Free Trial
              </Link>
              <Link
                href="/blog"
                className="inline-flex h-11 items-center rounded-xl border border-[#b8c7d2] bg-white px-5 text-sm font-semibold text-[#254a63] transition hover:bg-[#f8fbfd]"
              >
                Share this article
              </Link>
            </div>
          </section>
        </article>
      </main>
      <MarketingFooter />
    </>
  );
}
