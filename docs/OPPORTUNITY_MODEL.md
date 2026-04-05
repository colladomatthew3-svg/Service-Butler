# Opportunity Model

Status: current-state audit plus target canonical model
Scope: scanner, connector ingestion, opportunity scoring, routing, qualification, and conversion

## What the repo already does

The current v2 pipeline is real, not just mocked:

- Connectors normalize live or live-adjacent signals into `ConnectorNormalizedEvent` records in `src/lib/v2/connectors/types.ts`.
- `src/lib/v2/connectors/runner.ts` writes `v2_source_events`, dedupes against `source_id + dedupe_key`, and upserts `v2_opportunities`.
- `src/lib/v2/scoring.ts` computes explainable urgency, job-likelihood, contactability, source reliability, catastrophe linkage, confidence, and revenue band scores.
- `src/lib/v2/deduplication.ts` de-duplicates opportunities with a normalized address/service/source key embedded in `explainability_json.dedup_key`.
- `src/lib/v2/routing-engine.ts` assigns opportunities to a tenant, backup tenant, and escalation tenant using territory, catastrophe, and capacity rules.
- `src/lib/v2/opportunity-qualification.ts` and `src/lib/v2/sdr-agent.ts` capture operator review, SDR verification, and lead creation decisions.
- `src/lib/v2/booked-job-webhook.ts` links a booked job back to the primary opportunity and source event.
- The legacy scanner in `src/lib/services/scanner.ts` still powers the UI demo/live surface and generates opportunity-like payloads from weather and public signals.

## Canonical opportunity record

This is the durable opportunity model we should treat as the product contract, even where the repo currently stores some of the data in `explainability_json` or adjacent tables.

### Identity and provenance

| Field | Purpose | Current repo home | Notes |
| --- | --- | --- | --- |
| `id` | Primary opportunity id | `v2_opportunities.id` | Stable tenant-scoped id. |
| `tenant_id` | Owning tenant | `v2_opportunities.tenant_id` | Must always be set. |
| `source_event_id` | Primary source event | `v2_opportunities.source_event_id` | Single primary source today. |
| `source_event_ids` | All contributing source event ids | `explainability_json.source_types`, `v2_opportunity_signals` | Not first-class yet. |
| `source_category` | Weather, permit, incident, property, social, utility, enrichment | Derived from connector key / event type | Needed for source-aware queues. |
| `source_type` | Connector event type or family | `v2_source_events.event_type` | Use the connector event type, not just the connector key. |
| `source_provenance` | Human-readable source origin | `v2_source_events.normalized_payload.source_provenance` | Required for explainability and proof. |
| `connector_run_id` | Ingestion run that produced the source event | `v2_source_events.connector_run_id` | Useful for replay and support. |
| `dedupe_key` | Real-world identity key | `explainability_json.dedup_key` | Should become a first-class column later. |

### Freshness and timing

| Field | Purpose | Current repo home | Notes |
| --- | --- | --- | --- |
| `occurred_at` | When the signal actually happened | `v2_source_events.occurred_at` | Input to urgency and confidence. |
| `ingested_at` | When the platform saw it | `v2_source_events.ingested_at` | Supports latency measurement. |
| `freshness_timestamp` | Latest freshness checkpoint | `v2_data_sources.freshness_timestamp` | Source-level today, not opportunity-level. |
| `freshness_score` | Freshness as a normalized score | `v2_source_events.data_freshness_score` | Derived during ingestion. |
| `age_minutes` | Signal age used for scoring | `src/lib/v2/opportunities.ts` and `src/lib/v2/scoring.ts` | Derived, not stored. |

### Geography and territory

| Field | Purpose | Current repo home | Notes |
| --- | --- | --- | --- |
| `location_text` | Human-readable location string | `v2_opportunities.location_text` | Often approximate. |
| `location` | Geography point | `v2_opportunities.location` | Used for polygon routing and maps. |
| `postal_code` | Zip/postal routing key | `v2_opportunities.postal_code` | Used as routing fallback. |
| `territory_id` | Assigned territory | `v2_routing_rules.territory_id` plus match logic | Not yet stored directly on opportunity. |
| `incident_cluster_id` | Cluster anchor for storm/incident groups | `v2_opportunities.incident_cluster_id` | Real for clustered signals. |
| `service_area_label` | Operator-facing market label | `src/lib/services/scanner.ts` raw payload | Useful for UI but not durable yet. |

### Property and business context

