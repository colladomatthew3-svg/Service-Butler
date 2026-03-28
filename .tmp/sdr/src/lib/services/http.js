"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicRequestUrl = getPublicRequestUrl;
function getPublicRequestUrl(req) {
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (process.env.WEBHOOK_BASE_URL) {
        return `${process.env.WEBHOOK_BASE_URL}${new URL(req.url).pathname}`;
    }
    if (forwardedProto && forwardedHost) {
        return `${forwardedProto}://${forwardedHost}${new URL(req.url).pathname}`;
    }
    return req.url;
}
