import { expect, test } from "@playwright/test";
import type { Page, Route } from "playwright";

type Lead = {
  id: string;
  created_at: string;
  status: string;
  name: string;
  phone: string;
  service_type: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  requested_timeframe: string;
  source: string;
  notes: string | null;
  scheduled_for: string | null;
  converted_job_id?: string | null;
  intentScore?: number;
  signalCount?: number;
};

type Job = {
  id: string;
  lead_id: string;
  pipeline_status: "NEW" | "CONTACTED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "WON" | "LOST";
  scheduled_for: string | null;
  service_type: string;
  assigned_tech_name: string | null;
  estimated_value: number;
  notes: string | null;
  intent_score: number;
  customer_name: string;
  customer_phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  created_at: string;
};

async function json(route: Route, payload: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload)
  });
}

async function stubLeadToScheduleFlow(page: Page) {
  const leadId = "lead-smoke-001";
  const jobId = "job-smoke-001";
  const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const lead: Lead = {
    id: leadId,
    created_at: new Date().toISOString(),
    status: "new",
    name: "Pat Riley",
    phone: "+15165550123",
    service_type: "Water Damage",
    address: "123 Main St",
    city: "Huntington",
    state: "NY",
    postal_code: "11743",
    requested_timeframe: "ASAP",
    source: "demo",
    notes: "Smoke test lead",
    scheduled_for: null,
    converted_job_id: null,
    intentScore: 88,
    signalCount: 2
  };

  const job: Job = {
    id: jobId,
    lead_id: leadId,
    pipeline_status: "NEW",
    scheduled_for: null,
    service_type: lead.service_type,
    assigned_tech_name: null,
    estimated_value: 2500,
    notes: "Insurance pending",
    intent_score: 88,
    customer_name: lead.name,
    customer_phone: lead.phone,
    address: lead.address,
    city: lead.city,
    state: lead.state,
    postal_code: lead.postal_code,
    created_at: new Date().toISOString()
  };

  await page.route("**/api/leads?**", async (route) => {
    await json(route, { leads: [lead], counts: { all: 1, new: 1 } });
  });

  await page.route(`**/api/leads/${leadId}`, async (route) => {
    if (route.request().method() === "GET") {
      await json(route, { lead, signals: [] });
      return;
    }

    if (route.request().method() === "PATCH") {
      const patch = (await route.request().postDataJSON().catch(() => ({}))) as Partial<Lead>;
      Object.assign(lead, patch);
      await json(route, { lead });
      return;
    }

    await route.fallback();
  });

  await page.route(`**/api/leads/${leadId}/convert`, async (route) => {
    lead.converted_job_id = jobId;
    lead.status = "scheduled";
    lead.scheduled_for = scheduledFor;
    job.pipeline_status = "SCHEDULED";
    job.scheduled_for = scheduledFor;
    await json(route, { jobId, leadId, created: true });
  });

  await page.route(`**/api/jobs/${jobId}`, async (route) => {
    if (route.request().method() === "GET") {
      await json(route, { job, signals: [] });
      return;
    }

    if (route.request().method() === "PATCH") {
      const patch = (await route.request().postDataJSON().catch(() => ({}))) as Partial<Job>;
      Object.assign(job, patch);
      await json(route, { job });
      return;
    }

    await route.fallback();
  });

  return { leadId, jobId };
}

test("demo smoke: dashboard to lead conversion and scheduling", async ({ page }) => {
  const { leadId, jobId } = await stubLeadToScheduleFlow(page);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "Leads" }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/leads/);

  await expect(page.getByRole("heading", { name: "Lead Inbox" })).toBeVisible();
  await page.getByRole("link", { name: /Pat Riley/i }).first().click();

  await expect(page).toHaveURL(new RegExp(`/dashboard/leads/${leadId}$`));
  await expect(page.getByRole("button", { name: /Convert to Job|Open Job/i })).toBeVisible();

  await page.getByRole("button", { name: /Convert to Job|Open Job/i }).first().click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/jobs/${jobId}$`));

  await expect(page.getByRole("heading", { name: /Pat Riley/i })).toBeVisible();
  await page.getByRole("button", { name: /Mark Scheduled/i }).click();

  await page.getByRole("link", { name: "Schedule" }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/schedule/);
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
});