| Field | Purpose | Current repo home | Notes |
| --- | --- | --- | --- |
| `property_address` | Normalized property address | `v2_source_events.normalized_payload.address_text` / legacy scanner raw payload | Should be explicit for lead-quality workflows. |
| `property_city` | City | `v2_source_events.normalized_payload.city` | Present in many connectors. |
| `property_state` | State | `v2_source_events.normalized_payload.state` | Present in many connectors. |
| `property_postal_code` | Postal code | `v2_source_events.normalized_payload.postal_code` | Present in many connectors. |
| `business_name` | Business / site name | `v2_leads.business_name` or connector-specific payloads | More important for B2B signals. |
| `contact_name` | Contact / owner / applicant name | `v2_leads.contact_name`, connector payloads | Often extracted during SDR qualification. |
| `contact_channels` | Phone/email and provenance | `v2_leads.contact_channels_json` | This is where contactability becomes operational. |

### Classification and demand shape

| Field | Purpose | Current repo home | Notes |
| --- | --- | --- | --- |
| `opportunity_type` | Canonical signal class | `v2_opportunities.opportunity_type` | Example values are connector-specific. |
| `service_line` | Primary service line | `v2_opportunities.service_line` | Used for routing and dedupe. |
| `likely_job_type` | Human-readable inferred job | `v2_source_events.normalized_payload.likely_job_type` | Useful for operator trust. |
| `signal_summary` | Short explanation of why this exists | `v2_opportunities.title` + `description` + `explainability_json.confidence_reasoning` | Should be explicit in UI and audits. |
| `event_category` | Source family category | `v2_source_events.event_type`, connector normalized category | Needed for downstream source quality. |
| `signal_count` | Number of contributing signals | `explainability_json.signal_count` | Powers multi-signal confidence. |
| `multi_signal` | Whether different sources agree | `explainability_json.multi_signal` | Real but still JSON-backed. |

### Scores and monetization

| Field | Purpose | Current repo home | Notes |
| --- | --- | --- | --- |
| `confidence_score` | How trustworthy the signal is | `v2_opportunities.source_reliability_score` + `explainability_json.confidence_score` | Repo uses both score and explainability JSON. |
| `urgency_score` | How fast someone should act | `v2_opportunities.urgency_score` | Computed in scoring and refreshed by rescoring. |
| `job_likelihood_score` | Probability this becomes real work | `v2_opportunities.job_likelihood_score` | Main qualification threshold input. |
| `contactability_score` | Likelihood we can contact/engage | `v2_opportunities.contactability_score` | Better modeled as a real lead attribute, not just a signal score. |
| `source_reliability_score` | Reliability of the source | `v2_opportunities.source_reliability_score` | Source-level and event-level. |
| `catastrophe_linkage_score` | Storm / disaster linkage strength | `v2_opportunities.catastrophe_linkage_score` | Important for restoration. |
| `revenue_band` | Monetization bucket | `v2_opportunities.revenue_band` | Current banding is derived from blended score. |
| `estimated_value_cents` | Expected opportunity value | Not first-class in v2 | Present in legacy v1 routing rules, not the v2 opportunity table. |

### Status and operator control

| Field | Purpose | Current repo home | Notes |
| --- | --- | --- | --- |
| `contact_status` | Unknown / identified / contacted / do-not-contact | `v2_opportunities.contact_status` | Important for dispatch and compliance. |
| `routing_status` | Pending / routed / escalated / complete / failed | `v2_opportunities.routing_status` | Core routing state today. |
| `lifecycle_status` | New / qualified / assigned / contacted / booked_job / closed_lost | `v2_opportunities.lifecycle_status` | Main funnel state today. |
| `qualification_status` | Research-only / queued-for-SDR / qualified-contactable / rejected | `explainability_json.qualification_status` | Not a first-class column yet. |
| `review_required` | Whether operator approval is required | Derived from qualification and proof authenticity | Needs a dedicated boolean eventually. |
| `next_recommended_action` | The next best operator action | `explainability_json.next_recommended_action` | This is one of the most useful UX fields in the repo. |
| `review_reason` | Why review is required | `explainability_json.qualification_reason_code`, SDR reasons, audit logs | Should be normalized and surfaced. |

### Audit trail and evidence

| Field | Purpose | Current repo home | Notes |
| --- | --- | --- | --- |
| `opportunity_signals` | Score facts and supporting evidence | `v2_opportunity_signals` | Good place for explainable score components. |
| `explainability_json` | Human-readable reasoning bundle | `v2_opportunities.explainability_json` | Currently the densest source of truth. |
| `audit_log` | Mutation history | `v2_audit_logs` | Required for trust and support. |
| `verification_notes` | Review rationale | `explainability_json.sdr_notes` / `qualification_notes` | Operator feedback lives here today. |
| `review_provenance` | Who approved/rejected and why | `explainability_json.qualification_*` fields | Should stay explicit. |

