"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = GlobalError;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const lucide_react_1 = require("lucide-react");
const button_1 = require("@/components/ui/button");
function GlobalError({ error, reset }) {
    (0, react_1.useEffect)(() => {
        console.error("Global UI error", error);
    }, [error]);
    return (<div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
      <div className="rounded-2xl border border-warning-300 bg-warning-50 px-4 py-2 text-warning-900">
        <lucide_react_1.AlertTriangle className="mx-auto h-5 w-5"/>
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-semantic-text">Something went wrong</h1>
      <p className="mt-2 max-w-xl text-sm text-semantic-muted">
        We hit an unexpected issue while rendering this page. You can retry immediately or return to the dashboard.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button_1.Button onClick={reset}>Retry</button_1.Button>
        <link_1.default href="/dashboard">
          <button_1.Button variant="secondary">Back to dashboard</button_1.Button>
        </link_1.default>
      </div>
    </div>);
}
