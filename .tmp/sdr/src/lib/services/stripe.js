"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStripeClient = getStripeClient;
exports.isSubscriptionAllowed = isSubscriptionAllowed;
const stripe_1 = __importDefault(require("stripe"));
let stripeClient = null;
const graceDays = Number(process.env.SUBSCRIPTION_GRACE_DAYS || "3");
function getStripeClient() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY is required");
    }
    if (!stripeClient) {
        stripeClient = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
            apiVersion: "2025-08-27.basil"
        });
    }
    return stripeClient;
}
function isSubscriptionAllowed(status, currentPeriodEnd, now = new Date()) {
    if (status === "active" || status === "trialing")
        return true;
    if (status === "past_due" && currentPeriodEnd) {
        const end = new Date(currentPeriodEnd);
        const graceEnd = new Date(end.getTime() + graceDays * 24 * 60 * 60 * 1000);
        return now <= graceEnd;
    }
    return false;
}
