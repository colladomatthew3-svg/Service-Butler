"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUT = exports.POST = exports.GET = void 0;
const next_1 = require("inngest/next");
const client_1 = require("@/lib/workflows/client");
const functions_1 = require("@/lib/workflows/functions");
const v2_functions_1 = require("@/lib/workflows/v2-functions");
_a = (0, next_1.serve)({
    client: client_1.inngest,
    functions: [functions_1.missedCallFollowup, functions_1.newLeadFollowup, functions_1.reviewRequest, functions_1.campaignDispatch, v2_functions_1.v2ConnectorRunRequested, v2_functions_1.v2AssignmentSlaWatch]
}), exports.GET = _a.GET, exports.POST = _a.POST, exports.PUT = _a.PUT;
