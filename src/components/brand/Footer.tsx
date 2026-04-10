import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const productLinks = [
  { href: "/product", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/solutions", label: "Solutions" }
] as const;

const resourceLinks = [
  { href: "/blog", label: "Blog" },
  { href: "/login", label: "Sign In" }
] as const;

const companyLinks = [
  { href: "mailto:support@servicebutler.io", label: "support@servicebutler.io" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" }
] as const;

export function Footer() {
  return (
    <footer className="border-t border-semantic-border bg-semantic-surface2/70">
      <div className="container grid grid-cols-2 gap-8 py-12 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <Logo size={28} />
          <p className="mt-4 text-sm leading-relaxed text-semantic-muted">
            AI-powered opportunity intelligence for restoration and home service companies.
          </p>
        </div>

        <FooterColumn title="Product" links={productLinks} />
        <FooterColumn title="Resources" links={resourceLinks} />
        <FooterColumn title="Company" links={companyLinks} />
      </div>

      <div className="container pb-8">
        <p className="text-xs text-semantic-muted">© {new Date().getFullYear()} Service Butler. All rights reserved.</p>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h2 className="font-heading text-sm font-semibold text-semantic-text">{title}</h2>
      <div className="mt-3 flex flex-col gap-2 text-sm text-semantic-muted">
        {links.map((link) => {
          const isExternal = link.href.startsWith("mailto:");

          if (isExternal) {
            return (
              <a key={link.label} href={link.href} className="transition hover:text-semantic-text">
                {link.label}
              </a>
            );
          }

          return (
            <Link key={link.label} href={link.href} className="transition hover:text-semantic-text">
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
