import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-semantic-border bg-semantic-surface/90 backdrop-blur">
      <div className="container flex min-h-20 items-center gap-4">
        <Link href="/" className="flex items-center">
          <Logo variant="wordmark" size={34} />
        </Link>
        <nav className="ml-auto hidden items-center gap-6 text-sm font-semibold text-semantic-muted md:flex">
          <a href="#how-it-works" className="hover:text-semantic-text">
            How it works
          </a>
          <a href="#features" className="hover:text-semantic-text">
            Features
          </a>
          <Link href="/login" className="hover:text-semantic-text">
            Login
          </Link>
        </nav>
        <div className="ml-2 hidden md:block">
          <Link href="/login">
            <Button>Get Started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
