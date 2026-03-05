# Product Critique v1

Context: Evaluated local app on March 4, 2026 (NY timezone) across `/`, `/login`, `/__review`, `/dashboard`, `/dashboard/leads`, `/dashboard/leads/30000000-0000-0000-0000-000000000001`, `/dashboard/scanner`, `/dashboard/pipeline`, `/dashboard/jobs/70000000-0000-0000-0000-000000000001`, `/dashboard/schedule`, `/dashboard/settings`.

## Top 15 Issues (ranked by demo impact)

### 1) P0 — `/__review` route is missing (404)
- What user sees: Direct 404 when trying to open review hub.
- Why it is bad: Demo facilitator has no single guided launch surface; first impression feels broken.
- Exact fix suggestion: Add `src/app/__review/page.tsx` with big buttons to all key routes and live status chips.
- Acceptance criteria:
  - `GET /__review` returns 200.
  - Page includes links to dashboard, leads, scanner, pipeline, jobs, schedule, settings.
  - Includes troubleshooting note for auth/demo mode.

### 2) P0 — Lead demo deep link ID returns 404
- What user sees: `/dashboard/leads/30000000-0000-0000-0000-000000000001` shows Next 404.
- Why it is bad: Scripted demo breaks in under 30 seconds and loses trust.
- Exact fix suggestion: If lead ID is missing, render friendly in-app fallback with “Open Inbox” and “Open first available lead”.
- Acceptance criteria:
  - Missing lead ID does not render framework 404 page.
  - User gets clear recovery CTA to continue demo.

### 3) P0 — Job demo deep link ID returns 404
- What user sees: `/dashboard/jobs/70000000-0000-0000-0000-000000000001` shows 404.
- Why it is bad: Jobs-first story collapses; owner thinks data/model is unstable.
- Exact fix suggestion: Add in-page missing-job state with CTA to jobs board and first job when available.
- Acceptance criteria:
  - Missing job ID shows recoverable in-app state.
  - No raw 404 for this route in demo mode.

### 4) P0 — Scanner feed errors when `scanner_events` table is absent
- What user sees: Toast/console errors (`Could not find table public.scanner_events`).
- Why it is bad: “Opportunity Scanner” is the wow loop; errors make it feel fake and brittle.
- Exact fix suggestion: In scanner events API, gracefully fallback to in-memory/demo output if table missing.
- Acceptance criteria:
  - Scan action returns results without hard error even if scanner tables are absent.
  - UI shows non-blocking fallback note.

### 5) P0 — Routing rules tab errors when `routing_rules` not present
- What user sees: `/api/routing-rules` returns 400 during scanner page load.
- Why it is bad: Half the scanner UI appears broken before first value moment.
- Exact fix suggestion: Add safe empty fallback + setup hint in API/UI.
- Acceptance criteria:
  - Routing Rules tab loads with empty-state guidance, not API error.
  - No blocking errors for missing table path.

### 6) P1 — Dashboard shows all zeros by default with weak “do this now” guidance
- What user sees: KPI strip all zeros and many empty sections.
- Why it is bad: Users assume product has no data or no value.
- Exact fix suggestion: Add a single “First 60 seconds” checklist card with 3 clear actions.
- Acceptance criteria:
  - Dashboard presents a primary checklist when no leads/jobs exist.
  - Each checklist step deep-links to action route.

### 7) P1 — Duplicate/competing action sections on dashboard
- What user sees: Multiple CTA clusters (hero buttons + quick actions + next actions) with overlap.
- Why it is bad: Cognitive load; unclear what to click first.
- Exact fix suggestion: Consolidate into one primary CTA row and one secondary “Next Up” module.
- Acceptance criteria:
  - Only one primary CTA cluster above the fold.
  - CTA order follows demo narrative: Scanner → Leads → Pipeline.

### 8) P1 — Mobile nav opens in a confusing state
- What user sees: Sidebar/nav and header controls can appear simultaneously; visual clutter.
- Why it is bad: Mobile dispatcher flow feels unstable and hard to scan.
- Exact fix suggestion: Ensure mobile drawer defaults closed and overlay state is deterministic on route change.
- Acceptance criteria:
  - On mobile first load, drawer is closed.
  - Route transitions close drawer reliably.

