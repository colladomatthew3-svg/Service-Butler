"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LayoutGrid, Users, CalendarDays, MessageSquare, Settings, X, Radar, KanbanSquare, BriefcaseBusiness, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { AppTopBar } from "@/components/brand/AppTopBar";
import { buttonStyles } from "@/components/ui/button";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/dashboard/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/dashboard/scanner", label: "Scanner", icon: Radar },
  { href: "/dashboard/outbound", label: "Outbound", icon: Megaphone },
  { href: "/dashboard/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/dashboard/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/dashboard/settings", label: "Settings", icon: Settings }
];

export function DashboardAppShell({
  children,
  onSignOut,
  demoMode
}: {
  children: ReactNode;
  onSignOut: ReactNode;
  demoMode?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-semantic-bg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-brand-100/70 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-[rgb(var(--accentSoft))/0.58] blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-[1600px] gap-3 px-2 pb-6 pt-3 md:gap-5 md:px-5 md:pb-8 md:pt-4">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-72 border-r border-semantic-border/70 bg-[linear-gradient(170deg,rgba(255,255,255,0.9),rgba(246,248,243,0.7))] px-5 py-6 shadow-[0_24px_64px_rgba(23,34,29,0.2)] backdrop-blur transition-transform lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] lg:translate-x-0 lg:rounded-[2rem] lg:border lg:border-semantic-border/65",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="mb-8 flex items-center justify-between">
            <div className="space-y-3">
              <Logo variant="mark" size={32} className="h-8 w-auto" />
              <p className="text-xs uppercase tracking-[0.14em] text-semantic-muted">Ops Console</p>
            </div>
            <button
              className="rounded-lg p-2 text-semantic-muted hover:bg-semantic-surface2 lg:hidden"
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
                    "sidebar-label flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 transition",
                    active
                      ? "bg-[linear-gradient(120deg,rgba(34,148,102,0.2),rgba(34,148,102,0.08))] text-brand-700 shadow-[0_8px_20px_rgba(25,112,77,0.14)]"
                      : "text-semantic-muted hover:bg-white/80 hover:text-semantic-text"
                  )}
                  onClick={() => setOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl border border-semantic-border/60 bg-white/65 p-4">
            <p className="text-xs uppercase tracking-wide text-semantic-muted">Today</p>
            <p className="sidebar-label mt-2 text-semantic-text">Prioritize new high-urgency leads first.</p>
          </div>

          <div className="mt-auto pt-8">{onSignOut}</div>
        </aside>

        {open && (
          <button
            className="fixed inset-0 z-30 bg-neutral-900/35 backdrop-blur-[1px] lg:hidden"
            aria-label="Close navigation overlay"
            onClick={() => setOpen(false)}
          />
        )}

        <div className="flex min-h-[calc(100dvh-1.1rem)] flex-1 flex-col rounded-[1.5rem] border border-semantic-border/45 bg-white/38 shadow-[0_26px_80px_rgba(31,42,36,0.12)] backdrop-blur-lg sm:rounded-[2rem] lg:pl-0">
          <header className="sticky top-0 z-20 rounded-t-[1.5rem] border-b border-semantic-border/45 bg-white/52 px-3 py-3 backdrop-blur-md sm:rounded-t-[2rem] sm:px-6">
            {demoMode && (
              <div className="mb-3 rounded-2xl border border-brand-500/30 bg-brand-50/90 px-3 py-2 text-sm font-semibold text-brand-700">
                Demo Mode (no auth)
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                className="rounded-lg p-2 text-semantic-muted hover:bg-semantic-surface2 lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="md:hidden">
                <Logo variant="mark" size={32} className="h-8 w-auto" />
              </div>
              <AppTopBar />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 lg:hidden">
              <Link href="/dashboard/scanner" className={buttonStyles({ size: "sm", className: "w-full" })}>
                Scan
              </Link>
              <Link href="/dashboard/leads" className={buttonStyles({ size: "sm", variant: "secondary", className: "w-full" })}>
                Leads
              </Link>
              <Link href="/dashboard/pipeline" className={buttonStyles({ size: "sm", variant: "secondary", className: "w-full" })}>
                Pipeline
              </Link>
            </div>
          </header>

          <main className="w-full px-3 py-5 sm:px-6 sm:py-8 animate-rise-in">{children}</main>
        </div>
      </div>
    </div>
  );
}
