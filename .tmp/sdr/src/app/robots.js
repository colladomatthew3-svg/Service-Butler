"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = robots;
function robots() {
    return {
        rules: {
            userAgent: "*",
            allow: "/"
        },
        sitemap: "https://servicebutler.ai/sitemap.xml"
    };
}
