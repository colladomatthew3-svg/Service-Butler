import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Marketing Homepage" },
  { href: "/login", label: "Login" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/leads", label: "Lead Inbox" },
  { href: "/dashboard/scanner", label: "Scanner" },
  { href: "/dashboard/pipeline", label: "Pipeline" },
  { href: "/dashboard/jobs", label: "Jobs" },
  { href: "/dashboard/schedule", label: "Schedule" },
  { href: "/dashboard/settings", label: "Settings" }
];

export default function ReviewHubPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold text-semantic-text">ServiceButler Review Hub</h1>
          <p className="mt-1 text-sm text-semantic-muted">
            One place to click through core demo routes without guessing where to start.
          </p>
        </CardHeader>
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button size="lg" fullWidth>
                {link.label}
              </Button>
            </Link>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-semantic-text">Troubleshooting</h2>
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-semantic-muted">
          <p>If dashboard routes redirect to login, enable local demo/review mode in <code>.env.local</code> and restart dev server.</p>
          <p>Recommended quick start: <code>npm run review</code>.</p>
        </CardBody>
      </Card>
    </main>
  );
}
