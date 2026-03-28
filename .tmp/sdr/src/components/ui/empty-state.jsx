"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyState = EmptyState;
const link_1 = __importDefault(require("next/link"));
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
function EmptyState({ icon, title, description, ctaLabel, ctaHref }) {
    return (<card_1.Card>
      <card_1.CardBody className="flex flex-col items-center py-12 text-center">
        {icon && <div className="mb-4 rounded-full bg-semantic-surface2 p-3 text-semantic-muted">{icon}</div>}
        <h3 className="text-lg font-semibold text-semantic-text">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-semantic-muted">{description}</p>
        {ctaLabel && ctaHref && (<link_1.default href={ctaHref} className={(0, button_1.buttonStyles)({ className: "mt-6" })}>
            {ctaLabel}
          </link_1.default>)}
      </card_1.CardBody>
    </card_1.Card>);
}
