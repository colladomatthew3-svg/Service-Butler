"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LayoutGrid, Users, CalendarDays, MessageSquare, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ComponentType, ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/dashboard/leads", label: "Lead Inbox", icon: Users },
  { href: "/dashboard/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/dashboard/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/dashboard/settings", label: "Settings", icon: Settings }
];

export function DashboardAppShell({
  children,
  onSignOut
}: {
  children: ReactNode;
  onSignOut: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-semantic-bg">
      <div className="mx-auto flex max-w-[1440px]">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-72 border-r border-semantic-border bg-semantic-surface px-5 py-6 shadow-card transition-transform lg:static lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">ServiceButler</p>
              <p className="text-lg font-semibold text-neutral-900">Ops Console</p>
            </div>
            <button
              className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 lg:hidden"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                    active ? "bg-brand-50 text-brand-700" : "text-semantic-muted hover:bg-semantic-surface2 hover:text-semantic-text"
                  )}
                  onClick={() => setOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-xl bg-semantic-surface2 p-4">
            <p className="text-xs uppercase tracking-wide text-semantic-muted">Today</p>
            <p className="mt-2 text-sm font-medium text-semantic-text">Prioritize new high-urgency leads first.</p>
          </div>

          <div className="mt-auto pt-8">{onSignOut}</div>
        </aside>

        {open && (
          <button
            className="fixed inset-0 z-30 bg-neutral-900/30 lg:hidden"
            aria-label="Close navigation overlay"
            onClick={() => setOpen(false)}
          />
        )}

        <div className="flex min-h-screen flex-1 flex-col lg:pl-0">
          <header className="sticky top-0 z-20 border-b border-semantic-border bg-semantic-surface/95 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <button
                className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
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
          </header>

          <main className="w-full px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
