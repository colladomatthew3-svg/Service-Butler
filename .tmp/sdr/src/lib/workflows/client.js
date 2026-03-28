"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inngest = void 0;
const inngest_1 = require("inngest");
exports.inngest = new inngest_1.Inngest({
    id: "servicebutler",
    eventKey: process.env.INNGEST_EVENT_KEY
});