### 9) P1 — Login page shows disabled dev quick login without clear path forward
- What user sees: Disabled quick login buttons and env instruction text.
- Why it is bad: Non-technical beta user can’t proceed quickly.
- Exact fix suggestion: Add one-click “Open demo mode instructions” link + route to `/__review` when available.
- Acceptance criteria:
  - Login includes clear next step when quick login disabled.
  - No dead-end state for evaluator.

### 10) P1 — Scanner result provenance is still too thin for trust
- What user sees: Source label exists, but no evidence snippet or extraction confidence explanation.
- Why it is bad: Owners question if opportunities are real or random.
- Exact fix suggestion: Add compact “Evidence” line (keyword match + location mention + time signal) per card.
- Acceptance criteria:
  - Every scanner card includes evidence text and confidence reason.
  - Preview panel shows extracted signal rationale.

### 11) P2 — Legacy nav links dilute story (`Legacy Pipeline`, `/pipeline`, `/billing`)
- What user sees: Multiple old/new paths and non-core links in sidebar.
- Why it is bad: Product feels stitched together.
- Exact fix suggestion: Move legacy links into settings or hide during demo mode.
- Acceptance criteria:
  - Primary nav only contains current core workflow routes.

### 12) P2 — Jobs board empty state lacks immediate action options
- What user sees: “No jobs yet” text only.
- Why it is bad: User has to guess next click.
- Exact fix suggestion: Add two big buttons: “Convert a Lead” and “Create Job from Scanner”.
- Acceptance criteria:
  - Empty jobs state includes direct actions.

### 13) P2 — Schedule empty state not tied to live next action
- What user sees: Generic “open lead inbox” text.
- Why it is bad: Doesn’t drive booking behavior.
- Exact fix suggestion: Include “Schedule first lead now” deep-link to first unscheduled lead.
- Acceptance criteria:
  - Empty schedule state includes one-click route to actionable lead.

### 14) P2 — Settings page mixes strategic and operational controls in one long column
- What user sees: Business profile, dispatch, weather, integrations in a long stack.
- Why it is bad: Hard to prioritize setup sequence.
- Exact fix suggestion: Split into sections with step numbering (1 profile, 2 dispatch, 3 weather, 4 integrations).
- Acceptance criteria:
  - Settings has clear setup order and section anchors.

### 15) P2 — Marketing promises are strong but local proof for NYC/LI is missing
- What user sees: Generic testimonial geos and generic claims.
- Why it is bad: Target contractors in NYC/Long Island want territory relevance.
- Exact fix suggestion: Add local proof strip (zip seeds + category demand examples) on homepage.
- Acceptance criteria:
  - Homepage includes LI/NYC-specific demand examples.

## 3-minute Demo Script (exact clicks + narration)
1. Open `/dashboard`.
   - Say: “This is the dispatch home. In one screen you see jobs, urgency, and what to do next.”
2. Click **Run Scanner**.
   - Say: “Scanner listens for job opportunities in your service area.”
3. On `/dashboard/scanner`, keep ZIP `11788`, mode `DEMO`, campaign `Restoration`, click **Scan Now**.
   - Say: “We score intent and confidence, so your team calls the best opportunities first.”
4. Open one result **Preview**.
   - Say: “Here’s why we detected this: location, urgency keywords, and recommended action.”
5. Click **Add as Lead** on one card.
   - Say: “One click routes into your lead inbox.”
6. Click **Add as Job (scheduled)** on another card.
   - Say: “If urgency is high, we can route straight to pipeline as a scheduled job.”
7. Go to `/dashboard/leads`, open the new lead.
   - Say: “Dispatch has instant call/text/schedule actions with intent context.”
8. Convert lead to job and set schedule.
   - Say: “Lead-to-job handoff takes seconds, not minutes.”
9. Go to `/dashboard/pipeline`.
   - Say: “Now operations can move this job through stages with full visibility.”
10. End on `/dashboard/schedule`.
   - Say: “This keeps your day full and your team aligned.”

## Trust Signals (what makes it feel real vs fake)
### Feels real now
- Consistent jobs-first nav and action labels (Scanner, Leads, Pipeline, Jobs).
- Scanner includes intent score, confidence, category, location, and dispatch actions.
- Tel/SMS quick actions align with field workflow.
- Weather + operational impact framing is present.

### Feels fake today
- 404s on scripted lead/job deep links.
- Missing `/__review` onboarding hub.
- Scanner/routing APIs hard-fail when local scanner tables are absent.
- Zero-data screens without guided activation checklist.
- Evidence/provenance in scanner cards is not explicit enough for owner trust.
