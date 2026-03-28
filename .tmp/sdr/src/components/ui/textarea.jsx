"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Textarea = Textarea;
const cn_1 = require("@/lib/utils/cn");
function Textarea({ className, ...props }) {
    return (<textarea className={(0, cn_1.cn)("w-full rounded-xl border border-semantic-border bg-semantic-surface px-4 py-3 text-sm text-semantic-text shadow-sm outline-none transition placeholder:text-semantic-muted focus:border-semantic-brand focus:ring-4 focus:ring-semantic-brand/15", className)} {...props}/>);
}
