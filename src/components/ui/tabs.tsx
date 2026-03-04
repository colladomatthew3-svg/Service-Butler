import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export type TabItem = {
  label: string;
  href: string;
  active?: boolean;
};

export function Tabs({ items }: { items: TabItem[] }) {
  return (
    <div className="inline-flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-semantic-border bg-semantic-surface2 p-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition",
            item.active
              ? "bg-semantic-surface text-brand-700 shadow-sm ring-1 ring-inset ring-brand-500/25"
              : "text-semantic-muted hover:text-semantic-text"
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
