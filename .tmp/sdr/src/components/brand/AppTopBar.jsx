"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppTopBar = AppTopBar;
const link_1 = __importDefault(require("next/link"));
const Logo_1 = require("@/components/brand/Logo");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
function AppTopBar() {
    return (<div className="flex w-full items-center gap-3">
      <link_1.default href="/dashboard" className="hidden items-center md:flex">
        <Logo_1.Logo variant="full" size={38} className="max-w-[228px]"/>
      </link_1.default>
      <div className="w-full max-w-xl">
        <input_1.Input placeholder="Search lead name, phone, neighborhood, service line..." className="h-11 border-semantic-border/70 bg-white/86 shadow-[0_12px_28px_rgba(31,43,37,0.09)]"/>
      </div>
      <div className="ml-auto hidden items-center gap-2 sm:flex">
        <span className="rounded-full border border-brand-500/35 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
          Verified Lead Engine
        </span>
        <link_1.default href="/dashboard/leads" className={(0, button_1.buttonStyles)({ size: "md", className: "h-11" })}>
          New Lead
        </link_1.default>
        <link_1.default href="/dashboard/scanner" className={(0, button_1.buttonStyles)({ size: "md", variant: "secondary", className: "h-11" })}>
          Run Scanner
        </link_1.default>
      </div>
    </div>);
}
