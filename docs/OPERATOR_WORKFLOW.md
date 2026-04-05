# Service Butler Operator Workflow

Status: Draft for implementation
Scope: operator-facing dashboard, scanner, opportunities, inbox, jobs, routing, approval, and convert-to-job flows

Related references:
- [Operator UX Execution Spec](/Users/matthewcollado/Downloads/Service%20Butler/docs/OPERATOR_UX_EXECUTION_SPEC.md)
- [Operator Command Center Brief](/Users/matthewcollado/Downloads/Service%20Butler/docs/OPERATOR_COMMAND_CENTER_BRIEF.md)
- [Lead Engine Runbook](/Users/matthewcollado/Downloads/Service%20Butler/docs/LEAD_ENGINE_RUNBOOK.md)

## Summary

Service Butler already has most of the operator surfaces needed for a jobs-first lead engine. The current gap is not page coverage. The gap is continuity.

The repo already exposes a scanner, a lead inbox, opportunities, pipeline, jobs, schedule, detail pages, routing logic, and a control plane for source health. What is still missing is a single, durable operator story that explains:

1. where a signal came from
2. why it matters now
3. whether it is contactable
4. who should work it
5. whether it should become a lead or job
6. what the next best action is

The workflow should be optimized for booked jobs, not raw record volume.

## Current State Audit

| Surface | Current state | Strengths | Gaps to close | Files |
| --- | --- | --- | --- | --- |
| Command center | Partial | Pulls together leads, jobs, opportunities, outbound, weather, SDR queue, and source summaries | It summarizes the business but does not yet read like a single workflow hub with a clear next action | [dashboard page](/Users/matthewcollado/Downloads/Service%20Butler/src/app/%28dashboard%29/dashboard/page.tsx), [control plane](/Users/matthewcollado/Downloads/Service%20Butler/src/components/dashboard/control-plane.tsx), [dashboard read models](/Users/matthewcollado/Downloads/Service%20Butler/src/lib/v2/dashboard-read-models.ts) |
| Lead inbox | Strong partial | Best current queue UX, with search, sort, filters, call/text/schedule/convert, and CSV import | Still feels partly like a CRM list because the canonical opportunity story is split across signals, enrichment, and lead rows | [lead inbox view](/Users/matthewcollado/Downloads/Service%20Butler/src/components/dashboard/lead-inbox-view.tsx), [leads API](/Users/matthewcollado/Downloads/Service%20Butler/src/app/api/leads/route.ts), [lead convert API](/Users/matthewcollado/Downloads/Service%20Butler/src/app/api/leads/%5Bid%5D/convert/route.ts) |
| Opportunities | Strong partial | Best source-aware surface today. It already shows lane, proof authenticity, qualification, priority, and next action | Explainability is still mostly summary text. The UI needs a clearer score breakdown, routing reason, and review state | [opportunities view](/Users/matthewcollado/Downloads/Service%20Butler/src/components/dashboard/opportunities-view.tsx), [opportunities API](/Users/matthewcollado/Downloads/Service%20Butler/src/app/api/opportunities/route.ts), [qualify API](/Users/matthewcollado/Downloads/Service%20Butler/src/app/api/opportunities/%5Bid%5D/qualify/route.ts) |
| Scanner | Partial | Already route-aware, synthetic-filtering aware, qualification-aware, and tied to dispatch behavior | The component is dense and mixes feed, SDR, and rules concerns in one place. It needs clearer state separation and a more durable decision ledger feel | [scanner view](/Users/matthewcollado/Downloads/Service%20Butler/src/components/dashboard/lead-scanner-view.tsx), [scanner run API](/Users/matthewcollado/Downloads/Service%20Butler/src/app/api/scanner/run/route.ts), [scanner events API](/Users/matthewcollado/Downloads/Service%20Butler/src/app/api/scanner/events/route.ts), [scanner dispatch API](/Users/matthewcollado/Downloads/Service%20Butler/src/app/api/scanner/events/%5Bid%5D/dispatch/route.ts) |
| Pipeline and jobs | Partial | Stage movement, schedule context, and job detail editing already exist | Stage changes are still generic. The UI does not explain why a job is in a stage or what operator action should happen next | [pipeline view](/Users/matthewcollado/Downloads/Service%20Butler/src/components/dashboard/pipeline-view.tsx), [jobs board](/Users/matthewcollado/Downloads/Service%20Butler/src/app/%28dashboard%29/dashboard/jobs/page.tsx), [job detail view](/Users/matthewcollado/Downloads/Service%20Butler/src/components/dashboard/job-detail-view.tsx), [jobs API](/Users/matthewcollado/Downloads/Service%20Butler/src/app/api/jobs/route.ts), [job detail API](/Users/matthewcollado/Downloads/Service%20Butler/src/app/api/jobs/%5Bid%5D/route.ts) |
| Lead detail | Strong partial | Good trust-building detail surface with enrichment, signals, notes, and mobile action rail | The conversion context is fragmented. It should show more of the source trail and the decision path that made this lead worth working | [lead detail view](/Users/matthewcollado/Downloads/Service%20Butler/src/components/dashboard/lead-detail-view.tsx) |
| Shell and navigation | Strong | Persistent rail, clear top bar, and good desktop/mobile navigation behavior | The workflow hierarchy still needs stronger emphasis on the operator path from signal to booked job | [app shell](/Users/matthewcollado/Downloads/Service%20Butler/src/components/dashboard/app-shell.tsx) |
| Routing and qualification | Strong partial | Tenant-aware routing, qualification, proof authenticity, and dispatch gating already exist | The routing result is mostly visible in backend state and not yet fully legible in operator UI | [routing engine](/Users/matthewcollado/Downloads/Service%20Butler/src/lib/v2/routing-engine.ts), [opportunity qualification](/Users/matthewcollado/Downloads/Service%20Butler/src/lib/v2/opportunity-qualification.ts) |

