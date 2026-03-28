"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LoginPage;
const auth_1 = require("@/actions/auth");
const dev_quick_login_1 = require("@/lib/auth/dev-quick-login");
const review_mode_1 = require("@/lib/services/review-mode");
const link_1 = __importDefault(require("next/link"));
const Footer_1 = require("@/components/brand/Footer");
const Logo_1 = require("@/components/brand/Logo");
const card_1 = require("@/components/ui/card");
const input_1 = require("@/components/ui/input");
const button_1 = require("@/components/ui/button");
async function LoginPage({ searchParams }) {
    const params = await searchParams;
    const devQuickLoginConfigured = process.env.NODE_ENV === "development" && (0, dev_quick_login_1.hasDevAuthPassword)();
    const demoMode = (0, review_mode_1.isDemoMode)();
    return (<>
      <main className="container py-16">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[0.88fr_0.72fr] lg:items-center">
          <section className="max-w-xl">
            <link_1.default href="/" className="inline-flex">
              <Logo_1.Logo variant="full" size={44} className="h-10 w-auto sm:h-11"/>
            </link_1.default>
            <p className="eyebrow mt-8">Demo-ready opportunity engine</p>
            <h1 className="title-hero mt-6 max-w-[10ch] text-semantic-text">
              Turn live signals into leads your team can schedule today.
            </h1>
            <p className="text-body-lg mt-5 text-semantic-muted">
              Demo mode includes a saved service area, weather-driven demand, and Scanner opportunities so you can walk
              straight into the product story without external setup.
            </p>
          </section>

          <div className="mx-auto w-full max-w-lg">
            <card_1.Card className="shadow-card">
              <card_1.CardHeader>
                <h2 className="text-2xl font-semibold text-semantic-text">Sign in</h2>
                <p className="mt-1 text-sm text-semantic-muted">Use your work email to get a secure magic link.</p>
              </card_1.CardHeader>
              <card_1.CardBody>
              {demoMode && (<div className="mb-4 rounded-xl border border-brand-500/20 bg-brand-50/70 p-4">
                  <p className="text-sm font-semibold text-semantic-text">Demo mode is enabled</p>
                  <p className="mt-1 text-sm text-semantic-muted">Use the demo login to enter the product with seeded Scanner and Weather data.</p>
                  <form action={auth_1.startDemoSession} className="mt-3">
                    <button_1.Button type="submit" size="lg" fullWidth>
                      Demo Login
                    </button_1.Button>
                  </form>
                </div>)}

              {params.membership === "required" && (<p className="mb-4 rounded-xl border border-danger-500/25 bg-danger-100 px-4 py-3 text-sm text-danger-700">
                  Your user does not have an active account membership. Seed users or assign an account role first.
                </p>)}

              {params.sent === "1" && (<p className="mb-4 rounded-xl border border-success-500/25 bg-success-100 px-4 py-3 text-sm text-success-700">
                  Magic link sent. Check your inbox.
                </p>)}
              {params.devQuickLogin && (<p className="mb-4 rounded-xl border border-warning-500/25 bg-warning-100 px-4 py-3 text-sm text-warning-700">
                  Dev quick login unavailable ({params.devQuickLogin}). Configure DEV_AUTH_PASSWORD to enable it.
                </p>)}

              <form action={auth_1.signInWithMagicLink} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-semantic-muted">Email</label>
                  <input_1.Input name="email" type="email" placeholder="you@company.com" required/>
                </div>
                <button_1.Button type="submit" size="lg" fullWidth>
                  Send Magic Link
                </button_1.Button>
              </form>
              </card_1.CardBody>
            </card_1.Card>

            {process.env.NODE_ENV === "development" && (<card_1.Card className="mt-5">
                <card_1.CardHeader>
                  <h2 className="text-lg font-semibold text-semantic-text">Dev Quick Login</h2>
                  {devQuickLoginConfigured ? (<p className="mt-1 text-sm text-semantic-muted">
                      Development only. Uses `DEV_AUTH_PASSWORD` and redirects to dashboard.
                    </p>) : (<p className="mt-1 text-sm text-semantic-muted">
                      Dev quick login not configured. Set DEV_AUTH_PASSWORD in .env.local to enable.
                    </p>)}
                </card_1.CardHeader>
                <card_1.CardBody className="space-y-3">
                  <form action={auth_1.signInWithDevQuickLogin}>
                    <input type="hidden" name="email" value="owner@servicebutler.local"/>
                    <button_1.Button type="submit" size="lg" fullWidth disabled={!devQuickLoginConfigured}>
                      Login as Owner
                    </button_1.Button>
                  </form>
                  <form action={auth_1.signInWithDevQuickLogin}>
                    <input type="hidden" name="email" value="dispatcher@servicebutler.local"/>
                    <button_1.Button type="submit" size="lg" variant="secondary" fullWidth disabled={!devQuickLoginConfigured}>
                      Login as Dispatcher
                    </button_1.Button>
                  </form>
                  <form action={auth_1.signInWithDevQuickLogin}>
                    <input type="hidden" name="email" value="tech@servicebutler.local"/>
                    <button_1.Button type="submit" size="lg" variant="secondary" fullWidth disabled={!devQuickLoginConfigured}>
                      Login as Tech
                    </button_1.Button>
                  </form>
                </card_1.CardBody>
              </card_1.Card>)}
          </div>
        </div>
      </main>
      <Footer_1.Footer />
    </>);
}
