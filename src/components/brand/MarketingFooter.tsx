import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const productLinks = [
  { label: "Jobs", href: "/dashboard/jobs" },
  { label: "Pipeline", href: "/dashboard/pipeline" },
  { label: "Inbox", href: "/dashboard/inbox" },
  { label: "Scheduling", href: "/dashboard/schedule" }
];

const resourceLinks = [
  { label: "Blog", href: "/blog" },
  { label: "Help", href: "#" },
  { label: "Privacy", href: "#" },
  { label: "Terms", href: "#" }
];

const companyLinks = [
  { label: "About", href: "#" },
  { label: "Contact", href: "#" }
];

export function MarketingFooter() {
  return (
    <footer className="mt-20 border-t border-[#d4dde4] bg-[#0f2433] text-[#d5e0e7]">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center">
              <Logo variant="full" size={42} />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#b8c8d4]">
              Service Butler is lead-to-job software for home service teams. Never lose another lead.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#90a8b8]">Product</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {productLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="transition hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#90a8b8]">Resources</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {resourceLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="transition hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#90a8b8]">Company</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {companyLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="transition hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-[#294155] pt-5 text-sm text-[#9cb2c1]">© Service Butler</div>
      </div>
    </footer>
  );
}
