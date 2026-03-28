"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PrivacyPage;
const Footer_1 = require("@/components/brand/Footer");
const TopNav_1 = require("@/components/brand/TopNav");
function PrivacyPage() {
    return (<>
      <TopNav_1.TopNav />
      <main className="page-section pt-12">
        <div className="container">
          <div className="mx-auto max-w-3xl rounded-[2rem] border border-semantic-border bg-semantic-surface px-6 py-8 shadow-soft sm:px-10 sm:py-10">
            <p className="eyebrow">Privacy</p>
            <h1 className="section-title mt-5">Privacy policy</h1>
            <p className="mt-5 text-base leading-8 text-semantic-muted">
              Service Butler stores customer and job information to support lead intake, scheduling, dispatch, messaging,
              and reporting workflows for home service businesses.
            </p>
            <p className="mt-5 text-base leading-8 text-semantic-muted">
              We use the minimum data required to operate the service, secure account access, and improve product
              reliability. Customers should avoid storing sensitive personal information that is unrelated to service delivery.
            </p>
            <p className="mt-5 text-base leading-8 text-semantic-muted">
              For support or data requests, contact <a className="font-semibold text-brand-700" href="mailto:support@servicebutler.ai">support@servicebutler.ai</a>.
            </p>
          </div>
        </div>
      </main>
      <Footer_1.Footer />
    </>);
}
