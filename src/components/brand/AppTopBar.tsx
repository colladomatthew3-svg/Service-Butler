import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { buttonStyles } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AppTopBar() {
  return (
    <div className="flex w-full items-center gap-3">
      <Link href="/dashboard" className="hidden items-center md:flex">
        <Logo variant="full" size={38} className="max-w-[228px]" />
      </Link>
      <div className="w-full max-w-xl">
        <Input
          placeholder="Search lead name, phone, neighborhood, service line..."
          className="h-11 border-semantic-border/70 bg-white/86 shadow-[0_12px_28px_rgba(31,43,37,0.09)]"
        />
      </div>
      <div className="ml-auto hidden items-center gap-2 sm:flex">
        <span className="rounded-full border border-brand-500/35 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
          Verified Lead Engine
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
