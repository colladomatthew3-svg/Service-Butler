import { expect, test } from "@playwright/test";
import { buildIntegrationReadinessSummary } from "../src/lib/control-plane/integration-readiness";
import { getProductionReadinessSummary } from "../src/lib/v2/readiness";

async function withEnv<T>(patch: Record<string, string | undefined>, fn: () => Promise<T>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(patch)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

type NetworkDependencyOverrides = {
  demoMode?: boolean;
  dataSources?: unknown[];
  tenantContext?: { supabase: unknown; franchiseTenantId: string; enterpriseTenantId: string } | null;
  readinessSummary?: { checks: Array<{ key: string; status: string; required?: boolean; message: string; detail?: string }> };
  franchise?: unknown;
  corporate?: unknown;
};

async function withPatchedNetworkPageDeps<T>(
  overrides: NetworkDependencyOverrides,
  fn: (load: typeof import("../src/app/(dashboard)/dashboard/network/view-model").loadNetworkViewModel) => Promise<T>
) {
  const reviewModeModule = require("../src/lib/services/review-mode") as {
    isDemoMode: () => boolean;
  };
  const dataSourcesModule = require("../src/lib/control-plane/data-sources") as {
    listDataSourceSummaries: (...args: unknown[]) => Promise<unknown[]>;
  };
  const contextModule = require("../src/lib/v2/context") as {
    getV2TenantContext: () => Promise<unknown>;
  };
  const readinessModule = require("../src/lib/v2/readiness") as {
    getProductionReadinessSummary: () => Promise<unknown>;
  };
  const readModelsModule = require("../src/lib/v2/dashboard-read-models") as {
    getFranchiseDashboardReadModel: () => Promise<unknown>;
    getCorporateDashboardReadModel: () => Promise<unknown>;
  };

  const originals = {
    isDemoMode: reviewModeModule.isDemoMode,
    listDataSourceSummaries: dataSourcesModule.listDataSourceSummaries,
    getV2TenantContext: contextModule.getV2TenantContext,
    getProductionReadinessSummary: readinessModule.getProductionReadinessSummary,
    getFranchiseDashboardReadModel: readModelsModule.getFranchiseDashboardReadModel,
    getCorporateDashboardReadModel: readModelsModule.getCorporateDashboardReadModel
  };

  reviewModeModule.isDemoMode = () => overrides.demoMode ?? false;
  dataSourcesModule.listDataSourceSummaries = async () => (overrides.dataSources || []) as unknown[];
  contextModule.getV2TenantContext = async () => overrides.tenantContext ?? null;
  readinessModule.getProductionReadinessSummary = async () =>
    (overrides.readinessSummary || {
      checks: []
    }) as unknown;
  readModelsModule.getFranchiseDashboardReadModel = async () => overrides.franchise ?? null;
  readModelsModule.getCorporateDashboardReadModel = async () => overrides.corporate ?? null;

  const viewModelPath = require.resolve("../src/app/(dashboard)/dashboard/network/view-model");
  delete require.cache[viewModelPath];

  try {
    const viewModelModule = require(viewModelPath) as typeof import("../src/app/(dashboard)/dashboard/network/view-model");
    return await fn(viewModelModule.loadNetworkViewModel);
  } finally {
    reviewModeModule.isDemoMode = originals.isDemoMode;
    dataSourcesModule.listDataSourceSummaries = originals.listDataSourceSummaries;
    contextModule.getV2TenantContext = originals.getV2TenantContext;
    readinessModule.getProductionReadinessSummary = originals.getProductionReadinessSummary;
    readModelsModule.getFranchiseDashboardReadModel = originals.getFranchiseDashboardReadModel;
    readModelsModule.getCorporateDashboardReadModel = originals.getCorporateDashboardReadModel;
    delete require.cache[viewModelPath];
  }
}

test("dashboard exposes inline source readiness", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: /operator command center/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /live ingestion snapshot/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /open data sources/i })).toBeVisible();
  await expect(page.getByText(/normal operator view stays blocked until live sources/i)).toBeVisible();
});

test("settings exposes the production truth control plane", async ({ page }) => {
  await page.goto("/dashboard/settings");

  await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /restoration intelligence control plane/i }).first()).toBeVisible();
  await expect(page.getByText(/operators can add, inspect, test, and run sources here/i)).toBeVisible();
});

test("network readiness fails closed when tenant context is unavailable", async () => {
  await withEnv(
    {
      NEXT_PUBLIC_APP_URL: "https://service-butler.test",
      SB_USE_V2_READS: "false",
      SB_USE_V2_WRITES: "false",
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      WEBHOOK_SHARED_SECRET: undefined
    },
    async () => {
      const summary = await getProductionReadinessSummary({ supabase: null });

      expect(summary.status).toBe("fail");
      expect(summary.tenant).toBeNull();
      expect(summary.checks.some((check) => check.key === "supabase_client" && check.status === "warn")).toBeTruthy();
      expect(summary.checks.some((check) => check.key === "v2_flags" && check.status === "fail")).toBeTruthy();
    }
  );
});

