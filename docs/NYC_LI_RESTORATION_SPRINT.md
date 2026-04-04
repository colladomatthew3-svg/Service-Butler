# NYC + Long Island Restoration Sprint

## Objective

Turn Service Butler into a buyer-safe, operator-usable restoration lead engine for NYC + Long Island with real public-signal capture, explicit qualification, and traceable proof.

## Trust Rules

- No synthetic or demo records on operator routes, including dashboard, scanner, opportunities, settings, and network.
- Verified contact is required before any opportunity becomes a lead.
- Research-only public signals must stay in scanner or SDR until qualification is complete.
- Every operator-visible opportunity must preserve source provenance, freshness, and compliance status.
- Buyer-proof metrics only count qualified, traceable, non-synthetic chains from source event to booked job.

## Milestones

### Milestone 1: Operator Trust Lockdown
- Remove synthetic/demo operator data from dashboard, opportunities, scanner, settings, and network.
- Fail closed with explicit blocked or empty states when live data is absent.
- Keep buyer-proof surfaces live-only outside isolated review flows.

### Milestone 2: Tier 1 Restoration Signals
- Harden NOAA, Open311, USGS water, OpenFEMA, and public incidents as the primary emergency signal stack.
- Preserve source provenance and restoration-family classification through scanner and opportunities.
- Keep incident/social feeds blocked unless live config and terms are present.

### Milestone 3: Qualification And Conversion
- Keep opportunities as the canonical external-signal queue.
- Route research-only and queued signals into SDR.
- Only allow verified-contact opportunities into lead and buyer-flow paths.
- Track proof chain strictly from source event to booked job.

### Milestone 4: Restoration Taxonomy
- Standardize source families for:
  - 311
  - flood
  - fire
  - outage
  - weather
  - mold_biohazard
  - permits
  - property
  - distress/social
- Treat mold and biohazard as real classifications sourced from public incidents, 311, permits, or page feeds, not fabricated providers.

### Milestone 5: Buyer Proof And Eligibility
- Show connector eligibility for NYC + Long Island as:
  - live and capturing
  - compliance-gated
  - needs provider
  - blocked
- Keep proof surfaces focused on real source events, real opportunities, SDR-qualified opportunities, verified leads, and booked jobs.

## Tier 1 / Tier 2 Source Plan

| Tier | Source families | What they are for | Qualification path | Fail-closed truth |
| --- | --- | --- | --- | --- |
| Tier 1 | NOAA weather, NYC Open311, USGS water, OpenFEMA, approved public incidents via Firecrawl or feed | Primary emergency-demand intake for flood, fire, outage, weather, and municipal restoration signals | `sdr` by default for public-source opportunities | If a source is simulated, sample-backed, off-market, missing terms, or missing Firecrawl page config, it stays blocked or research-only and cannot count in operator throughput or buyer proof. |
| Tier 2 | Overpass, Census, social or public distress, permits | Supplemental context, enrichment, or provider-dependent depth | `sdr` | These sources can support prioritization and qualification, but they do not justify live lead claims on their own. Permits remain provider-dependent; social and public distress remain blocked until real approved config exists. |

## Classification-First Truth

- Mold and biohazard are classification outputs, not standalone free public homeowner-contact providers.
- The product should classify mold or biohazard risk from:
  - 311 complaints
  - public incident pages
  - public distress pages
  - permits only when a real provider exists
- The product should not imply a dedicated live mold or biohazard feed where only classification logic exists.
- Classification-first truth still requires verified contact before lead creation.

## Two-Week Autonomous Execution Backlog

### Day 1: Operator-route trust lockdown
- Remove any remaining synthetic fallback rendering from dashboard, scanner, opportunities, and network.
- Make blocked or empty states explicit when live tenant context, source events, or opportunities are missing.
- Verify that no operator route silently falls back to demo content outside explicit demo mode.

Acceptance criteria:
- `/dashboard`, `/dashboard/scanner`, `/dashboard/opportunities`, and `/dashboard/network` show blocked or empty states instead of synthetic records.
- No buyer-facing metric counts synthetic/demo rows.
- Regression coverage exists for blocked live mode on network and empty live mode on opportunities or scanner.

### Day 2: Scanner opportunity truth model
- Make scanner the source-of-truth queue for 311, fire, flood, outage, weather, permit, property, and public distress signals.
- Persist explicit qualification fields on scanner results and downstream opportunities.
- Ensure every scanner row exposes one valid next action: review, send to SDR, or route to buyer flow only after qualification.

