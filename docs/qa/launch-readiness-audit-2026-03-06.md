# Service Butler Launch Readiness Audit (QA)

Date: 2026-03-06  
Branch: `agent/qa-audit-launch-readiness`  
Mode tested: `DEMO_MODE=true` local dev server on port 3000

## Scope audited
Homepage → Demo login → Weather setup → Scanner → Opportunity → Lead → Schedule / Pipeline

## Environment notes
- GitHub CLI is not installed in this environment (`gh` unavailable), and no GitHub API token is set.
- As a fallback, issue-ready drafts are included under `docs/qa/github-issue-drafts/` for copy/paste into GitHub.

---

## P0 — Launch blockers

### 1) Schedule page hard-crashes in demo flow (`/dashboard/schedule`)
**Why it matters**  
Schedule is a launch-critical destination in the demo storyline. The route currently renders a blank/failed page and throws a server error, which would fail customer or investor demos.

**Reproduction steps**
1. Start app in demo mode: `DEMO_MODE=true npm run dev -- --port 3000`
2. Open `/login`
3. Click **Demo Login**
4. Go to `/dashboard/schedule`
5. Observe blank error state and server-side `500`.

**Recommended fix**
- Update schedule page data loading to support demo mode (`supabase` is null in demo context).
- Gate DB calls behind demo-mode fixtures or provide a demo-safe repository layer.
- Add an integration test for `/dashboard/schedule` under demo mode.

---

### 2) Leads and Jobs APIs return 500 in demo mode, breaking downstream dashboard flows
**Why it matters**  
Lead and pipeline progression depends on these APIs. Failures prevent a coherent journey from scanner output to lead/pipeline execution.

**Reproduction steps**
1. Start app with `DEMO_MODE=true`.
2. Visit `/dashboard/leads` and `/dashboard/pipeline`.
3. Observe failing network calls:
   - `GET /api/leads` → 500
   - `GET /api/jobs` → 500
4. Server logs show `Cannot read properties of null (reading 'from')` from `supabase.from(...)`.

**Recommended fix**
- Make `/api/leads` and `/api/jobs` demo-aware by using demo data store when `isDemoMode()` is true.
- Add smoke coverage for these APIs in demo mode.
- Return user-safe fallback payloads (non-500) when data source is unavailable.

---

## P1 — Should fix before launch

### 3) Weather setup section in Settings remains in skeleton/placeholder state
**Why it matters**  
Weather setup is part of the core differentiation story. If it appears unfinished during demo, product credibility drops.

**Reproduction steps**
1. Demo login.
2. Navigate to `/dashboard/settings`.
3. Scroll to **Weather Preferences**.
4. Observe persistent skeleton placeholders instead of editable weather controls.

**Recommended fix**
- Ensure weather settings form renders in demo mode with seeded values.
- Provide save confirmation and retry/error handling if API fails.

---

### 4) Lead and Pipeline empty states are non-instructional (skeleton-only feel)
**Why it matters**  
When no records are present, users need guidance to continue journey. Current placeholders look like loading state rather than meaningful empty state, weakening clarity.

**Reproduction steps**
1. Demo login.
2. Open `/dashboard/leads` or `/dashboard/pipeline`.
3. Observe large skeleton blocks with no explicit next-action guidance.

**Recommended fix**
- Replace indefinite skeletons with explicit empty-state cards:
  - “No leads yet — run scanner” (CTA)
  - “No jobs in pipeline — convert top opportunities” (CTA)
- Add context text explaining what to do next in the workflow.

---

### 5) Hydration mismatch errors appear in core dashboard pages
**Why it matters**  
Hydration mismatch warnings in launch-critical pages signal rendering instability and can produce subtle UX defects.

**Reproduction steps**
1. Demo login.
2. Navigate among `/dashboard/settings`, `/dashboard/pipeline`, `/dashboard/leads`.
3. Observe browser console hydration mismatch warning traces.

**Recommended fix**
- Audit client/server divergence for input styles and dynamic props.
- Remove non-deterministic server/client render paths.
- Add CI check that fails on hydration errors in smoke flows.

---

## P2 — Polish

### 6) Mobile dashboard header is oversized and pushes critical content below fold
**Why it matters**  
On mobile, oversized brand block/header decreases immediate visibility of scanner actions.

**Reproduction steps**
1. Open `/dashboard/scanner` on mobile viewport (390x844).
2. Observe large header/logo stack before primary scanner controls.

**Recommended fix**
- Reduce mobile logo/header vertical space.
- Promote scanner primary CTA and active queue preview higher in viewport.