test("integration readiness exposes inline tenant-not-live warnings", async () => {
  const summary = await buildIntegrationReadinessSummary();

  const warnKeys = summary.checks
    .filter((check) => check.status === "warn")
    .map((check) => check.name)
    .filter(Boolean);

  expect(warnKeys).toContain("territories");
  expect(warnKeys).toContain("data_sources");
  expect(warnKeys).toContain("service_area");
});

test("network proof stays blocked in demo mode and returns explicit remediation instead of buyer proof", async () => {
  await withPatchedNetworkPageDeps(
    {
      demoMode: true,
      dataSources: []
    },
    async (loadNetworkViewModel) => {
      const viewModel = await loadNetworkViewModel();

      expect(viewModel.viewState).toBe("blocked");
      expect(viewModel.demoMode).toBeFalsy();
      expect(viewModel.franchise).toBeNull();
      expect(viewModel.corporate).toBeNull();
      expect(viewModel.readiness?.reason).toContain("disabled in demo mode");
      expect(viewModel.readiness?.recommendedActions).toContain(
        "Switch to a tenant-mapped live environment before using the network proof view."
      );
    }
  );
});

test("network proof stays blocked when live context is missing and never falls back to synthetic buyer proof", async () => {
  await withPatchedNetworkPageDeps(
    {
      demoMode: false,
      tenantContext: null
    },
    async (loadNetworkViewModel) => {
      const viewModel = await loadNetworkViewModel();

      expect(viewModel.viewState).toBe("blocked");
      expect(viewModel.franchise).toBeNull();
      expect(viewModel.corporate).toBeNull();
      expect(viewModel.readiness?.reason).toContain("No live tenant context");
      expect(viewModel.readiness?.recommendedActions).toContain(
        "Sign in with a tenant-mapped live account instead of falling back to demo proof."
      );
    }
  );
});

test("network proof stays blocked in compat readiness failures and returns remediation instead of proof data", async () => {
  await withPatchedNetworkPageDeps(
    {
      demoMode: false,
      tenantContext: {
        supabase: {},
        franchiseTenantId: "tenant-1",
        enterpriseTenantId: "enterprise-1"
      },
      dataSources: [{ id: "source-1" }],
      readinessSummary: {
        checks: [
          {
            key: "active_data_sources",
            required: true,
            status: "fail",
            message: "No live-safe data sources are active.",
            detail: "Activate at least one compliant source before buyer proof."
          }
        ]
      }
    },
    async (loadNetworkViewModel) => {
      const viewModel = await loadNetworkViewModel();

      expect(viewModel.viewState).toBe("blocked");
      expect(viewModel.franchise).toBeNull();
      expect(viewModel.corporate).toBeNull();
      expect(viewModel.dataSources).toHaveLength(1);
      expect(viewModel.readiness?.reason).toContain("blocked until tenant readiness");
      expect(viewModel.readiness?.recommendedActions).toContain(
        "Configure at least one active, live-safe data source for the tenant."
      );
    }
  );
});

test("network overview renders the buyer proof surface", async ({ page }) => {
  await page.goto("/dashboard/network");

  await expect(page.getByRole("heading", { name: /network overview/i })).toBeVisible();
  const blockedHeading = page.getByRole("heading", { name: /this environment is not live enough to show buyer-proof metrics/i });
  if (await blockedHeading.isVisible().catch(() => false)) {
    await expect(page.getByText(/blocked proof/i)).toBeVisible();
    await expect(page.getByText(/buyer proof blocked/i)).toBeVisible();
    await expect(page.getByText(/remediation/i)).toBeVisible();
    await expect(page.getByText(/review data sources/i)).toBeVisible();
    await expect(page.getByText(/open operator view/i)).toBeVisible();
    await expect(page.getByText(/live proof/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /lead quality by source/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /contactable lead evidence/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /why this can sell to a buyer/i })).toHaveCount(0);
  } else {
    await expect(page.getByRole("heading", { name: /lead quality by source/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /active source status/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /contactable lead evidence/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /signals, opportunities, and leads are counted separately/i })).toBeVisible();
    await expect(page.getByText(/public-source opportunities are market pressure signals/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /why this can sell to a buyer/i })).toBeVisible();
  }
  await expect(page.getByText(/storm-triggered homeowner lead verified by phone/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /review data sources/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /open operator view/i })).toBeVisible();
});

test("dashboard read-model endpoints expose the buyer network surface", async ({ request }) => {
  const franchiseResponse = await request.get("/api/dashboard/franchise");
  expect(franchiseResponse.ok()).toBeTruthy();

  const franchise = (await franchiseResponse.json()) as Record<string, unknown>;
  expect(franchise).toHaveProperty("metrics");
  expect(Array.isArray(franchise.metrics)).toBeTruthy();
  expect(franchise).toHaveProperty("lead_quality_proof");

  const corporateResponse = await request.get("/api/dashboard/corporate");
  expect(corporateResponse.ok()).toBeTruthy();

  const corporate = (await corporateResponse.json()) as Record<string, unknown>;
  expect(corporate).toHaveProperty("metrics");
  expect(Array.isArray(corporate.metrics)).toBeTruthy();
  expect(corporate).toHaveProperty("byFranchise");
});
