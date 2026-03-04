import { signInWithDevQuickLogin, signInWithMagicLink } from "@/actions/auth";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ sent?: string; membership?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="container py-16">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Logo variant="full" size={44} />
          </Link>
        </div>
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-semibold text-semantic-text">Sign in</h1>
            <p className="mt-1 text-sm text-semantic-muted">Use your work email to get a secure magic link.</p>
          </CardHeader>
          <CardBody>
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
              <p className="mt-1 text-sm text-semantic-muted">
                Development only. Uses `DEV_AUTH_PASSWORD` and redirects to dashboard.
              </p>
            </CardHeader>
            <CardBody className="space-y-3">
              <form action={signInWithDevQuickLogin}>
                <input type="hidden" name="email" value="owner@servicebutler.local" />
                <Button type="submit" size="lg" fullWidth>
                  Login as Owner
                </Button>
              </form>
              <form action={signInWithDevQuickLogin}>
                <input type="hidden" name="email" value="dispatcher@servicebutler.local" />
                <Button type="submit" size="lg" variant="secondary" fullWidth>
                  Login as Dispatcher
                </Button>
              </form>
              <form action={signInWithDevQuickLogin}>
                <input type="hidden" name="email" value="tech@servicebutler.local" />
                <Button type="submit" size="lg" variant="secondary" fullWidth>
                  Login as Tech
                </Button>
              </form>
            </CardBody>
          </Card>
        )}
      </div>
    </main>
  );
}
