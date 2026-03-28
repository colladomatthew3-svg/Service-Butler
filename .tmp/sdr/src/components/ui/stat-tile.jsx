"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatTile = StatTile;
const card_1 = require("@/components/ui/card");
function StatTile({ label, value, icon, tone = "neutral" }) {
    const toneClass = tone === "brand"
        ? "bg-brand-50 text-brand-700"
        : tone === "success"
            ? "bg-success-100 text-success-700"
            : tone === "warning"
                ? "bg-warning-100 text-warning-700"
                : "bg-semantic-surface2 text-semantic-muted";
    return (<card_1.Card className="overflow-hidden">
      <card_1.CardBody className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-semantic-muted">{label}</p>
          <p className="mt-2 font-heading text-3xl font-semibold tracking-tight text-semantic-text">{value}</p>
        </div>
        {icon && <div className={`rounded-2xl p-3 ${toneClass}`}>{icon}</div>}
      </card_1.CardBody>
    </card_1.Card>);
}
