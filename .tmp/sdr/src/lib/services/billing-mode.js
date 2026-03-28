"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBillingMode = getBillingMode;
exports.isBillingDisabled = isBillingDisabled;
function getBillingMode() {
    return process.env.BILLING_MODE === "stripe" ? "stripe" : "disabled";
}
function isBillingDisabled() {
    return getBillingMode() === "disabled";
}
