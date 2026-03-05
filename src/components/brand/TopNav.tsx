import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/login", label: "Login" }
] as const;

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-semantic-border/80 bg-semantic-surface/90 backdrop-blur-xl">
      <div className="container flex min-h-20 items-center gap-4 py-3">
        <Link href="/" className="min-w-0 flex-1 md:flex-none">
          <Logo variant="full" size={38} className="max-w-full" />
        </Link>
        <nav className="ml-auto hidden items-center gap-7 text-sm font-semibold text-semantic-muted lg:flex">
          {navLinks.map((link) => (
            <Link key={link.label} href={link.href} className="transition hover:text-semantic-text">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-2 hidden lg:block">
          <Link href="/login">
            <Button className="min-w-32">Start Free Trial</Button>
          </Link>
        </div>
        <details className="relative ml-auto lg:hidden">
          <summary className="flex h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-semantic-border bg-semantic-surface2 px-3 text-sm font-semibold text-semantic-text marker:hidden">
            Menu
          </summary>
          <div className="absolute right-0 top-[calc(100%+0.75rem)] w-72 rounded-2xl border border-semantic-border bg-semantic-surface p-3 shadow-card">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-semantic-text transition hover:bg-semantic-surface2"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <Link href="/login" className="mt-3 block">
              <Button size="sm" fullWidth>
                Start Free Trial
              </Button>
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
