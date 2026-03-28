"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global UI error", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
      <div className="rounded-2xl border border-warning-300 bg-warning-50 px-4 py-2 text-warning-900">
        <AlertTriangle className="mx-auto h-5 w-5" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-semantic-text">Something went wrong</h1>
      <p className="mt-2 max-w-xl text-sm text-semantic-muted">
        We hit an unexpected issue while rendering this page. You can retry immediately or return to the dashboard.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Retry</Button>
        <Link href="/dashboard">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