### Conversion linkage

| Field | Purpose | Current repo home | Notes |
| --- | --- | --- | --- |
| `lead_id` | Lead row created from the opportunity | `v2_leads.opportunity_id` reverse link | Lead creation is the first conversion step. |
| `job_id` | Booked job row | `v2_job_attributions.job_id` and `v2_jobs.id` | Final conversion anchor. |
| `primary_opportunity_id` | Attributed opportunity for booked job | `v2_job_attributions.primary_opportunity_id` | Booked-job webhook updates this. |
| `source_event_id` | Source event attribution | `v2_job_attributions.source_event_id` | Makes booked jobs explainable. |
| `campaign_id` | Outreach/campaign linkage | `v2_job_attributions.campaign_id` | Present in conversion path. |
| `converted_job_id` | Legacy v1 lead-to-job link | `leads.converted_job_id` | Useful compatibility field, not the v2 anchor. |

## Canonical state machine

The opportunity should move through these explicit states:

`raw -> normalized -> enriched -> deduped -> classified -> scored -> routed -> queued_for_review -> approved -> rejected -> contacted -> converted_to_job -> archived -> failed`

### How the current repo maps to that machine

| Canonical state | Current repo behavior | Current representation |
| --- | --- | --- |
| `raw` | Connector fetch returns provider records | `ConnectorAdapter.pull()` |
| `normalized` | Connector-specific normalization into a shared event shape | `ConnectorAdapter.normalize()` |
| `enriched` | Live enrichment is applied selectively in scanner and SDR flows | `enrichOpportunityLive()` in scanner and SDR agent |
| `deduped` | Address/service/source dedupe happens before opportunity upsert | `checkOpportunityDuplicate()` and `injectDedupKey()` |
| `classified` | Connector classify method and scanner classification helpers map to service lines | `ConnectorAdapter.classify()`, scanner category mappers |
| `scored` | Score vector is computed and persisted | `computeOpportunityScores()` -> `v2_opportunities.*_score` |
| `routed` | Territory/override/capacity rules assign tenant and SLA | `routeOpportunityV2()` |
| `queued_for_review` | Qualification-triggered outreach queues are marked pending review | `v2_outreach_queue.status = pending_review` |
| `approved` | Operator qualifies the opportunity as contactable | `buildQualificationUpdate()` -> `qualification_status = qualified_contactable` |
| `rejected` | Operator rejects or SDR blocks the opportunity | `qualification_status = rejected`, `lifecycle_status = closed_lost` |
| `contacted` | Outreach / assignment / webhook updates land | `v2_opportunities.contact_status`, `v2_outreach_events` |
| `converted_to_job` | Booked-job webhook links back to opportunity and lead | `processBookedJobWebhook()` |
| `archived` | Closed-lost / stopped / non-actionable opportunities | `lifecycle_status = closed_lost` |
| `failed` | Connector or scoring/routing step errors | `v2_connector_runs.status = failed` and route errors |

### Deltas to production-grade state

The repo is close, but not fully production-grade yet:

1. `review_required` is still derived from qualification/proof state instead of being a durable column.
2. `source_ids` / `source_event_ids` are not first-class on the opportunity row, so multi-source lineage mostly lives in `explainability_json` and `v2_opportunity_signals`.
3. `freshness` is source-event-centric and source-centric, not yet a canonical opportunity freshness model.
4. `territory_id` is inferred during routing rather than stored on the opportunity record.
5. `estimated_value_cents` is not a v2 opportunity field, so monetization is currently a band, not a true value model.
6. Auditability is split across JSON explainability, signals, audit logs, and linked tables, which is workable but still fragmented.
7. The legacy scanner still emits a richer operator-friendly payload than the v2 pipeline in some paths, which means the UI and the backend are not fully aligned yet.

## Recommended invariant set

If we keep the current architecture, these are the model invariants worth protecting:

- Every opportunity must trace back to at least one source event or a clearly labeled manual/operator origin.
- Every score must be explainable from persisted facts, not only runtime state.
- Every routing decision must capture why the assignment happened and what fallback path was available.
- Every qualification decision must preserve the reviewer, the reason code, and the contact evidence.
- Every booked job must link back to the opportunity and source event that created it.
- Every synthetic or demo record must stay visibly synthetic so buyer-facing surfaces do not overstate proof.

