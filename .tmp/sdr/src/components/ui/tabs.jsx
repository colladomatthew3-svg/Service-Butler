"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tabs = Tabs;
const link_1 = __importDefault(require("next/link"));
const cn_1 = require("@/lib/utils/cn");
function Tabs({ items }) {
    return (<div className="inline-flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-semantic-border bg-semantic-surface2 p-1">
      {items.map((item) => (<link_1.default key={item.href} href={item.href} className={(0, cn_1.cn)("rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition", item.active
                ? "bg-semantic-surface text-brand-700 shadow-sm ring-1 ring-inset ring-brand-500/25"
                : "text-semantic-muted hover:text-semantic-text")}>
          {item.label}
        </link_1.default>))}
    </div>);
}
