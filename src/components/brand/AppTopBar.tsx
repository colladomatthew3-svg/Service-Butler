import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { buttonStyles } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AppTopBar() {
  return (
    <div className="flex items-center gap-3">
      <Link href="/dashboard" className="hidden items-center md:flex">
        <Logo variant="full" size={38} className="max-w-[228px]" />
      </Link>
      <div className="w-full max-w-md">
        <Input placeholder="Search leads, jobs, customers..." className="h-11 bg-white/90" />
      </div>
      <div className="ml-auto hidden items-center gap-3 sm:flex">
        <Link href="/dashboard/leads" className={buttonStyles({ size: "md" })}>
          New Lead
        </Link>
        <Link href="/dashboard/pipeline" className={buttonStyles({ size: "md", variant: "secondary" })}>
          Open Pipeline
        </Link>
      </div>
    </div>
  );
}
