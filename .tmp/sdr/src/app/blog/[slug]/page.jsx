"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStaticParams = generateStaticParams;
exports.generateMetadata = generateMetadata;
exports.default = BlogArticlePage;
const navigation_1 = require("next/navigation");
const Footer_1 = require("@/components/brand/Footer");
const TopNav_1 = require("@/components/brand/TopNav");
const badge_1 = require("@/components/ui/badge");
const MarkdownContent_1 = require("@/components/blog/MarkdownContent");
const blog_1 = require("@/lib/blog");
async function generateStaticParams() {
    const posts = await (0, blog_1.getAllPosts)();
    return posts.map((post) => ({ slug: post.slug }));
}
async function generateMetadata({ params }) {
    const { slug } = await params;
    try {
        const post = await (0, blog_1.getPostBySlug)(slug);
        return {
            title: post.title,
            description: post.excerpt,
            alternates: {
                canonical: `/blog/${post.slug}`
            },
            openGraph: {
                title: post.title,
                description: post.excerpt,
                type: "article",
                url: `/blog/${post.slug}`,
                publishedTime: post.publishedAt,
                authors: [post.author],
                images: [
                    {
                        url: "/brand/servicebutler_logo.svg",
                        width: 1200,
                        height: 916,
                        alt: post.title
                    }
                ]
            },
            twitter: {
                card: "summary_large_image",
                title: post.title,
                description: post.excerpt,
                images: ["/brand/servicebutler_logo.svg"]
            }
        };
    }
    catch {
        return {};
    }
}
async function BlogArticlePage({ params }) {
    const { slug } = await params;
    try {
        const post = await (0, blog_1.getPostBySlug)(slug);
        return (<>
        <TopNav_1.TopNav />
        <main className="page-section pt-12">
          <article className="container">
            <div className="mx-auto max-w-3xl">
              <badge_1.Badge variant="brand">{post.category}</badge_1.Badge>
              <h1 className="section-title mt-6">{post.title}</h1>
              <p className="text-body-lg mt-5 text-semantic-muted">{post.excerpt}</p>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-semantic-muted">
                <span>{formatDate(post.publishedAt)}</span>
                <span>{post.author}</span>
                <span>{post.readTime}</span>
              </div>
            </div>

            <div className="mx-auto mt-10 max-w-3xl rounded-[2rem] border border-semantic-border bg-semantic-surface px-6 py-8 shadow-soft sm:px-10 sm:py-10">
              <MarkdownContent_1.MarkdownContent content={post.content}/>
            </div>
          </article>
        </main>
        <Footer_1.Footer />
      </>);
    }
    catch {
        (0, navigation_1.notFound)();
    }
}
function formatDate(value) {
    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    }).format(new Date(value));
}