Acceptance criteria:
- Scanner responses include qualification state, proof authenticity, and next recommended action.
- Research-only records cannot create leads or jobs directly.
- Operator UI shows the blocked reason inline for non-contactable public signals.

### Day 3: Firecrawl production path for page-based sources
- Finish page-based ingestion for public incident and distress sources where no free structured API exists.
- Preserve scraped page URL as source provenance through source event, opportunity, and proof surfaces.
- Fail closed when Firecrawl is requested without URLs or credentials.

Acceptance criteria:
- Firecrawl-backed incident and distress connectors create normalized source events with page URL provenance.
- Data Sources UI shows `not_live_in_environment` or equivalent readiness when Firecrawl is configured incorrectly.
- Automated coverage exists for Firecrawl incident flow into operator-visible opportunities.

### Day 4: Free-source restoration signal stack
- Harden the NYC + Long Island free-source stack:
  - NOAA weather
  - Open311
  - USGS water
  - OpenFEMA
  - public incident pages
  - Overpass/property context
- Verify restoration-family mapping for flood, fire, outage, and mold or biohazard-adjacent municipal signals.

Acceptance criteria:
- Each Tier 1 source has explicit runtime mode, terms status, compliance status, and buyer-readiness note.
- Flood, fire, outage, and property-related signals land in the correct opportunity lane.
- No unsupported source is shown as live.

### Day 5: Opportunities lane for emergency demand
- Make the opportunities page the operator’s working index for 311, fire, flood, outage, weather, permit, property, and distress signals.
- Ensure source-lane filters match actual opportunity metadata instead of ambiguous copy.
- Add direct workflow links from opportunity row to the relevant scanner or SDR state.

Acceptance criteria:
- Operators can filter opportunities by source family without losing qualification context.
- Every opportunity row links to an actionable workflow, not just a generic page.
- Dashboard “Opportunities to work first” matches the same prioritization model as the opportunities page.

### Day 6: Verified-contact throughput gate
- Lock lead creation behind verified contact for all public-source opportunities.
- Standardize verified-contact provenance fields used by SDR and proof.
- Make rejected and queued-for-SDR states visible across scanner, opportunities, and buyer proof.

Acceptance criteria:
- No public-source opportunity can create a lead without verified phone or email plus qualification provenance.
- Qualification records store contact name, channel, verification status, qualification source, notes, qualified_at, and qualified_by.
- Tests cover blocked lead creation for research-only records and success for qualified-contactable records.

### Day 7: Week 1 regression and release gate
- Run targeted route, connector, and proof tests for scanner, opportunities, data sources, and network.
- Generate an end-of-week artifact listing active live-safe sources, queued SDR work, verified leads, and proof gaps.
- Stop feature work until failing trust or qualification regressions are fixed.

Acceptance criteria:
- `npm run typecheck`, `npm run build`, and targeted operator-critical tests pass.
- A weekly proof artifact exists with source counts, qualification throughput, and lead-quality blockers.
- Any remaining blocker is written down with owner and next action.

### Day 8: Borough and county source-depth expansion
- Deepen borough- and county-specific 311, incident, and outage coverage for NYC and Long Island.
- Replace broad generic feeds with specific municipal or county endpoints where free access exists.
- Improve geographic targeting so Suffolk, Nassau, Queens, Brooklyn, and Manhattan do not collapse into one market view.

Acceptance criteria:
- At least one real public source per priority geography is configured or explicitly marked blocked.
- Source provenance identifies the municipal or county origin.
- Territory-level opportunities are attributable to the correct operating area.

### Day 9: SDR queue throughput
- Tighten the SDR lane for queued research-only opportunities.
- Surface SLA, queue age, and qualification outcomes for scanner-sourced public signals.
- Make the overnight SDR handoff legible for operators without creating a separate hidden workflow.

Acceptance criteria:
- Queued-for-SDR opportunities are visible on dashboard and scanner with age and next action.
- Operators can distinguish between awaiting review, qualified-contactable, and rejected outcomes.
- Overnight handoff queue can be reviewed without querying the database manually.

