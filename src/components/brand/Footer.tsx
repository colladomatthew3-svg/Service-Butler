import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const productLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/login", label: "Product Tour" }
] as const;

const companyLinks = [
  { href: "/", label: "About" },
  { href: "/blog", label: "Resources" },
  { href: "/login", label: "Customers" }
] as const;

const supportLinks = [
  { href: "/login", label: "Login" },
  { href: "mailto:support@servicebutler.ai", label: "Support" },
  { href: "mailto:sales@servicebutler.ai", label: "Contact Sales" }
] as const;

export function Footer() {
  return (
    <footer className="mt-20 border-t border-semantic-border bg-semantic-surface">
      <div className="container py-14">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div className="max-w-sm">
            <Logo size={40} />
            <p className="mt-5 text-sm leading-7 text-semantic-muted">
              Service Butler gives home service operators one polished system for lead capture, dispatch, messaging,
              and follow-up.
            </p>
          </div>

          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Support" links={supportLinks} />
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-semantic-border pt-6 text-sm text-semantic-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Service Butler. Built for premium home service operations.</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/" className="transition hover:text-semantic-text">
              Privacy
            </Link>
            <Link href="/" className="transition hover:text-semantic-text">
              Terms
            </Link>
          </div>
        </div>
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
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-semantic-text">{title}</h2>
      <div className="mt-5 flex flex-col gap-3 text-sm text-semantic-muted">
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