## Target Workflow

The operator workflow should be treated as a single state machine.

### 1. Signal captured

What happens:
- A live signal is captured by the scanner or a source connector.
- Synthetic or demo-only records are filtered or marked clearly.

What the operator should see:
- Source name
- Source category
- Freshness timestamp
- Proof level
- Initial category or service line

Required data:
- source id
- source provenance
- capture timestamp
- geography
- source lane
- proof authenticity

### 2. Opportunity normalized

What happens:
- The raw signal is converted into a canonical opportunity record.
- Duplicate or overlapping signals are merged or linked.

What the operator should see:
- One canonical opportunity card
- A visible explanation of what signals were merged
- A dedupe indicator when a signal already exists elsewhere

Required data:
- canonical opportunity id
- source identifiers
- signal count
- normalized service line
- territory
- freshness score
- dedupe group or lineage

### 3. Opportunity scored and routed

What happens:
- The opportunity receives urgency, likelihood, confidence, and priority scores.
- Routing chooses territory, owner, and review lane.

What the operator should see:
- Priority score
- Urgency score
- Job likelihood score
- Contactability score
- Routing target or assignment target

Required data:
- confidence score
- urgency score
- monetization potential
- routing status
- tenant / territory assignment
- SLA or response window

### 4. Review or qualification decision

What happens:
- An operator decides whether the opportunity is research-only, queued for SDR, contactable, rejected, or ready for direct dispatch.

What the operator should see:
- Clear review status
- Why the record needs review
- What evidence is still missing
- Whether this can become a lead now or needs SDR first

Required data:
- qualification status
- qualification reason code
- review requirement
- verifier identity
- review notes
- next recommended action

### 5. Lead created or assigned

What happens:
- The opportunity becomes a lead when it has enough contactability and proof to work.
- Ownership or assignment is resolved.

What the operator should see:
- Primary owner
- Backup owner or escalation path
- Contactability state
- Call and text readiness

Required data:
- lead id
- assigned user or queue
- verified contact fields
- contact provenance
- assignment reason

### 6. Contact, schedule, and convert

What happens:
- The operator calls, texts, schedules, or converts the lead to a job.

What the operator should see:
- The next best action button
- A prefilled message or call path
- The schedule window if one already exists
- Whether a job already exists

Required data:
- converted_job_id
- schedule timestamp
- customer contact data
- job stage
- conversion linkage

### 7. Job execution and closeout

What happens:
- The booked work moves through the job pipeline to completion.

What the operator should see:
- Current job stage
- Estimated value
- crew assignment
- scheduled time
- insurance or special handling notes

Required data:
- pipeline status
- job status
- service type
- assigned tech
- estimated value
- closeout status

## Recommended State Model

The UI should consistently recognize these operator states:

- `research_only`
- `queued_for_sdr`
- `qualified_contactable`
- `rejected`
- `assigned`
- `scheduled`
- `converted_to_job`
- `booked`
- `in_progress`
- `completed`
- `lost`

These states are already partially present across the scanner, opportunities, leads, and jobs flows, but they are not yet presented as one coherent progression.

## UX and Data Model Improvements

### Source context

The list and detail views should show source context as first-class data, not as an afterthought.

Recommended fields on every opportunity and lead card:
- source name
- source category
- source lane
- source provenance
- freshness timestamp
- proof authenticity
- duplicate or dedupe warning

Recommended UI pattern:
- A compact row of chips under the title
- One line that explains what the source observed
- One line that explains why this is actionable now

### Confidence and urgency explainability

The current scoring surfaces are useful, but they need a clearer explanation layer.

Recommended fields:
- urgency score
- job likelihood score
- source reliability score
- contactability score
- priority score
- confidence reasoning

Recommended UI pattern:
- Show the headline score first
- Expand to a score breakdown only when the operator asks for it
- Tie each score to a plain-language reason
- Avoid generic labels like "high confidence" without a supporting explanation

### Assignment and routing

The UI should make ownership explicit.

