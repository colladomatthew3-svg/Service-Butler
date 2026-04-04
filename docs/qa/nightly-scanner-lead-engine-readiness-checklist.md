# Nightly Scanner Lead-Engine Readiness Checklist

Use this checklist for the overnight scanner and lead-engine gate. This is narrower than a full product release. The goal is to answer one question by morning: did the live-safe scanner path capture real signals, move at least some of them into verified lead flow, and preserve a traceable proof chain?

Primary references:
- `docs/PRODUCTION_CHECKLIST.md`
- `docs/REAL_OPERATOR_ACTIVATION_RUNBOOK.md`
- `docs/FRANCHISE_V2_DEPLOYMENT.md`
- `docs/OVERNIGHT_RELEASE_MEMO_2026-04-03.md`

## Morning decision rule

| Status | Use when |
| --- | --- |
| `GO` | All nightly gates pass, live-provider proof is present, and at least one verified lead and one booked-job proof chain exist in the recent window. |
| `GO FOR INTERNAL REVIEW ONLY` | Core health gates pass, real signals are captured, but verified-lead or booked-job proof is still incomplete. |
| `NO-GO` | Any required health gate fails, throughput is synthetic or research-only only, or proof-chain evidence is missing or broken. |

## 1. Required environment keys

Required every night:
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `WEBHOOK_SHARED_SECRET`
- [ ] `SB_USE_V2_READS=true`
- [ ] `SB_USE_V2_WRITES=true`
- [ ] `OPERATOR_TENANT_ID` or `OPERATOR_TENANT_NAME`

Required for live-safe outbound posture:
- [ ] Twilio is either fully configured or explicitly disabled with `SB_DISABLE_TWILIO=true`
- [ ] HubSpot is either configured or explicitly disabled with `SB_DISABLE_HUBSPOT=true`
- [ ] `SB_TWILIO_SAFE_MODE=true` unless live outbound was explicitly approved
- [ ] `SB_HUBSPOT_SAFE_MODE=true` unless live CRM task creation was explicitly approved

Required when the corresponding live source is expected to count in morning proof:
- [ ] `PERMITS_PROVIDER_URL` for live permits
- [ ] `USGS_SITE_CODES` or `USGS_WATER_ENDPOINT` for USGS water
- [ ] `OPEN311_ENDPOINT` if not using the default municipal endpoint
- [ ] `OVERPASS_QUERY` for Overpass property signals
- [ ] `FIRECRAWL_API_KEY` or per-source Firecrawl key when incident or social sources use `page_urls` with `use_firecrawl=true`

## 2. Minimum nightly command gate

These are the minimum commands for an overnight readiness pass:

```bash
npm run check:production
npm run operator-healthcheck
npm run validate-integrations
npm run proof:servpro
```

Pass rules:
- [ ] `npm run check:production` exits `0`
- [ ] `npm run operator-healthcheck` exits `0`
- [ ] `npm run validate-integrations` exits `0`
- [ ] `npm run proof:servpro` writes `output/proof/<timestamp>/summary.md`

Decision rules:
- `GO`: all four commands pass
- `GO FOR INTERNAL REVIEW ONLY`: first three pass, but `proof:servpro` fails because buyer-proof evidence is incomplete
- `NO-GO`: any of the first three commands fail

## 3. Connector live checks

Count a source as live for the morning report only if all of these are true:
- [ ] `status=active`
- [ ] terms/compliance are approved
- [ ] the source is not using `sample_records`
- [ ] latest connector run is not `failed`
- [ ] latest connector run metadata shows `connector_input_mode=live_provider` if the source will be used in buyer-grade proof

Priority nightly coverage:
- [ ] At least one live signal source is actively capturing from weather, USGS, Open311, OpenFEMA, incidents, or social
- [ ] Permits only count as live when a real provider is configured
- [ ] Incident and social page-scrape sources only count as live when Firecrawl or a real feed is configured and approved
- [ ] No active source counted in the morning brief is simulated or blocked

Operational checks:
- [ ] `/api/health/production` has no required `fail` checks
- [ ] Settings -> Data Sources shows the sources counted in the morning brief as live, not simulated

## 4. Throughput thresholds for the last 24 hours

Preferred KPI source:
- `/api/scanner/throughput`

Use these fields:
- `captured_real_signals`
- `qualified_contactable_signals`
- `research_only_signals`
- `scanner_verified_leads_created`

Thresholds:
- `GO`
  - [ ] `captured_real_signals > 0`
  - [ ] `qualified_contactable_signals > 0`
  - [ ] `scanner_verified_leads_created > 0`
  - [ ] `research_only_signals` is not equal to all captured signals
- `GO FOR INTERNAL REVIEW ONLY`
  - [ ] `captured_real_signals > 0`
  - [ ] real capture exists, but `qualified_contactable_signals = 0` or `scanner_verified_leads_created = 0`
- `NO-GO`
  - [ ] throughput route is unavailable
  - [ ] all captured signals remain `research_only`
  - [ ] throughput is only demo, sample, or synthetic

Rule:
- Burst scanner volume does not count as buyer-grade throughput unless verified contactability exists.

## 5. Proof-chain checks

The overnight run is only buyer-grade if the proof chain is intact:

```text
source event -> opportunity -> qualified contactable -> lead -> outreach -> booked job
```

Required checks:
- [ ] `output/proof/<timestamp>/summary.md` exists
- [ ] `proof:servpro` overall status is `pass` for buyer-grade `GO`
- [ ] `qualify-real-leads` reports:
  - [ ] `live_provider_source_events > 0`
  - [ ] `live_provider_opportunities > 0`
  - [ ] `live_provider_contactable_leads > 0`
  - [ ] `live_provider_verified_leads > 0`
- [ ] at least one recent outreach event exists on a verified live-provider lead
- [ ] at least one booked job from a verified live-provider lead exists for buyer-grade `GO`

Downgrade rules:
- `GO FOR INTERNAL REVIEW ONLY` if verified leads exist but booked-job proof is still zero
- `NO-GO` if the proof chain breaks before verified lead creation

## 6. Rollback switches

If the overnight readout shows unsafe live behavior or broken proof semantics, use this rollback order:

1. `SB_USE_V2_READS=false`
2. `SB_USE_V2_WRITES=false`
3. `SB_USE_POLYGON_ROUTING=false` if routing is implicated

Outbound safety switches:
- Keep or force `SB_TWILIO_SAFE_MODE=true`
- Keep or force `SB_HUBSPOT_SAFE_MODE=true`
- If needed, set `SB_DISABLE_TWILIO=true`
- If needed, set `SB_DISABLE_HUBSPOT=true`

After rollback:
- [ ] rerun `npm run check:production`
- [ ] rerun `npm run operator-healthcheck`
- [ ] preserve `output/proof/<timestamp>/` artifacts for morning review
