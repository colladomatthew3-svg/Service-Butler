# Scoring and Routing

Status: current-state audit plus target operating policy
Scope: score computation, dedupe, routing, qualification, review, approval, and conversion

## What the repo already does

The v2 path already has a real scoring and routing system:

- `src/lib/v2/scoring.ts` computes bounded explainable scores from urgency, severity, geography, service fit, property fit, supporting signals, catastrophe linkage, and source reliability.
- `src/lib/v2/connectors/runner.ts` derives event-level score inputs, merges repeated signals, and persists score facts in `v2_opportunity_signals`.
- `src/lib/v2/deduplication.ts` keeps address/service/source duplicates from creating redundant opportunities.
- `src/lib/v2/routing-engine.ts` chooses assignment tenants, backup tenants, escalation tenants, and SLAs using routing rules, territory matching, and capacity pressure.
- `src/lib/v2/opportunity-qualification.ts` defines the operator review decision and the contactability gate.
- `src/lib/v2/sdr-agent.ts` acts as a higher-trust qualification layer before leads are created, routed, and optionally outreached.
- `src/lib/v2/qualification-outreach-bridge.ts` queues first-touch outreach in safe mode and keeps it pending review.
- `src/lib/v2/booked-job-webhook.ts` completes the funnel by linking booked jobs back to the opportunity and source lineage.

## Current score vector

`computeOpportunityScores()` returns this vector:

- `urgencyScore`
- `jobLikelihoodScore`
- `contactabilityScore`
- `sourceReliabilityScore`
- `revenueBand`
- `catastropheLinkageScore`
- `confidenceScore`
- `explainability`

### Current scoring logic

| Component | Current behavior | Notes |
| --- | --- | --- |
| Recency | Older events lose score linearly | `100 - eventRecencyMinutes / 1.8`, clamped |
| Severity | Weighted heavily into both urgency and job likelihood | Adjusted by vertical connector weight |
| Geography | Direct match score plus a precision bonus | Uses geography match and precision inputs |
| Service fit | Service line fit contributes materially to job likelihood | Better matches get more weight |
| Support signals | More supporting signals improve confidence and job likelihood | Implemented as `supportingSignalsCount` and `signalAgreement` |
| Contactability | Blends contact availability with prior customer match | Useful, but still derived from sparse inputs |
| Catastrophe linkage | Raises urgency and confidence for storm/disaster style signals | Especially important for restoration |
| Source reliability | Contributes to confidence and the SDR gate | Should stay conservative |
| Vertical modifier | Connector weight + preferred signal boost + seasonality | Applied via franchise vertical config |

### Current explainability bundle

The score explainability JSON already records the useful facts:

- source type
- event recency minutes
- severity
- geography match and precision
- property type fit
- service line fit
- prior customer match
- contact availability
- supporting signals count
- catastrophe signal
- signal agreement
- confidence score
- vertical key
- connector weight
- preferred signal
- seasonal multiplier

That is the right shape. The main delta is that the model still spreads state across JSON, score columns, and separate signal rows instead of a more explicit model contract.

## State machine

The canonical pipeline should remain explicit and durable:

`raw -> normalized -> enriched -> deduped -> classified -> scored -> routed -> queued_for_review -> approved -> rejected -> contacted -> converted_to_job -> archived -> failed`

### State behavior and current repo mapping

| State | Entry condition | Exit condition | Current repo mapping |
| --- | --- | --- | --- |
| `raw` | Connector returns provider payload | Payload is accepted by a connector adapter | `ConnectorAdapter.pull()` |
| `normalized` | Payload becomes `ConnectorNormalizedEvent` | Valid event passes shape checks | `ConnectorAdapter.normalize()` and `validateNormalizedEvent()` |
| `enriched` | Live enrichment attaches property/contact context | Enrichment facts are merged or skipped | `enrichOpportunityLive()` and scanner enrichment path |
| `deduped` | Duplicate check executed | Opportunity is merged or skipped | `checkOpportunityDuplicate()` / `mergeOpportunityScores()` |
| `classified` | Service line and opportunity type resolved | Classification is attached to the opportunity | Connector `classify()` + scanner category helpers |
| `scored` | Score vector computed | Score facts persisted | `computeOpportunityScores()` + `v2_opportunity_signals` |
| `routed` | Territory/override/capacity rules evaluated | Assignment record created | `routeOpportunityV2()` |
| `queued_for_review` | High-trust action needs human approval | Operator approves or rejects | `v2_outreach_queue.status = pending_review` and qualification flow |
| `approved` | Operator marks record contactable / actionable | Lead creation, routing, or outreach can proceed | `buildQualificationUpdate()` and SDR agent |
| `rejected` | Operator or SDR vetoes the opportunity | Opportunity is closed out | `qualification_status = rejected`, `lifecycle_status = closed_lost` |
| `contacted` | Outreach or direct contact succeeds | Response or booking outcome recorded | `v2_opportunities.contact_status`, `v2_outreach_events` |
| `converted_to_job` | Booked job webhook or lead-to-job conversion lands | Job and attribution rows are written | `processBookedJobWebhook()` |
| `archived` | Opportunity is no longer actionable | State is closed | `lifecycle_status = closed_lost` |
| `failed` | Ingestion, scoring, routing, or webhook step errors | Error is logged and surfaced | `v2_connector_runs.status = failed`, route/qualification errors |

## Scoring policy

This is the recommended interpretation of the current code:

### 1. Urgency score

Primary drivers:

- event recency
- severity
- catastrophe linkage
- source-specific urgency boost

Current behavior:

- weather and incident sources get the strongest urgency boost
- permits and social signals get a smaller boost
- recency decays score over time

