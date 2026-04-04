import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts();
  const baseUrl = "https://servicebutler.ai";

  return [
    "",
    "/product",
    "/solutions",
    "/pricing",
    "/blog",
    "/login",
    "/privacy",
    "/terms",
    ...posts.map((post) => `/blog/${post.slug}`)
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route.startsWith("/blog/") ? "monthly" : "weekly",
    priority: route === "" ? 1 : route === "/blog" ? 0.9 : 0.7
  }));
}
