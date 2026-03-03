import { signInWithMagicLink } from "@/actions/auth";
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
            <Logo variant="lockup" size={44} />
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
      </div>
    </main>
  );
}
