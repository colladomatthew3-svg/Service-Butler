"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.twimlResponse = twimlResponse;
function twimlResponse(body) {
    return new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/xml" }
    });
}
