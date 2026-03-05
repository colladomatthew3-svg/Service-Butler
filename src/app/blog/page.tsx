import { Footer } from "@/components/brand/Footer";
import { TopNav } from "@/components/brand/TopNav";

export default function BlogPage() {
  return (
    <>
      <TopNav />
      <main className="container py-20">
        <div className="max-w-3xl rounded-3xl border border-semantic-border bg-semantic-surface px-8 py-12 shadow-soft">
          <p className="eyebrow">Blog</p>
          <h1 className="mt-6 text-4xl font-semibold text-semantic-text">Insights for modern home service operators</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-semantic-muted">
            Service Butler articles are being prepared now. The full publishing system lands in the next milestone.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
