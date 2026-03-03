import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AppTopBar() {
  return (
    <div className="flex items-center gap-3">
      <Link href="/dashboard" className="hidden items-center md:flex">
        <Logo variant="lockup" size={30} />
      </Link>
      <div className="w-full max-w-md">
        <Input placeholder="Search leads, jobs, customers..." className="h-11" />
      </div>
      <div className="ml-auto hidden items-center gap-3 sm:flex">
        <Button size="md">New Lead</Button>
        <Button variant="secondary" size="md">
          Create Job
        </Button>
      </div>
    </div>
  );
}