Recommended fields:
- assigned owner
- assigned queue
- territory
- backup owner
- escalation path
- routing reason

Recommended UI pattern:
- Put assignment near the primary CTA
- Show whether the lead was auto-routed or manually claimed
- Make a reassignment action available, but not visually dominant

### Review decisions

Review should be a real operator action, not just a backend status flip.

Recommended review actions:
- approve
- send to SDR
- reject
- request more evidence

Recommended review fields:
- review reason code
- reviewer identity
- review timestamp
- notes
- evidence missing

Recommended UI pattern:
- Force a reason when rejecting
- Surface the reason code wherever the record appears later
- Keep review-only records visually distinct from contactable records

### Convert-to-job flow

Conversion is where trust can be lost if the UI is too vague.

Recommended conversion preview:
- source summary
- current lead state
- already linked job, if any
- estimated value
- schedule date or proposed schedule window
- customer contact data that will carry forward
- warning if contactability is partial

Recommended conversion behavior:
- If a job already exists, open it instead of creating another one
- If the record is research-only, keep conversion behind an explicit approval step
- If the record is qualified_contactable, make conversion one clear action away

### Queue and filter model

The lead inbox and opportunity queue should support these filters:

- source lane
- proof authenticity
- qualification status
- assignment state
- territory
- freshness window
- contactability
- stage

Recommended default sort:
- contactable first
- highest priority next
- freshest next
- stale or unresolved items last

### Dashboard command center

The dashboard should be the place where operators decide where to spend their time.

Recommended top strip:
- new signals today
- contactable opportunities
- queued for SDR
- booked jobs
- partial-live sources
- stale runs or failed runs

Recommended dashboard behavior:
- show one "today" decision path
- highlight the single highest-priority opportunity
- call out when live data is partial so operators understand what is and is not trustworthy

## Desktop And Mobile Considerations

### Desktop

Desktop should favor a two-pane operator model:
- left rail for navigation and context
- main canvas for queue/workflow
- detail panel or modal for evidence and actions

Desktop recommendation:
- make the scanner and opportunities pages feel like a live control room
- show evidence next to the work item, not buried in a separate tab
- keep the primary action sticky inside the work card or detail panel

### Mobile

Mobile should favor one clear decision at a time:
- single-column cards
- one primary CTA
- a limited set of secondary actions
- sticky bottom action rail on detail screens

Mobile recommendation:
- keep call, text, schedule, and convert actions within thumb reach
- avoid table-only patterns
- collapse score detail and source provenance into expandable sections
- keep touch targets large enough for dispatch-style usage

### Trust-building states

Every operator page should explicitly handle these states:

#### Empty

What to show:
- what this screen is for
- what to do next
- the fastest path to create useful work

Current examples:
- no leads, no jobs, no scheduled work, or no opportunities states across the queue and pipeline views

#### Loading

What to show:
- skeletons that resemble the final layout
- no fake counts or fake confidence values

Current examples:
- lead detail loading
- job detail loading
- pipeline loading
- opportunities loading
- scanner loading

#### Failure

What to show:
- the failure cause
- whether the problem is config, permissions, a source outage, or missing data
- a recovery action

Current examples:
- opportunities API failure
- scanner runtime warning banners
- lead inbox API unavailable toast
- source control plane missing or partial live states

#### Partial-live

What to show:
- which source families are live, partial, or simulated
- what data is safe to act on
- what is still only for review or monitoring

Current examples:
- data source runtime mode in [control plane](/Users/matthewcollado/Downloads/Service%20Butler/src/components/dashboard/control-plane.tsx)
- integration readiness in [control plane](/Users/matthewcollado/Downloads/Service%20Butler/src/components/dashboard/control-plane.tsx)
- scanner warnings when synthetic opportunities are filtered out

## Workflow Guardrails

The operator UI should preserve these rules:

- Do not label a lead as verified unless the evidence is visible in the flow.
- Do not make research-only records look bookable.
- Do not hide partial-live status behind generic "healthy" language.
- Do not let conversion create duplicate jobs silently.
- Do not collapse source provenance into a generic source label when more detail is available.
- Do not make outbound or dispatch actions feel equally safe when the underlying evidence quality is different.

## Implementation Priorities

If we tighten this workflow in small PRs, the order should be:

1. unify opportunity, lead, and job decision states in the UI copy and chips
2. add stronger source/proof/freshness context to list views
3. expose score breakdown and routing reason in opportunities and scanner views
4. make convert-to-job preview explicit and idempotent
5. improve failure and partial-live banners across operator surfaces
6. tighten mobile detail actions with sticky rails and fewer competing buttons

## Bottom Line

The repo already has the bones of a real operator system. The next step is to make the workflow legible:

- signal -> normalized opportunity -> reviewed opportunity -> contactable lead -> booked job -> executed job

If we make that path obvious in the UI, Service Butler will feel less like a set of adjacent pages and more like a dependable operator engine.
