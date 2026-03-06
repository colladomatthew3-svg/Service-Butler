import { promises as fs } from "node:fs";
import path from "node:path";

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  category: string;
  author: string;
  readTime: string;
  content: string;
};

const BLOG_DIR = path.join(process.cwd(), "src", "content", "blog");

export async function getAllPosts() {
  const entries = await fs.readdir(BLOG_DIR);
  const posts = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".md"))
      .map(async (entry) => {
        const slug = entry.replace(/\.md$/, "");
        return getPostBySlug(slug);
      })
  );

  return posts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export async function getPostBySlug(slug: string) {
  const fullPath = path.join(BLOG_DIR, `${slug}.md`);
  const file = await fs.readFile(fullPath, "utf8");
  const { frontmatter, content } = parseMarkdownFile(file);

  return {
    slug,
    title: frontmatter.title,
    excerpt: frontmatter.excerpt,
    publishedAt: frontmatter.publishedAt,
    category: frontmatter.category,
    author: frontmatter.author,
    readTime: frontmatter.readTime,
    content
  } satisfies BlogPost;
}

function parseMarkdownFile(file: string) {
  const match = file.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    throw new Error("Blog post is missing frontmatter.");
  }

  const [, rawFrontmatter, rawContent] = match;
  const frontmatter = Object.fromEntries(
    rawFrontmatter.split("\n").map((line) => {
      const [key, ...valueParts] = line.split(":");
      return [key.trim(), valueParts.join(":").trim()];
    })
  ) as Record<string, string>;

  return {
    frontmatter,
    content: rawContent.trim()
  };
}
