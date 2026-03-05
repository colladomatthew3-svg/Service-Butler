import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#d7e0e7] bg-white/95 backdrop-blur">
      <div className="container py-3">
        <div className="flex min-h-14 items-center gap-4">
          <Link href="/" className="flex items-center overflow-visible" aria-label="Service Butler home">
            <Logo variant="full" size={40} className="md:hidden" />
            <Logo variant="full" size={46} className="hidden md:block" />
          </Link>
          <div className="ml-auto hidden items-center gap-7 text-sm font-semibold text-[#425d71] lg:flex">
            <Link href="/#features" className="transition hover:text-[#173f59]">
              Product
            </Link>
            <Link href="/#how-it-works" className="transition hover:text-[#173f59]">
              How it Works
            </Link>
            <Link href="/#features" className="transition hover:text-[#173f59]">
              Features
            </Link>
            <Link href="/blog" className="transition hover:text-[#173f59]">
              Blog
            </Link>
            <Link href="/login" className="transition hover:text-[#173f59]">
              Login
            </Link>
          </div>
          <Link
            href="/login"
            className="ml-auto inline-flex h-11 items-center rounded-xl bg-[#0f3554] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#124469] lg:ml-4"
          >
            Start Free Trial
          </Link>
        </div>
        <nav className="mt-3 flex items-center gap-5 overflow-x-auto border-t border-[#dde5ec] pt-3 text-sm font-semibold text-[#446276] lg:hidden">
          <Link href="/#features" className="shrink-0 transition hover:text-[#173f59]">
            Product
          </Link>
          <Link href="/#how-it-works" className="shrink-0 transition hover:text-[#173f59]">
            How it Works
          </Link>
          <Link href="/#features" className="shrink-0 transition hover:text-[#173f59]">
            Features
          </Link>
          <Link href="/blog" className="shrink-0 transition hover:text-[#173f59]">
            Blog
          </Link>
          <Link href="/login" className="shrink-0 transition hover:text-[#173f59]">
            Login
          </Link>
        </nav>
      </div>
    </header>
  );
}
