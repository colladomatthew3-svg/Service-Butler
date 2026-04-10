"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { buttonStyles } from "@/components/ui/button";

const navLinks = [
  { href: "/product", label: "Product" },
  { href: "/solutions", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" }
] as const;

export function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-semantic-border/80 bg-semantic-bg/95 backdrop-blur supports-[backdrop-filter]:bg-semantic-bg/70">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="min-w-0 flex-1 md:flex-none" onClick={() => setMobileOpen(false)}>
          <Logo variant="full" size={32} />
        </Link>

        <nav className="ml-auto hidden items-center gap-8 text-sm font-medium md:flex">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.label}
                href={link.href}
                className={active ? "text-brand-700" : "text-semantic-muted transition-colors hover:text-brand-700"}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className={buttonStyles({ variant: "ghost" })}>
            Sign In
          </Link>
          <Link href="/dashboard" className={buttonStyles({ className: "min-w-32" })}>
            Try Demo
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-semantic-border bg-white text-semantic-text md:hidden"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-semantic-border bg-semantic-surface p-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={active ? "rounded-xl px-4 py-3 text-sm font-semibold text-brand-700" : "rounded-xl px-4 py-3 text-sm font-semibold text-semantic-text transition hover:bg-semantic-surface2"}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-semantic-border pt-3">
            <Link
              href="/login"
              className={buttonStyles({ size: "sm", variant: "ghost", fullWidth: true })}
              onClick={() => setMobileOpen(false)}
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className={buttonStyles({ size: "sm", fullWidth: true })}
              onClick={() => setMobileOpen(false)}
            >
              Try Demo
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
