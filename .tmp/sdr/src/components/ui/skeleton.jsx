"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Skeleton = Skeleton;
const cn_1 = require("@/lib/utils/cn");
function Skeleton({ className, ...props }) {
    return <div className={(0, cn_1.cn)("animate-pulse rounded-xl bg-semantic-surface2", className)} {...props}/>;
}
