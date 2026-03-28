"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeToE164 = normalizeToE164;
function normalizeToE164(phoneRaw, defaultCountryCode = "+1") {
    const digits = phoneRaw.replace(/[^\d+]/g, "");
    if (!digits)
        throw new Error("Invalid phone number");
    if (digits.startsWith("+")) {
        if (!/^\+[1-9]\d{7,14}$/.test(digits))
            throw new Error("Invalid E.164 phone number");
        return digits;
    }
    const stripped = digits.replace(/^0+/, "");
    const value = `${defaultCountryCode}${stripped}`;
    if (!/^\+[1-9]\d{7,14}$/.test(value))
        throw new Error("Invalid phone number");
    return value;
}
