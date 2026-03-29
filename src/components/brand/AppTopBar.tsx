import Link from "next/link";
import { Bell, CircleDot, Search } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Input } from "@/components/ui/input";

export function AppTopBar({ demoMode }: { demoMode?: boolean }) {
  return (
    <div className="flex w-full items-center gap-3">
      <Link href="/dashboard" className="hidden items-center md:flex">
        <Logo variant="full" size={28} className="max-w-[156px]" />
      </Link>
      <div className="relative w-full max-w-xl flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-semantic-muted" />
        <Input
          placeholder="Search leads, jobs, neighborhoods, or service lines"
          className="h-10 border-semantic-border bg-semantic-surface pl-10 pr-3 shadow-none"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-2 rounded-full border border-semantic-border bg-semantic-surface px-3 py-1.5 text-[11px] font-medium text-semantic-muted md:inline-flex">
          <CircleDot className={`h-3 w-3 ${demoMode ? "fill-current text-brand-600" : "fill-current text-success-600"}`} />
          {demoMode ? "Demo workspace" : "Live ops"}
        </span>
        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-semantic-border bg-semantic-surface text-semantic-muted transition hover:bg-white hover:text-semantic-text"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-danger-500" />
        </button>
        <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-semantic-brand text-xs font-semibold text-white sm:flex">
          SB
        </div>
      </div>
    </div>
  );
}