### Day 10: Verified-lead throughput audit
- Audit verified-contact creation rate from 311, fire, flood, outage, and distress opportunities.
- Identify which sources are producing research-only volume without enough contactability.
- Re-rank source priorities around verified-contact yield, not raw opportunity count.

Acceptance criteria:
- A source-quality table exists for NYC + Long Island showing opportunity volume, queued SDR volume, qualified-contactable volume, and verified-lead conversion.
- Low-yield sources are marked tune, pause, or keep.
- Operators can see which source families are actually driving bookable work.

### Day 11: Proof-chain hardening
- Verify that qualified opportunities become leads, outreach records, and booked-job attribution without synthetic gaps.
- Tighten proof semantics so scheduled work, booked jobs, and attributable revenue remain separate.
- Ensure operator and buyer views agree on counts for qualified chains.

Acceptance criteria:
- Buyer-proof metrics exclude research-only and synthetic records.
- At least one end-to-end smoke covers source event -> opportunity -> qualified lead -> outreach -> booked job.
- Proof pages surface remediation when attribution data is incomplete.

### Day 12: Live-market QA pass
- Run manual QA against live NYC + Long Island tenant data on desktop and mobile widths.
- Check settings, scanner, opportunities, SDR lane, outbound, and network for blocked states, stale copy, and broken navigation.
- Confirm no operator-visible route implies live readiness when providers are unconfigured.

Acceptance criteria:
- Manual QA notes exist for desktop and mobile.
- Any broken flow has an owner and a same-day fix or explicit defer decision.
- No operator route shows misleading success state under missing provider config.

### Day 13: Demo and pilot release prep
- Produce the release checklist, rollback steps, and pilot-facing proof script for NYC + Long Island restoration.
- Freeze scope to bug fixes, trust issues, and operator clarity.
- Confirm overnight work queue owners for unresolved source, qualification, or attribution gaps.

Acceptance criteria:
- Release checklist includes build, typecheck, targeted tests, production readiness, operator healthcheck, and integration validation.
- Rollback notes exist for tenant-scoped data changes and connector rollout.
- Demo script uses only real or explicitly demo-labeled data paths.

### Day 14: Go or no-go review
- Review verified-lead throughput, source health, SDR queue health, and proof-chain completeness.
- Decide go, limited go, or no-go for NYC + Long Island pilot and buyer demos.
- Convert unresolved blockers into the next sprint queue with named owners.

Acceptance criteria:
- Decision is backed by artifacted counts, not qualitative impressions.
- Exact blockers are listed for any no-go or limited-go call.
- Next sprint starts with explicit carryover tasks, not open-ended cleanup.

## Acceptance Gates For The Full Sprint

- No synthetic or demo content appears on operator routes in live mode.
- Every operator-visible opportunity has provenance, compliance status, and a valid next action.
- Public-source opportunities require verified contact before lead creation.
- Firecrawl-backed sources preserve the original page URL through the proof chain.
- NYC + Long Island source coverage is explicit about live, partial, gated, or blocked status.
- Verified-lead throughput is measured by source family and geography.
- Buyer-proof surfaces count only qualified, traceable, non-synthetic chains.

## Overnight Subagent Reassignment Queue

### Queue A: Scanner And Opportunity Truth
- Owner: platform or lead-intelligence subagent
- Night objective: tighten scanner payload truth, lane mapping, and provenance persistence
- Pull next if: scanner rows are missing qualification state, proof authenticity, or source-family classification

### Queue B: Firecrawl And Public Incident Coverage
- Owner: connector or data-source subagent
- Night objective: add or validate page URLs, Firecrawl readiness, and incident-page provenance for borough or county sources
- Pull next if: public incident coverage is thin or page-backed connectors are still partial

### Queue C: Verified-Lead Throughput
- Owner: SDR or revops subagent
- Night objective: measure queued SDR volume, qualified-contactable volume, and verified-contact yield by source family
- Pull next if: research-only volume is growing faster than qualified-contactable output

### Queue D: Buyer Proof And Attribution
- Owner: proof or backend subagent
- Night objective: reconcile opportunity, lead, outreach, and booked-job counts for qualified chains only
- Pull next if: network proof counts diverge from operator-facing counts

### Queue E: QA And Release Gate
- Owner: QA or frontend subagent
- Night objective: run targeted regression, manual route QA, and blocked-state review across dashboard, scanner, opportunities, settings, and network
- Pull next if: a new connector, source config, or qualification change landed that day
