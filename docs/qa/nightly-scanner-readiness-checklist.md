# Nightly Scanner Readiness Checklist

Use this checklist for the overnight operator scanner run. This is a scanner-focused gate, not a full product release checklist. The objective is to confirm that the live-safe scanner path is capturing real signals, moving some of them toward qualification, and preserving honest proof for the morning review.

Primary references:
- `docs/PRODUCTION_CHECKLIST.md`
- `docs/PRODUCTION_READINESS_SUMMARY_TEMPLATE.md`
- `docs/REAL_OPERATOR_ACTIVATION_RUNBOOK.md`
- `docs/OVERNIGHT_RELEASE_MEMO_2026-04-03.md` (archived reference only)

For the production push gate, use the checklist and summary template above. This scanner-focused checklist remains a narrower overnight gate.

## Morning decision rule

Run this exact command set in order:

```bash
npm run typecheck
npm run build
npm run check:production
npm run operator-healthcheck
npm run validate-integrations
npm run proof:servpro
```

| Status | Script rule | Scanner rule | Blocker taxonomy |
| --- | --- | --- | --- |
| `GO` | all 6 commands pass | burst run succeeds, `/api/scanner/throughput` shows `captured_real_signals > 0`, `qualified_contactable_signals > 0`, and `scanner_verified_leads_created > 0` | none |
| `GO FOR INTERNAL REVIEW ONLY` | `typecheck`, `build`, `check:production`, `operator-healthcheck`, and `validate-integrations` pass, but `proof:servpro` fails for incomplete proof only | real capture exists, but qualification or verified-lead creation is still incomplete | `proof_gate`, `throughput_gate` |
| `NO-GO` | any of `typecheck`, `build`, `check:production`, `operator-healthcheck`, or `validate-integrations` fails | throughput is unavailable, synthetic only, or all captured work remains `research_only` | `code_gate`, `runtime_gate`, `operator_gate`, `integration_gate`, `throughput_gate` |

Blocker taxonomy:
- `code_gate`: `npm run typecheck` or `npm run build` fails
- `runtime_gate`: `npm run check:production` fails
- `operator_gate`: `npm run operator-healthcheck` fails
- `integration_gate`: `npm run validate-integrations` fails
- `proof_gate`: `npm run proof:servpro` fails because buyer-proof evidence is incomplete
- `throughput_gate`: scanner KPI route is unavailable, synthetic, or still fully `research_only`

## 1. Environment and runtime checks

Required every night:
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `WEBHOOK_SHARED_SECRET`
- [ ] `SB_USE_V2_READS=true`
- [ ] `SB_USE_V2_WRITES=true`
- [ ] `OPERATOR_TENANT_ID` or `OPERATOR_TENANT_NAME`

Required safe defaults:
- [ ] `DEMO_MODE=off`
- [ ] `REVIEW_MODE=off`
- [ ] `SB_TWILIO_SAFE_MODE=true` unless live outbound was explicitly approved
- [ ] `SB_HUBSPOT_SAFE_MODE=true` unless live CRM task creation was explicitly approved

Pass rules:
- [ ] `npm run typecheck` exits `0`
- [ ] `npm run build` exits `0`
- [ ] `npm run check:production` exits `0`
- [ ] `npm run operator-healthcheck` exits `0`
- [ ] `npm run validate-integrations` exits `0`
- [ ] `npm run proof:servpro` writes `output/proof/<timestamp>/summary.md`
- [ ] `/api/health/production` has no required `fail` checks

## 2. Connector readiness checks

Count a source as scanner-ready only if all of these are true:
- [ ] source `status=active`
- [ ] terms/compliance are approved
- [ ] source is not using `sample_records`
- [ ] latest connector run is not `failed`
- [ ] runtime is not `simulated`

Expected live-source coverage:
- [ ] at least one live weather or water signal source is active
- [ ] at least one live public-source event feed is active from Open311, OpenFEMA, incidents, or social
- [ ] permits only count as live when a real provider is configured
- [ ] incident and social page-scrape sources only count as live when Firecrawl or a real approved feed is configured

Operator checks:
- [ ] Settings -> Data Sources shows live sources as live, not simulated
- [ ] no source counted in the morning brief is blocked by terms/compliance

## 3. Scanner burst run

