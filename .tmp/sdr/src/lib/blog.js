"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllPosts = getAllPosts;
exports.getPostBySlug = getPostBySlug;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const BLOG_DIR = node_path_1.default.join(process.cwd(), "src", "content", "blog");
async function getAllPosts() {
    const entries = await node_fs_1.promises.readdir(BLOG_DIR);
    const posts = await Promise.all(entries
        .filter((entry) => entry.endsWith(".md"))
        .map(async (entry) => {
        const slug = entry.replace(/\.md$/, "");
        return getPostBySlug(slug);
    }));
    return posts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}
async function getPostBySlug(slug) {
    const fullPath = node_path_1.default.join(BLOG_DIR, `${slug}.md`);
    const file = await node_fs_1.promises.readFile(fullPath, "utf8");
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
    };
}
function parseMarkdownFile(file) {
    const match = file.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        throw new Error("Blog post is missing frontmatter.");
    }
    const [, rawFrontmatter, rawContent] = match;
    const frontmatter = Object.fromEntries(rawFrontmatter.split("\n").map((line) => {
        const [key, ...valueParts] = line.split(":");
        return [key.trim(), valueParts.join(":").trim()];
    }));
    return {
        frontmatter,
        content: rawContent.trim()
    };
}
