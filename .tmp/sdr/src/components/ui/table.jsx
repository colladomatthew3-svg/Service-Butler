"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Table = Table;
exports.TableHead = TableHead;
exports.TableBody = TableBody;
exports.TH = TH;
exports.TD = TD;
const cn_1 = require("@/lib/utils/cn");
function Table({ className, ...props }) {
    return <table className={(0, cn_1.cn)("w-full border-separate border-spacing-y-2", className)} {...props}/>;
}
function TableHead({ className, ...props }) {
    return <thead className={(0, cn_1.cn)(className)} {...props}/>;
}
function TableBody({ className, ...props }) {
    return <tbody className={(0, cn_1.cn)(className)} {...props}/>;
}
function TH({ className, ...props }) {
    return <th className={(0, cn_1.cn)("px-4 pb-2 text-left text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-semantic-muted", className)} {...props}/>;
}
function TD({ className, ...props }) {
    return <td className={(0, cn_1.cn)("bg-white/78 px-4 py-3 align-top text-sm text-semantic-text first:rounded-l-2xl last:rounded-r-2xl", className)} {...props}/>;
}
