import Link from "next/link";
import { Footer } from "@/components/brand/Footer";
import { TopNav } from "@/components/brand/TopNav";
import { Badge } from "@/components/ui/badge";
import { getAllPosts } from "@/lib/blog";

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <>
      <TopNav />
      <main className="page-section pt-12">
        <div className="container">
          <div className="max-w-3xl">
            <p className="eyebrow">Blog</p>
            <h1 className="section-title mt-5">Advice for home service operators building a more responsive business</h1>
            <p className="text-body-lg mt-4 text-semantic-muted">
              Practical guidance on lead handling, scheduling, and using AI without making your customer experience feel robotic.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {posts.map((post) => (
              <article key={post.slug} className="section-shell flex h-full flex-col p-6">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="brand">{post.category}</Badge>
                  <span className="text-sm text-semantic-muted">{post.readTime}</span>
                </div>
                <h2 className="title-card mt-6 text-semantic-text">{post.title}</h2>
                <p className="mt-4 flex-1 text-sm leading-7 text-semantic-muted">{post.excerpt}</p>
                <div className="mt-8 flex items-center justify-between gap-3 border-t border-semantic-border pt-4 text-sm text-semantic-muted">
                  <span>{formatDate(post.publishedAt)}</span>
                  <Link href={`/blog/${post.slug}`} className="font-semibold text-brand-700">
                    Read article
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}
