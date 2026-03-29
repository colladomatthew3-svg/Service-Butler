"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LayoutGrid, Users, CalendarDays, MessageSquare, Settings, X, Radar, KanbanSquare, BriefcaseBusiness, Megaphone, Radio, MapPinned, ShieldAlert } from "lucide-react";
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

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: "Command",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
      { href: "/dashboard/scanner", label: "Scanner", icon: Radar },
      { href: "/dashboard/jobs", label: "Jobs", icon: BriefcaseBusiness }
    ]
  },
  {
    label: "Pipeline",
    items: [
      { href: "/dashboard/leads", label: "Leads", icon: Users },
      { href: "/dashboard/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/dashboard/outbound", label: "Outbound", icon: Megaphone }
    ]
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/inbox", label: "Inbox", icon: MessageSquare },
      { href: "/dashboard/schedule", label: "Schedule", icon: CalendarDays },
      { href: "/dashboard/settings", label: "Settings", icon: Settings }
    ]
  },
  {
    label: "Intelligence",
    items: [
      { href: "/dashboard/scanner", label: "Signals", icon: Radio },
      { href: "/dashboard/outbound", label: "Territories", icon: MapPinned },
      { href: "/dashboard/settings", label: "Controls", icon: ShieldAlert }
    ]
  }
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
        <div className="absolute inset-y-0 left-0 w-[22rem] bg-[linear-gradient(180deg,rgba(18,27,25,0.96),rgba(19,30,27,0.9))]" />
        <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-brand-100/18 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-[rgb(var(--accentSoft))/0.4] blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-[1600px] gap-3 px-2 pb-6 pt-3 md:gap-5 md:px-5 md:pb-8 md:pt-4">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/8 bg-[linear-gradient(180deg,rgba(14,22,21,0.98),rgba(18,29,27,0.94))] px-5 py-6 text-white shadow-[0_24px_64px_rgba(10,14,13,0.45)] backdrop-blur transition-transform lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] lg:translate-x-0 lg:rounded-[2rem] lg:border lg:border-white/8",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="mb-8 flex items-start justify-between gap-3">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Logo variant="mark" size={32} className="h-8 w-auto" />
                <div className="space-y-1">
                  <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-white/45">Operator Console</p>
                  <p className="text-sm font-semibold text-white">Service Butler</p>
                </div>
              </div>
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-brand-100">
                Franchise Revenue OS
              </div>
            </div>
            <button
              className="rounded-lg p-2 text-white/60 hover:bg-white/10 lg:hidden"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="space-y-5">
            {navSections.map((section) => (
              <div key={section.label} className="space-y-2">
                <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/35">{section.label}</p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "sidebar-label flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 transition",
                          active
                            ? "bg-[linear-gradient(120deg,rgba(34,148,102,0.24),rgba(34,148,102,0.09))] text-white shadow-[0_10px_26px_rgba(10,18,16,0.28)] ring-1 ring-white/8"
                            : "text-white/62 hover:bg-white/8 hover:text-white"
                        )}
                        onClick={() => setOpen(false)}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className="text-sm">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-8 rounded-[1.35rem] border border-white/8 bg-white/6 p-4 shadow-[0_12px_28px_rgba(6,10,9,0.22)]">
            <p className="text-xs uppercase tracking-wide text-white/45">Today</p>
            <p className="sidebar-label mt-2 text-white">Prioritize new high-urgency leads first.</p>
            <p className="mt-2 text-xs text-white/55">Use Signals, Leads, and Outbound in that order when the board gets busy.</p>
          </div>

          <div className="mt-auto pt-8">
            <div className="rounded-[1.35rem] border border-white/8 bg-white/6 p-3">{onSignOut}</div>
          </div>
        </aside>

        {open && (
          <button
            className="fixed inset-0 z-30 bg-neutral-900/35 backdrop-blur-[1px] lg:hidden"
            aria-label="Close navigation overlay"
            onClick={() => setOpen(false)}
          />
        )}

        <div className="flex min-h-[calc(100dvh-1.1rem)] flex-1 flex-col rounded-[1.5rem] border border-semantic-border/45 bg-white/38 shadow-[0_26px_80px_rgba(31,42,36,0.12)] backdrop-blur-lg sm:rounded-[2rem] lg:pl-0">
          <header className="sticky top-0 z-20 rounded-t-[1.5rem] border-b border-semantic-border/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(252,253,250,0.62))] px-3 py-3 backdrop-blur-md sm:rounded-t-[2rem] sm:px-6">
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
