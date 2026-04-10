import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { Footer } from "@/components/brand/Footer";
import { TopNav } from "@/components/brand/TopNav";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description: "Insights, strategies, and data-driven guides for restoration and home service professionals.",
  alternates: {
    canonical: "/blog"
  }
};

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <>
      <TopNav />
      <main>
        <section className="page-section py-20 md:py-24 text-center">
          <div className="container">
            <h1 className="title-hero mx-auto max-w-4xl text-semantic-text">Blog & Resources</h1>
            <p className="text-body-lg mx-auto mt-4 max-w-3xl text-semantic-muted">
              Insights, strategies, and data-driven guides for restoration and home service professionals.
            </p>
          </div>
        </section>

        <section className="page-section pt-0 pb-20">
          <div className="container grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Card key={post.slug} className="group rounded-2xl border-semantic-border p-6 transition-colors hover:border-brand-500/35">
                <div className="flex items-center gap-3">
                  <Badge variant="default" className="bg-semantic-surface2 text-semantic-text">
                    {post.category}
                  </Badge>
                  <span className="text-xs text-semantic-muted">{post.readTime}</span>
                </div>
                <h2 className="mt-5 text-xl font-semibold leading-snug text-semantic-text transition-colors group-hover:text-brand-700">
                  {post.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-semantic-muted">{post.excerpt}</p>
                <div className="mt-5 flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1.5 text-xs text-semantic-muted">
                    <Calendar className="h-3 w-3" />
                    {formatDate(post.publishedAt)}
                  </div>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition-all group-hover:gap-2"
                  >
                    Read more
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t border-semantic-border bg-semantic-surface2/70">
          <div className="container py-16 text-center">
            <h2 className="font-heading text-2xl font-bold text-semantic-text">Stay ahead of the curve</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-semantic-muted">
              Get weekly insights on restoration industry trends, lead generation tactics, and platform updates.
            </p>
            <div className="mx-auto mt-6 flex max-w-sm items-center gap-2">
              <input
                type="email"
                placeholder="you@company.com"
                className="h-10 flex-1 rounded-md border border-semantic-border bg-white px-4 text-sm text-semantic-text"
              />
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-md bg-brand-700 px-4 text-sm font-medium text-white transition hover:bg-brand-700/90"
              >
                Subscribe
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}
