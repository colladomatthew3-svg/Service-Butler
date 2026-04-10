import { expect, test } from "@playwright/test";
import { resolveV2OwnerUserForTenant } from "../src/lib/v2/context";

function createSupabaseMock(input: {
  accountRoleMatch?: Record<string, unknown> | null;
  membershipMatch?: Record<string, unknown> | null;
  accountRoles?: Array<Record<string, unknown>>;
  memberships?: Array<Record<string, unknown>>;
}) {
  return {
    from(table: string) {
      if (table === "account_roles") {
        return {
          select: () => ({
            eq: (_field1: string, accountId: unknown) => ({
              eq: (_field2: string, userIdOrActive: unknown) => ({
                eq: (_field3: string, isActiveOrUserId: unknown) => ({
                  maybeSingle: async () => {
                    const userId = String(userIdOrActive);
                    const isActive = Boolean(isActiveOrUserId);
                    const row = input.accountRoleMatch;
                    if (!row || !isActive || String(row.account_id || "") !== String(accountId) || String(row.user_id || "") !== userId) {
                      return { data: null, error: null };
                    }
                    return { data: row, error: null };
                  }
                }),
                in: async () => ({ data: input.accountRoles || [], error: null })
              }),
              in: async () => ({ data: input.accountRoles || [], error: null })
            })
          })
        };
      }

      if (table === "v2_tenant_memberships") {
        return {
          select: () => ({
            eq: (_field1: string, tenantId: unknown) => ({
              eq: (_field2: string, userIdOrActive: unknown) => ({
                eq: (_field3: string, isActiveOrUserId: unknown) => ({
                  maybeSingle: async () => {
                    const userId = String(userIdOrActive);
                    const isActive = Boolean(isActiveOrUserId);
                    const row = input.membershipMatch;
                    if (!row || !isActive || String(row.tenant_id || "") !== String(tenantId) || String(row.user_id || "") !== userId) {
                      return { data: null, error: null };
                    }
                    return { data: row, error: null };
                  }
                }),
                in: async () => ({ data: input.memberships || [], error: null })
              }),
              in: async () => ({ data: input.memberships || [], error: null })
            })
          })
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }
  };
}

test("authenticated user with active tenant membership resolves as owner", async () => {
  const resolved = await resolveV2OwnerUserForTenant({
    supabase: createSupabaseMock({
      accountRoleMatch: { account_id: "acct-1", user_id: "user-auth" },
      membershipMatch: { tenant_id: "tenant-1", user_id: "user-auth" }
    }) as never,
    accountId: "acct-1",
    userId: "user-auth",
    franchiseTenantId: "tenant-1"
  });

  expect(resolved).toEqual({
    ownerUserId: "user-auth",
    resolutionSource: "authenticated_user"
  });
});

test("unresolved user returns null when no valid tenant operator exists", async () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousReviewMode = process.env.REVIEW_MODE;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDemoMode = process.env.DEMO_MODE;
  mutableEnv.NODE_ENV = "development";
  mutableEnv.REVIEW_MODE = "on";
  mutableEnv.DEMO_MODE = "off";

  try {
    const resolved = await resolveV2OwnerUserForTenant({
      supabase: createSupabaseMock({ accountRoles: [], memberships: [] }) as never,
      accountId: "acct-1",
      userId: "synthetic-user",
      franchiseTenantId: "tenant-1"
    });

    expect(resolved).toBeNull();
  } finally {
    mutableEnv.REVIEW_MODE = previousReviewMode;
    mutableEnv.NODE_ENV = previousNodeEnv;
    mutableEnv.DEMO_MODE = previousDemoMode;
  }
});

test("review mode resolves a real tenant operator when the synthetic review user is invalid", async () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousReviewMode = process.env.REVIEW_MODE;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDemoMode = process.env.DEMO_MODE;
  mutableEnv.NODE_ENV = "development";
  mutableEnv.REVIEW_MODE = "on";
  mutableEnv.DEMO_MODE = "off";

  try {
    const resolved = await resolveV2OwnerUserForTenant({
      supabase: createSupabaseMock({
        accountRoles: [
          { account_id: "acct-1", user_id: "user-tech", role: "TECH", created_at: "2026-04-10T10:00:00.000Z" },
          { account_id: "acct-1", user_id: "user-owner", role: "ACCOUNT_OWNER", created_at: "2026-04-10T09:00:00.000Z" }
        ],
        memberships: [
          { tenant_id: "tenant-1", user_id: "user-tech", role: "TECH", created_at: "2026-04-10T08:00:00.000Z" },
          { tenant_id: "tenant-1", user_id: "user-owner", role: "FRANCHISE_OWNER", created_at: "2026-04-10T07:00:00.000Z" }
        ]
      }) as never,
      accountId: "acct-1",
      userId: "synthetic-review-user",
      franchiseTenantId: "tenant-1"
    });

    expect(resolved).toEqual({
      ownerUserId: "user-owner",
      resolutionSource: "tenant_operator_fallback"
    });
  } finally {
    mutableEnv.REVIEW_MODE = previousReviewMode;
    mutableEnv.NODE_ENV = previousNodeEnv;
    mutableEnv.DEMO_MODE = previousDemoMode;
  }
});
