import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export type TabItem = {
  label: string;
  href: string;
  active?: boolean;
};

export function Tabs({ items }: { items: TabItem[] }) {
  return (
    <div className="inline-flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-50 p-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition",
            item.active ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