### 2. Job likelihood score

Primary drivers:

- severity
- recency
- geography match
- service line fit
- property type fit
- supporting signals
- prior customer match

Current behavior:

- multi-signal and vertical-aware inputs raise the score
- connector weights can shift service-specific scores

### 3. Contactability score

Primary drivers:

- contact availability
- prior customer match
- extracted contact evidence

Current behavior:

- mostly derived from the signal surface rather than a full entity graph
- gets stronger only when there is usable contact data

### 4. Source reliability score

Primary drivers:

- connector-reported reliability
- source class
- source provenance

Current behavior:

- source reliability is scored at ingestion and feeds both confidence and SDR gating

### 5. Confidence score

Primary drivers:

- source reliability
- recency
- signal agreement
- geography precision
- severity

Current behavior:

- multi-signal agreement increases confidence
- confidence is persisted in explainability and signals

### 6. Revenue band

Current behavior:

- `enterprise` for the strongest blended score band
- `high`, `medium`, `low` otherwise

Recommended interpretation:

- treat this as an internal monetization bucket until we have explicit expected value modeling

## Dedupe policy

Current dedupe is practical and good enough for now:

- normalize address
- normalize postal code or city
- normalize state
- normalize service type
- normalize source category
- store the result as `dedup_key`

Current repo behavior:

- `buildDedupKey()` strips unit numbers and normalizes common street names
- `checkOpportunityDuplicate()` compares the dedup key inside `explainability_json`
- the dedupe window depends on the franchise vertical and source type

Recommended policy:

- weather and incident sources should have short dedupe windows because conditions change quickly
- permits should have longer windows because they represent one project over time
- property and social signals should dedupe by address + service line + source family

## Routing policy

### Ordering of routing decisions

1. Enterprise override rules
2. Catastrophe override rules
3. Territory match
4. Capacity pressure override
5. Fallback assignment

### Current routing behavior

`routeOpportunityV2()` currently:

- loads active routing rules for the franchise and enterprise tenants
- checks for enterprise override rules
- checks for catastrophe override rules
- looks up the territory by polygon when `SB_USE_POLYGON_ROUTING=true`
- falls back to zip-code territory matching
- computes capacity pressure from recent assignments
- assigns a backup tenant and an escalation tenant
- writes a `v2_assignments` row
- updates the opportunity routing and lifecycle statuses
- records an audit event

### SLA policy

Current SLA logic:

- `0-4h` or very high urgency -> 15 minutes
- clustered catastrophe signals -> 20 minutes
- `4-24h` / high urgency / catastrophe linkage -> 30 minutes
- default -> 45 minutes
- fallback assignments widen the SLA floor to 60 minutes

Recommended operator interpretation:

- SLA is an operational promise, not just a timestamp
- SLA should be visible in the queue, assignment record, and audit log

## Operator review and approval

This repo already has the right primitives for review.

### Review decision points

1. Connector compliance gate
2. SDR candidate verification gate
3. Opportunity qualification mutation
4. Outreach queue approval gate
5. Booked job conversion gate

### Current decision rules

- `opportunity-qualification.ts` requires `qualification_source` and `qualification_notes` for every mutation.
- `qualified_contactable` additionally requires `contact_name`, at least one contact channel, and `verification_status`.
- `getOpportunityQualificationSnapshot()` turns explainability JSON into an operator-readable review snapshot.
- `qualificationAllowsDispatch()` only allows dispatch when the qualification is `qualified_contactable`, verification is `verified`, and phone or email exists.
- `sdr-agent.ts` blocks candidates when compliance is not approved, when proof is synthetic, or when location is missing.
- `qualification-outreach-bridge.ts` always queues first-touch outreach in `pending_review` safe mode.

### Rationale capture

The repo already captures good review rationale in a few places:

- `qualification_reason_code`
- `next_recommended_action`
- `sdr_verification_score`
- `sdr_verification_reasons`
- `sdr_contact_provenance`
- `sdr_contact_evidence`
- `sdr_notes`
- `v2_audit_logs.after_json`

Recommended rule:

- any manual approval, rejection, or dispatch decision should write a normalized reason code plus free-text rationale
- the rationale should be tied to the current opportunity state and the person or system that made the decision

## Conversion policy

Conversion is currently a chain of explicit steps:

1. Opportunity gets qualified
2. Lead row is created in `v2_leads`
3. Optional legacy v1 lead is created for compatibility
4. Assignment may be created
5. Outreach may be queued, but stays in review until approved
6. Booked job webhook writes `v2_jobs`
7. Attribution row is written in `v2_job_attributions`
8. Opportunity lifecycle becomes `booked_job`

Recommended conversion invariant:

- a booked job is not complete unless the job row, the attribution row, and the source lineage are all present

## Production-grade deltas

These are the main gaps between current state and a fully hardened production system:

1. No single workflow ledger records every opportunity state transition in one place.
2. Retry and replay metadata are not first-class on opportunity processing.
3. Stale-run detection exists conceptually in the runtime layer, but opportunity-level reruns are not yet a canonical workflow state.
4. Queue approval is mostly represented through outreach and qualification rather than a uniform review queue for all opportunity actions.
5. Territory assignment is good, but the current opportunity record does not persist enough routing provenance to make replay trivial.
6. The legacy scanner and the v2 pipeline still expose slightly different truth surfaces, which can confuse operators if the UI does not stay explicit about the source of truth.

## Practical operating rule

When in doubt, the safest production interpretation is:

- score from facts, not vibes
- route by explicit territory and capacity rules
- require human review when proof is weak, compliance is unknown, or contactability is not confirmed
- never mark an opportunity buyer-ready unless the rationale and provenance can be explained from persisted data

