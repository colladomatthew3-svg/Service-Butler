import { signInWithDevQuickLogin, signInWithMagicLink, startDemoSession } from "@/actions/auth";
import { hasDevAuthPassword } from "@/lib/auth/dev-quick-login";
import { isDemoMode } from "@/lib/services/review-mode";
import Link from "next/link";
import { Footer } from "@/components/brand/Footer";
import { Logo } from "@/components/brand/Logo";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ sent?: string; membership?: string; devQuickLogin?: string }>;
}) {
  const params = await searchParams;
  const devQuickLoginConfigured = process.env.NODE_ENV === "development" && hasDevAuthPassword();
  const demoMode = isDemoMode();

  return (
    <>
      <main className="container py-16">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[0.88fr_0.72fr] lg:items-center">
          <section className="max-w-xl">
            <Link href="/" className="inline-flex">
              <Logo variant="full" size={44} className="h-10 w-auto sm:h-11" />
            </Link>
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
            <Card className="shadow-card">
              <CardHeader>
                <h2 className="text-2xl font-semibold text-semantic-text">Sign in</h2>
                <p className="mt-1 text-sm text-semantic-muted">Use your work email to get a secure magic link.</p>
              </CardHeader>
              <CardBody>
              {demoMode && (
                <div className="mb-4 rounded-xl border border-brand-500/20 bg-brand-50/70 p-4">
                  <p className="text-sm font-semibold text-semantic-text">Demo mode is enabled</p>
                  <p className="mt-1 text-sm text-semantic-muted">Use the demo login to enter the product with seeded Scanner and Weather data.</p>
                  <form action={startDemoSession} className="mt-3">
                    <Button type="submit" size="lg" fullWidth>
                      Demo Login
                    </Button>
                  </form>
                </div>
              )}

              {params.membership === "required" && (
                <p className="mb-4 rounded-xl border border-danger-500/25 bg-danger-100 px-4 py-3 text-sm text-danger-700">
                  Your user does not have an active account membership. Seed users or assign an account role first.
                </p>
              )}

              {params.sent === "1" && (
                <p className="mb-4 rounded-xl border border-success-500/25 bg-success-100 px-4 py-3 text-sm text-success-700">
                  Magic link sent. Check your inbox.
                </p>
              )}
              {params.devQuickLogin && (
                <p className="mb-4 rounded-xl border border-warning-500/25 bg-warning-100 px-4 py-3 text-sm text-warning-700">
                  Dev quick login unavailable ({params.devQuickLogin}). Configure DEV_AUTH_PASSWORD to enable it.
                </p>
              )}

              <form action={signInWithMagicLink} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-semantic-muted">Email</label>
                  <Input name="email" type="email" placeholder="you@company.com" required />
                </div>
                <Button type="submit" size="lg" fullWidth>
                  Send Magic Link
                </Button>
              </form>
              </CardBody>
            </Card>

            {process.env.NODE_ENV === "development" && (
              <Card className="mt-5">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-semantic-text">Dev Quick Login</h2>
                  {devQuickLoginConfigured ? (
                    <p className="mt-1 text-sm text-semantic-muted">
                      Development only. Uses `DEV_AUTH_PASSWORD` and redirects to dashboard.
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-semantic-muted">
                      Dev quick login not configured. Set DEV_AUTH_PASSWORD in .env.local to enable.
                    </p>
                  )}
                </CardHeader>
                <CardBody className="space-y-3">
                  <form action={signInWithDevQuickLogin}>
                    <input type="hidden" name="email" value="owner@servicebutler.local" />
                    <Button type="submit" size="lg" fullWidth disabled={!devQuickLoginConfigured}>
                      Login as Owner
                    </Button>
                  </form>
                  <form action={signInWithDevQuickLogin}>
                    <input type="hidden" name="email" value="dispatcher@servicebutler.local" />
                    <Button type="submit" size="lg" variant="secondary" fullWidth disabled={!devQuickLoginConfigured}>
                      Login as Dispatcher
                    </Button>
                  </form>
                  <form action={signInWithDevQuickLogin}>
                    <input type="hidden" name="email" value="tech@servicebutler.local" />
                    <Button type="submit" size="lg" variant="secondary" fullWidth disabled={!devQuickLoginConfigured}>
                      Login as Tech
                    </Button>
                  </form>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
