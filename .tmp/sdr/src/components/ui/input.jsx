"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Input = Input;
const cn_1 = require("@/lib/utils/cn");
function Input({ className, ...props }) {
    return (<input className={(0, cn_1.cn)("h-12 w-full rounded-[1.05rem] border border-semantic-border/75 bg-white/82 px-4 text-sm text-semantic-text shadow-[0_10px_24px_rgba(30,42,36,0.08)] outline-none transition placeholder:text-semantic-muted focus:border-semantic-brand focus:ring-4 focus:ring-semantic-brand/15", className)} {...props}/>);
}
