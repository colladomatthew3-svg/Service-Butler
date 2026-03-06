import { Footer } from "@/components/brand/Footer";
import { TopNav } from "@/components/brand/TopNav";

export default function TermsPage() {
  return (
    <>
      <TopNav />
      <main className="page-section pt-12">
        <div className="container">
          <div className="mx-auto max-w-3xl rounded-[2rem] border border-semantic-border bg-semantic-surface px-6 py-8 shadow-soft sm:px-10 sm:py-10">
            <p className="eyebrow">Terms</p>
            <h1 className="section-title mt-5">Terms of service</h1>
            <p className="mt-5 text-base leading-8 text-semantic-muted">
              Service Butler is provided for business use by licensed or authorized home service operators and their teams.
              Account owners are responsible for user access, data accuracy, and communications sent through the platform.
            </p>
            <p className="mt-5 text-base leading-8 text-semantic-muted">
              The service should be used in compliance with local regulations, customer consent requirements, and any
              carrier or messaging rules that apply to outbound communication.
            </p>
            <p className="mt-5 text-base leading-8 text-semantic-muted">
              Questions about contracts, billing, or account access can be sent to <a className="font-semibold text-brand-700" href="mailto:sales@servicebutler.ai">sales@servicebutler.ai</a>.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
