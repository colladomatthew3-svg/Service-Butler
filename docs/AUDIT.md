# Service Butler Revenue Audit

## Product truth
Service Butler is closest to a pilot-ready **lead-to-job conversion engine** for home service operators, not a broad CRM. The repo already contains the core system pieces needed to create opportunities, qualify them, convert them into leads, and book jobs, but those pieces are still mixed with demo paths, partially live source families, and extra operator surfaces that dilute the revenue story.

## What exists and works
### Real and usable now
- Magic-link auth, account-role checks, and protected operator routes exist.
- Legacy `leads`, `jobs`, and job pipeline APIs are functional enough for pilot operation.
- V2 opportunity ingestion, scoring, routing, source readiness, assignment, and opportunity-to-job conversion exist.
- Twilio, HubSpot, suppression, idempotency, and safe-mode controls exist.
- Source registry, connector runtime ledger, stale-run handling, and production readiness endpoints exist.
- Operator dashboard, opportunities, leads, and jobs views exist and are navigable.

### Partial but salvageable
- Scanner architecture is real, but many source families still operate in `simulated` or `live-partial` modes.
- Incident and public-signal opportunity handling is stronger than provider-dependent permits or broader source families.
- Outbound orchestration exists, but the repo intentionally favors safe mode and review-first behavior over aggressive live automation.
- Metrics and proof surfaces exist, but they are split across several views and can be harder to read than the actual revenue workflow.

### Fake, demo-only, or not revenue-proof
- `DEMO_MODE` and `REVIEW_MODE` still materially affect how the operator product behaves locally.
- Several smoke and connector tests rely on mocked fetches, mocked Supabase rows, or simulated sources rather than live provider truth.
- `validate-integrations` previously exited successfully even when it could only run in simulated mode.
- Public-signal scanner opportunities are not inherently safe to contact; they are research signals until verified contactability exists.

## Revenue-critical workflow audit
### Opportunity creation
- Works for both legacy and v2 models.
- Best path today is v2 opportunity creation from live-safe public and weather/incident sources.
- Main weakness: too many source families can appear configured without being fully buyer-proof.

### Qualification and lead creation
- Strongest current product distinction is between research-only opportunity rows and qualified/contactable rows.
- Deduplication and lead reuse are now materially better.
- Main weakness: the contract between `research opportunity`, `contactable lead`, and `booked job` is not simple enough in the UI.

### Outreach
- SMS and voice pathways exist.
- Safe-mode, suppression, and event logging are strong.
- Main weakness: the repo is still positioned like a richer outbound system than the v1 revenue motion actually needs.

### Job conversion
- Legacy lead-to-job and v2 opportunity-to-job flows both exist.
- Idempotent conversion behavior exists in the v2 path.
- Main weakness: attribution and revenue proof are not yet presented as one obvious operator loop.

## Cutline for the next 30 days
### Supported for v1
- Buyer: owner/operator at a home service company, with first proof leaning on urgent restoration-style workflows.
- Motion: pilot + concierge.
- Source family: live-safe incident, weather, open311, openfema, usgs-water, and approved public incident pages.
- Outreach: only for verified/contactable leads.
- Booking path: opportunity -> verified lead -> booked job -> pipeline tracking.

### Explicitly unsupported claims
- No claim that Google Maps or Yelp scraping is production-ready.
- No claim that research-only public opportunities are safe for blind cold outreach.
- No claim that a simulated or partial source contributes to buyer-proof lead or revenue metrics.
- No claim that the product is self-serve ready for broad SaaS scale today.

## Immediate product direction
The product should collapse around one story:
1. create real opportunities daily
2. separate research signals from contactable leads
3. contact verified leads fast
4. book jobs
5. prove revenue and attribution clearly

Everything else should either support that loop or get hidden from the primary operator experience.
