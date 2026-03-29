# Service Butler Production Pod Charter

This document defines the core creative and technology team responsible for moving Service Butler from MVP to production-ready for local service operators, starting with the Suffolk County restoration pilot.

## Mission

Build an operator-grade demand intelligence and lead-generation platform that turns signals into verified leads, routes them correctly, supports safe outreach, and proves value through booked jobs.

## Shared scoreboard

Every department optimizes for:

- Verified leads created
- Lead contactability rate
- Speed to first action
- Lead acceptance rate
- Booked job rate
- Attribution completeness
- Operator trust and workflow clarity

The system must optimize for booked jobs, not raw lead volume.

## Shared non-negotiables

- No cross-tenant ambiguity
- No unauthenticated mutation paths
- No "verified lead" label without evidence
- No live outbound without suppression and safe-mode controls
- No silent fallback when configuration is missing
- No customer-facing claims without attribution data

## Team structure

### 1. Product Design Lead

Mission:
Make Service Butler legible, credible, and fast to use under pressure.

Owns:

- Information architecture
- Onboarding and first-run flow
- Dashboard hierarchy
- Scanner, leads, routing, and outreach UX
- Mobile operator usability
- Brand quality and interaction design

Do:

- Simplify the operator journey from signal to booked job
- Make provenance, urgency, and next-step guidance obvious
- Design for dispatchers and owners, not generic SaaS users
- Standardize empty, loading, partial-data, and failure states
- Validate all critical workflows on desktop and mobile

Don't:

- Add decorative UI that slows operators down
- Add new pages when better hierarchy solves the problem
- Redesign workflows without operator feedback
- Hide operational state in ambiguous UI patterns

Can decide:

- Layout
- Interaction model
- Information hierarchy
- Design system rules
- Copy structure

Must escalate:

- Pricing or packaging changes
- Customer-visible workflow semantics
- Compliance-sensitive language
- Any change that alters data visibility or automation behavior

### 2. Frontend Engineering Lead

Mission:
Make the operator console fast, stable, responsive, and release-safe.

Owns:

- Next.js app quality
- Shared UI primitives
- Responsive behavior
- Accessibility
- Runtime stability
- UI test coverage

Do:

- Harden scanner, leads, pipeline, jobs, and dashboard flows
- Support demo mode, partially configured live mode, and fully live mode
- Add strong empty, loading, and failure states
- Reduce layout drift and brittle component patterns
- Add regression coverage for operator-critical paths

Don't:

- Hide backend inconsistencies with UI hacks
- Ship visual changes without mobile checks
- Let styling diverge page by page
- Encode unsafe backend assumptions in the UI

Can decide:

- Component structure
- Rendering strategy
- Client state patterns
- Responsive layout behavior
- Frontend regression tests

Must escalate:

- API contract changes
- Schema assumptions
- Workflow changes that alter backend state semantics

### 3. Platform and Backend Lead

Mission:
Make the platform safe, observable, and dependable for real customers.

Owns:

- Supabase and Postgres safety
- Tenant isolation
- Webhooks and workflow correctness
- Routing and assignment behavior
- Deployment readiness
- Incident handling
- Operational tooling

Do:

- Enforce fail-closed auth on webhooks and admin mutations
- Remove cross-tenant fallback behavior from scripts and services
- Ensure idempotency, retries, auditability, and observability
- Harden env validation and startup checks
- Maintain rollback and incident playbooks

Don't:

- Allow missing secrets to imply authorization
- Allow implicit tenant targeting in service-role scripts
- Ship hidden failure modes in background jobs
- Expand architecture unless it removes a production blocker

Can decide:

- Backend implementation details
- Validation rules
- Operational hardening behavior
- Retry and observability patterns
- Safety checks in scripts and services

Must escalate:

- Schema redesigns
- Billing-impacting changes
- Provider contract changes
- Customer-visible workflow semantics

### 4. Data and Lead Intelligence Lead

Mission:
Generate real, explainable, compliant, bookable leads that operators trust.

Owns:

- Connectors and source strategy
- Normalization and dedupe
- Compliance gating
- Scoring and verification
- Attribution
- Source quality measurement

Do:

- Prioritize high-signal local sources with strong contactability
- Store provenance, freshness, compliance status, and explainability
- Maintain a strict definition of verified lead
- Tune scoring around booked-job probability
- Rank sources by usefulness in Suffolk and adjacent markets

Don't:

- Optimize for raw event count
- Promote weak or unverified signals as sales-ready leads
- Add risky sources without compliance review
- Hide scoring logic behind opaque heuristics

Can decide:

- Scoring thresholds
- Source weighting
- Deduplication rules
- Verification policy
- Connector readiness gates

Must escalate:

- Legally sensitive sources
- Outbound compliance tradeoffs
- Any change that weakens verification standards

### 5. Revenue Operations and Customer Success Lead

Mission:
Make the first customer successful and convert the pilot into proof of value.

Owns:

- Operator onboarding
- Pilot setup
- Customer runbooks
- Lead acceptance workflow
- Weekly operating cadence
- Proof-of-value reporting

Do:

- Run the Suffolk pilot like an operations program
- Define lead acceptance, rejection, and reason-code workflow
- Track response speed, acceptance rate, booked jobs, and source quality
- Keep safe outbound defaults documented and enforced
- Turn field feedback into product priorities every week

Don't:

- Promise volume before quality is proven
- Treat demo success as pilot success
- Let leads sit unworked without review
- Run unsafe outbound in production

Can decide:

- Onboarding sequence
- Training material
- Weekly review format
- Operator SOPs
- Pilot reporting cadence

Must escalate:

- Pricing changes
- Contract terms
- Risky outbound practices
- Customer asks that require product scope changes

## Shared QA and release ownership

QA and release ownership is embedded across Frontend and Platform.

This function is responsible for:

- Weekly production-readiness review
- Stop-ship recommendations
- Release checklist enforcement
- Live-path validation against operator-safe settings
- Rollback verification

## First 6-week push

### Week 1

- Fix the four hardening issues already identified in repo review
- Finalize Suffolk operator seed and runbook
- Lock lead acceptance reason codes

### Week 2

- Tighten operator core UX across scanner, leads, pipeline, and jobs
- Harden live-mode state handling
- Start daily Suffolk source QA

### Week 3

- Run real Suffolk lead collection
- Verify contacts
- Export the first customer-safe lead batch
- Instrument acceptance and rejection outcomes

### Week 4

- Reduce false positives
- Fix routing edge cases
- Tighten suppression handling
- Improve proof-of-value dashboard data

### Week 5

- Stabilize outbound and attribution
- Prove source-to-lead-to-outreach-to-job traceability

### Week 6

- Package the pilot with runbooks, metrics pack, customer review deck, and production checklist

## Cadence

Daily:

- Source health review
- New lead QA
- Blocked automation review

Twice weekly:

- Product, design, frontend, backend sync on pilot blockers

Weekly with customer:

- Leads delivered
- Lead acceptance rate
- Response speed
- Booked jobs
- Qualitative feedback
- Next fixes

Weekly internal:

- Production go/no-go review
- Open risks and incidents
- Rollout readiness

## Escalation rules

Escalate jointly when a change affects:

- Tenant boundaries
- Compliance posture
- Outbound policy
- Source legality or terms of use
- Attribution semantics
- Customer-visible SLAs
- Pricing or packaging

## Branch and merge rule

- Never commit directly to `main`
- Use a non-`main` branch for all implementation work
- Validate at minimum:
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
