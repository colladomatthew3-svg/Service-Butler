"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logo = Logo;
const image_1 = __importDefault(require("next/image"));
const cn_1 = require("@/lib/utils/cn");
const FULL_LOGO_RATIO = 1700 / 340;
const MARK_RATIO = 581 / 492;
function Logo({ variant = "full", size = 40, className }) {
    const isMark = variant === "mark";
    const isFullLogo = variant === "full" || variant === "lockup" || variant === "wordmark";
    const width = Math.round(size * (isMark ? MARK_RATIO : FULL_LOGO_RATIO));
    if (isMark) {
        return (<image_1.default src="/brand/logo-mark.svg" alt="Service Butler icon" width={width} height={size} className={(0, cn_1.cn)("h-auto w-auto object-contain", className)} priority/>);
    }
    if (isFullLogo) {
        return (<image_1.default src="/brand/logo.svg" alt="Service Butler logo" width={width} height={size} className={(0, cn_1.cn)("h-auto w-auto object-contain", className)} priority/>);
    }
    return null;
}