Run one overnight scanner burst against a saved live service area.

Operator expectations:
- [ ] burst run completes without failing closed into demo/simulated mode
- [ ] result volume is deduped and not silently truncated to the old 50-result ceiling
- [ ] research-only rows remain blocked from direct lead/job creation
- [ ] qualification and next-step state remain visible after the burst run

Minimum operator evidence to capture:
- [ ] burst run timestamp
- [ ] tenant used
- [ ] route or command used
- [ ] screenshot or export of the command summary counters

## 4. 24-hour throughput thresholds

Authoritative KPI source:
- `/api/scanner/throughput`

Required fields:
- `captured_real_signals`
- `qualified_contactable_signals`
- `research_only_signals`
- `scanner_verified_leads_created`

Thresholds:
- `GO`
  - [ ] `captured_real_signals > 0`
  - [ ] `qualified_contactable_signals > 0`
  - [ ] `scanner_verified_leads_created > 0`
  - [ ] `research_only_signals` is less than total captured signals
- `GO FOR INTERNAL REVIEW ONLY`
  - [ ] `captured_real_signals > 0`
  - [ ] real scanner capture exists, but qualified-contactable or verified-lead counts are still zero
- `NO-GO`
  - [ ] throughput route is unavailable
  - [ ] all captured signals remain `research_only`
  - [ ] throughput is demo, sample, or synthetic only

Rule:
- Burst scanner volume does not count as buyer-grade throughput unless verified contactability exists.

## 5. Qualification thresholds

Scanner rows only count as meaningfully progressed if they move out of `research_only`.

Required overnight qualification signals:
- [ ] at least one scanner signal is `qualified_contactable`
- [ ] verified contact evidence exists with a real phone or email
- [ ] qualified rows are not demo/sample/synthetic

Downgrade rules:
- `GO FOR INTERNAL REVIEW ONLY` if real signals are present but all remain queued for SDR or research-only
- `NO-GO` if scanner capture exists but qualification never moves beyond research-only

## 6. Proof integrity checks

The scanner overnight proof chain must remain internally consistent:

```text
source event -> scanner signal/opportunity -> qualification state -> lead creation (if verified) -> proof artifact
```

Required checks:
- [ ] `npm run proof:servpro` writes `output/proof/<timestamp>/summary.md`
- [ ] proof artifacts are preserved for the overnight run
- [ ] scanner metrics in `/api/scanner/throughput` align with the morning proof summary
- [ ] no synthetic/demo/sample rows are being counted as real overnight scanner capture
- [ ] research-only rows are not presented as created leads

Buyer-grade proof threshold:
- [ ] use `GO` only if real scanner capture, qualification movement, and verified lead creation are all visible in the overnight window

## 7. Rollback switches

If scanner trust, live capture, or proof integrity breaks overnight, use this rollback order:

1. `SB_USE_V2_READS=false`
2. `SB_USE_V2_WRITES=false`
3. `SB_USE_POLYGON_ROUTING=false` if routing is implicated

Outbound safety switches:
- keep or force `SB_TWILIO_SAFE_MODE=true`
- keep or force `SB_HUBSPOT_SAFE_MODE=true`
- if needed, set `SB_DISABLE_TWILIO=true`
- if needed, set `SB_DISABLE_HUBSPOT=true`

After rollback:
- [ ] rerun `npm run check:production`
- [ ] rerun `npm run operator-healthcheck`
- [ ] preserve `output/proof/<timestamp>/` artifacts and scanner screenshots for the morning handoff

## 8. Today's resolved blockers and fast regression checks

Resolved today:
- `events route demo-mode hard return`
  - Expected state now: demo-mode scanner feed should fall back safely instead of hard-returning a broken response.
- `network page export issue`
  - Expected state now: the network page should remain build-safe and render through the normal page export path.

Fast regression checks:
- [ ] run `npm run build`
  - this is the fastest check for the network page export issue coming back
- [ ] open `/dashboard/network`
  - confirm the page renders instead of failing at route load
- [ ] open `/dashboard/scanner` in demo/internal review mode
  - confirm the scanner screen renders and the event feed loads rows or an explicit fallback warning, not a hard API failure
- [ ] hit `/api/scanner/events?limit=5`
  - confirm the route returns a usable response in demo/internal review mode instead of a hard early-return failure
