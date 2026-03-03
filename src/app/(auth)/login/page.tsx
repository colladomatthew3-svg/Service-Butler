import { signInWithMagicLink } from "@/actions/auth";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ sent?: string; membership?: string }>;
}) {
  const params = await searchParams;

  return (
    <main>
      <div className="panel" style={{ maxWidth: 480, margin: "80px auto" }}>
        <h1>ServiceButler.ai</h1>
        <p>Sign in with your email.</p>

        {params.membership === "required" && (
          <p style={{ color: "#b22222" }}>
            Your user does not have an active account membership. Seed users or assign an account role first.
          </p>
        )}

        {params.sent === "1" && <p style={{ color: "#0a7f5a" }}>Magic link sent. Check your inbox.</p>}

        <form action={signInWithMagicLink}>
          <input name="email" type="email" placeholder="you@company.com" required style={{ width: "100%", marginBottom: 10 }} />
          <button type="submit">Send Magic Link</button>
        </form>
      </div>
    </main>
  );
}
