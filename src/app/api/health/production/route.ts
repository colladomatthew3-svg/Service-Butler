/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProductionReadinessSummary } from "@/lib/v2/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const supabase =
    supabaseUrl && serviceRole
      ? createClient(supabaseUrl, serviceRole, {
          auth: { autoRefreshToken: false, persistSession: false }
        })
      : null;

  const summary = await getProductionReadinessSummary({ supabase });
  const hasFailure = summary.checks.some((check) => check.required && check.status === "fail");
  const hasWarning = summary.checks.some((check) => check.status === "warn");

  return NextResponse.json(
    {
      status: summary.status,
      checkedAt: summary.checkedAt,
      passCount: summary.passCount,
      warnCount: summary.warnCount,
      failCount: summary.failCount,
      checks: summary.checks,
      integrationReadiness: summary.integrationReadiness,
      tenant: summary.tenant
    },
    {
      status: hasFailure ? 503 : hasWarning ? 200 : 200,
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}
