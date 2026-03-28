"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logEvent = logEvent;
function logEvent(level, event, data = {}) {
    const payload = {
        ts: new Date().toISOString(),
        level,
        event,
        ...data
    };
    if (level === "error") {
        console.error(JSON.stringify(payload));
        return;
    }
    console.log(JSON.stringify(payload));
}
