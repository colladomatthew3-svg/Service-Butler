"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cn = cn;
function cn(...values) {
    return values.filter(Boolean).join(" ");
}
