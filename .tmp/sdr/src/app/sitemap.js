"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = sitemap;
const blog_1 = require("@/lib/blog");
async function sitemap() {
    const posts = await (0, blog_1.getAllPosts)();
    const baseUrl = "https://servicebutler.ai";
    return [
        "",
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
