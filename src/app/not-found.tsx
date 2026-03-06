import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-6 py-16">
      <Card className="w-full">
        <CardBody className="space-y-4 py-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-muted">Page not found</p>
          <h1 className="marketing-hero text-semantic-text">That page is not in your dispatch flow.</h1>
          <p className="mx-auto max-w-xl text-semantic-muted">
            Return to the homepage or open the demo dashboard to continue weather setup, opportunity scanning, and job scheduling.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/">
              <Button size="lg">Back to Homepage</Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="secondary">Open Dashboard</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}
