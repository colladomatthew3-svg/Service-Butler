"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Inbox,
  LayoutGrid,
  Users,
  Target,
  CalendarDays,
  Settings,
  X,
  Globe,
  Radar,
  KanbanSquare,
  BriefcaseBusiness,
  Megaphone,
  MessageSquare,
  CreditCard,
  ChevronRight,
  CircleDot
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { AppTopBar } from "@/components/brand/AppTopBar";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: "Operator",
    items: [
      { href: "/dashboard", label: "Command Center", icon: LayoutGrid, exact: true },
      { href: "/dashboard/opportunities", label: "Opportunities", icon: Target },
      { href: "/dashboard/scanner", label: "Scanner", icon: Radar },
      { href: "/dashboard/inbox", label: "Inbox", icon: Inbox }
    ]
  },
  {
    label: "Pipeline",
    items: [
      { href: "/dashboard/leads", label: "Leads", icon: Users },
      { href: "/dashboard/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/dashboard/jobs", label: "Jobs", icon: BriefcaseBusiness }
    ]
  },
  {
    label: "Network",
    items: [{ href: "/dashboard/network", label: "Network Overview", icon: Globe, exact: true }]
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/schedule", label: "Schedule", icon: CalendarDays },
      { href: "/dashboard/outbound", label: "Outreach", icon: Megaphone },
      { href: "/conversations", label: "Conversations", icon: MessageSquare }
    ]
  },
  {
    label: "Admin",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/billing", label: "Billing", icon: CreditCard },
      { href: "/dashboard/settings", label: "Settings", icon: Settings }
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

  const isItemActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <div className="min-h-screen bg-semantic-bg text-semantic-text">
      <div className="mx-auto flex min-h-screen max-w-[1720px]">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-[16.25rem] flex-col border-r border-[rgb(var(--sb-sidebar-border))] bg-[rgb(var(--sb-sidebar))] px-4 py-5 text-[rgb(var(--sb-sidebar-text))] transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 shadow-sm">
                <Logo variant="mark" size={24} className="h-6 w-auto" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold tracking-tight text-white">Service Butler</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--sb-sidebar-muted))]">Restoration Lead Engine</p>
              </div>
            </div>
            <button
              className="rounded-md border border-white/10 bg-white/5 p-2 text-[rgb(var(--sb-sidebar-text))] transition hover:bg-white/10 lg:hidden"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-5 rounded-lg border border-white/8 bg-white/5 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--sb-sidebar-muted))]">Workspace</p>
            <div className="mt-2 flex items-center gap-2">
              <CircleDot className={`h-3.5 w-3.5 ${demoMode ? "fill-current text-[rgb(var(--sb-primary))]" : "fill-current text-emerald-400"}`} />
              <p className="text-sm font-medium text-white">{demoMode ? "Demo workspace" : "Live operations"}</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-[rgb(var(--sb-sidebar-muted))]">
              Demand monitoring, verified leads, and booked-job proof in one operator console.
            </p>
          </div>

          <nav className="space-y-5">
            {navSections.map((section) => (
              <div key={section.label} className="space-y-2">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--sb-sidebar-muted))]">{section.label}</p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition duration-150",
                          active ? "bg-white/8 text-white" : "text-[rgb(var(--sb-sidebar-text))]/88 hover:bg-white/5 hover:text-white"
                        )}
                        onClick={() => setOpen(false)}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition",
                            active ? "text-[rgb(var(--sb-primary))]" : "text-[rgb(var(--sb-sidebar-muted))] group-hover:text-white"
                          )}
                        />
                        <span className="sidebar-label">{item.label}</span>
                        {active && <ChevronRight className="ml-auto h-4 w-4 text-white/70" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-8 rounded-lg border border-white/8 bg-white/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--sb-sidebar-muted))]">System pulse</p>
            <div className="mt-3 space-y-2 text-sm text-white/90">
              <p>Demand signals monitored across weather, outreach, and local market activity.</p>
              <p className="text-xs leading-5 text-[rgb(var(--sb-sidebar-muted))]">
                Use the command center to see pressure, work verified leads, and prove booked-job value.
              </p>
            </div>
          </div>

          <div className="mt-auto pt-8">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">{onSignOut}</div>
          </div>
        </aside>

        {open && (
          <button
            className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
            aria-label="Close navigation overlay"
            onClick={() => setOpen(false)}
          />
        )}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-semantic-border bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <button
                className="rounded-md border border-semantic-border bg-semantic-surface p-2 text-semantic-muted transition hover:bg-white lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="md:hidden">
                <Logo variant="mark" size={30} className="h-8 w-auto" />
              </div>
              <AppTopBar demoMode={demoMode} />
            </div>
          </header>

          <main className="w-full px-4 py-6 sm:px-6 sm:py-6 animate-rise-in">{children}</main>
        </div>
      </div>
    </div>
  );
}
