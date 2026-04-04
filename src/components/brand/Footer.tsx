import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { buttonStyles } from "@/components/ui/button";

const productLinks = [
  { href: "/product", label: "Product" },
  { href: "/solutions", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/login", label: "Product Tour" }
] as const;

const companyLinks = [
  { href: "/", label: "About" },
  { href: "/blog", label: "Resources" },
  { href: "/solutions", label: "Customers" }
] as const;

const supportLinks = [
  { href: "/login", label: "Login" },
  { href: "mailto:support@servicebutler.ai", label: "Support" },
  { href: "mailto:sales@servicebutler.ai", label: "Contact Sales" }
] as const;

export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-[rgb(var(--sb-text))] text-white">
      <div className="container py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr]">
          <div className="max-w-md">
            <Logo size={40} className="h-10 w-auto" />
            <p className="mt-5 text-sm leading-7 text-white/78">
              Service Butler helps restoration and home service teams spot real incidents, claim the best opportunities,
              and turn them into scheduled work before competitors react.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login" className={buttonStyles({ size: "sm" })}>
                Try Demo
              </Link>
              <a
                href="mailto:sales@servicebutler.ai?subject=Service%20Butler%20Launch%20Demo"
                className={buttonStyles({ size: "sm", variant: "secondary", className: "border-white/12 bg-white/5 text-white hover:bg-white/10" })}
              >
                Book Demo
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Support" links={supportLinks} />
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-white/58 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Service Butler. Opportunity intelligence for restoration and home service operators.</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/privacy" className="transition hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-white">
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
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white">{title}</h2>
      <div className="mt-5 flex flex-col gap-3 text-sm text-white/65">
        {links.map((link) => {
          const isExternal = link.href.startsWith("mailto:");

          if (isExternal) {
            return (
              <a key={link.label} href={link.href} className="transition hover:text-white">
                {link.label}
              </a>
            );
          }

          return (
            <Link key={link.label} href={link.href} className="transition hover:text-white">
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
