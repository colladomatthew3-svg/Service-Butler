import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { buttonStyles } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AppTopBar() {
  return (
    <div className="flex w-full items-center gap-3">
      <Link href="/dashboard" className="hidden items-center md:flex">
        <Logo variant="full" size={38} className="max-w-[228px]" />
      </Link>
      <div className="relative w-full max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-semantic-muted" />
        <Input
          placeholder="Search lead, signal, neighborhood, service line..."
          className="h-11 rounded-2xl border-semantic-border/60 bg-white/88 pl-11 shadow-[0_12px_28px_rgba(31,43,37,0.08)]"
        />
      </div>
      <div className="ml-auto hidden items-center gap-2 sm:flex">
        <span className="rounded-full border border-semantic-border/55 bg-white/78 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-semantic-text">
          Operator Command Center
        </span>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-semantic-border/60 bg-white/76 text-semantic-muted shadow-[0_10px_24px_rgba(31,43,37,0.08)]">
          <Bell className="h-4 w-4" />
        </span>
        <Link href="/dashboard/leads" className={buttonStyles({ size: "md", className: "h-11" })}>
          New Lead
        </Link>
        <Link href="/dashboard/scanner" className={buttonStyles({ size: "md", variant: "secondary", className: "h-11" })}>
          Run Scanner
        </Link>
      </div>
    </div>
  );
}
