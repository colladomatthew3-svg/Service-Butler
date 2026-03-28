"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TopNav = TopNav;
const link_1 = __importDefault(require("next/link"));
const Logo_1 = require("@/components/brand/Logo");
const button_1 = require("@/components/ui/button");
const navLinks = [
    { href: "/", label: "Home" },
    { href: "/#features", label: "Features" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/blog", label: "Blog" },
    { href: "/login", label: "Login" }
];
function TopNav() {
    return (<header className="sticky top-0 z-40 border-b border-semantic-border/80 bg-[rgb(var(--sb-card))/0.9] backdrop-blur-xl">
      <div className="container flex min-h-24 items-center gap-4 py-4">
        <link_1.default href="/" className="min-w-0 flex-1 md:flex-none">
          <Logo_1.Logo variant="full" size={40} className="max-w-[270px] align-middle"/>
        </link_1.default>
        <nav className="ml-auto hidden items-center gap-7 text-base font-semibold text-semantic-muted lg:flex">
          {navLinks.map((link) => (<link_1.default key={link.label} href={link.href} className="transition hover:text-semantic-text">
              {link.label}
            </link_1.default>))}
        </nav>
        <div className="ml-2 hidden lg:block">
          <link_1.default href="/login" className={(0, button_1.buttonStyles)({ className: "min-w-32" })}>
            Try Demo
          </link_1.default>
        </div>
        <details className="relative ml-auto lg:hidden">
          <summary className="flex h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-semantic-border bg-semantic-surface2 px-3 text-base font-semibold text-semantic-text marker:hidden">
            Menu
          </summary>
          <div className="absolute right-0 top-[calc(100%+0.75rem)] w-72 rounded-2xl border border-semantic-border bg-semantic-surface p-3 shadow-card">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (<link_1.default key={link.label} href={link.href} className="rounded-xl px-4 py-3 text-sm font-semibold text-semantic-text transition hover:bg-semantic-surface2">
                  {link.label}
                </link_1.default>))}
            </nav>
            <link_1.default href="/login" className={(0, button_1.buttonStyles)({ size: "sm", fullWidth: true, className: "mt-3" })}>
              Try Demo
            </link_1.default>
          </div>
        </details>
      </div>
    </header>);
}
