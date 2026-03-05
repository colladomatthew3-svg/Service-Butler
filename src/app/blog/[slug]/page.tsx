import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/brand/Footer";
import { TopNav } from "@/components/brand/TopNav";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/blog/MarkdownContent";
import { getAllPosts, getPostBySlug } from "@/lib/blog";

export async function generateStaticParams() {
  const posts = await getAllPosts();

  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  try {
    const post = await getPostBySlug(slug);
    return {
      title: `${post.title} | Service Butler Blog`,
      description: post.excerpt
    };
  } catch {
    return {};
  }
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    const post = await getPostBySlug(slug);

    return (
      <>
        <TopNav />
        <main className="page-section pt-12">
          <article className="container">
            <div className="mx-auto max-w-3xl">
              <Badge variant="brand">{post.category}</Badge>
              <h1 className="section-title mt-6">{post.title}</h1>
              <p className="text-body-lg mt-5 text-semantic-muted">{post.excerpt}</p>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-semantic-muted">
                <span>{formatDate(post.publishedAt)}</span>
                <span>{post.author}</span>
                <span>{post.readTime}</span>
              </div>
            </div>

            <div className="mx-auto mt-10 max-w-3xl rounded-[2rem] border border-semantic-border bg-semantic-surface px-6 py-8 shadow-soft sm:px-10 sm:py-10">
              <MarkdownContent content={post.content} />
            </div>
          </article>
        </main>
        <Footer />
      </>
    );
  } catch {
    notFound();
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}
