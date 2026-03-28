"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTwilioRawForm = parseTwilioRawForm;
exports.validateTwilioRequest = validateTwilioRequest;
const twilio_1 = __importDefault(require("twilio"));
function parseTwilioRawForm(rawBody) {
    const params = new URLSearchParams(rawBody);
    return Object.fromEntries(params.entries());
}
function validateTwilioRequest(signature, url, payload) {
    if (!process.env.TWILIO_AUTH_TOKEN || !signature)
        return false;
    return twilio_1.default.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, payload);
}
