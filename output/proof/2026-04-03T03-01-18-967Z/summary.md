# Servpro Proof Bundle

- Generated at: 2026-04-03T03:01:23.638Z
- Proof timestamp: 2026-04-03T03-01-18-967Z
- Status: PASS

## Production Readiness

- Status: PASS
- Exit: 0
- Stdout: `production-readiness.stdout.log`
- Stderr: `production-readiness.stderr.log`

## Steps

| Step | Status | Exit | Duration (ms) | Stdout | Stderr |
| --- | --- | ---: | ---: | --- | --- |
| operator-healthcheck | PASS | 0 | 1471 | `operator-healthcheck/stdout.log` | `operator-healthcheck/stderr.log` |
| validate-integrations | PASS | 0 | 1554 | `validate-integrations/stdout.log` | `validate-integrations/stderr.log` |
| operator-test | PASS | 0 | 218 | `operator-test/stdout.log` | `operator-test/stderr.log` |
| proof-book-verified-lead | PASS | 0 | 1083 | `proof-book-verified-lead/stdout.log` | `proof-book-verified-lead/stderr.log` |
| qualify-real-leads | PASS | 0 | 133 | `qualify-real-leads/stdout.log` | `qualify-real-leads/stderr.log` |

## Excerpts

- operator-healthcheck: > service-butler-ai@0.1.0 operator-healthcheck
> mkdir -p .tmp/operator && npx tsc scripts/operator-healthcheck.ts --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --outDir .tmp/operator && node .tmp/operator/operator-healthcheck.js
Service Butler Operator Healthcheck
[PASS] supabase_env: Supabase URL + service role key present.
[PASS] supabase_local_runtime: Local Supabase endpoint is reachable at 127.0.0.1:54321.
[PASS] webhook_secret: WEBHOOK_SHARED_SECRET configured.
[PASS] supabase_connectivity: Supabase connectivity OK.
[PASS] table:v2_tenants: Table reachable.
[PASS] table:v2_tenant_memberships: Table reachable.
[PASS] table:v2_territories: Table reachable.
[PASS] table:v2_data_sources: Table reachable.
[PASS] table:v2_connector_runs: Table reachable.
- validate-integrations: > service-butler-ai@0.1.0 validate-integrations
> mkdir -p .tmp/operator && npx tsc scripts/validate-integrations.ts --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --outDir .tmp/operator && node .tmp/operator/scripts/validate-integrations.js
Integration Validation Report
[WARN] twilio: Twilio explicitly disabled.
[WARN] hubspot: HubSpot explicitly disabled.
[PASS] lead_opportunity_link: Lead is linked to opportunity. crm_sync_status=not_synced
- operator-test: > service-butler-ai@0.1.0 operator-test
> node scripts/operator-test.mjs
[operator-test] mode=live-partially-configured
[operator-test] config-note: Inngest keys missing
[operator-test] connector-input-mode=live_provider
connector run
opportunity created
opportunity scored
territory matched
assignment created
outreach sent
webhook booked job received
- proof-book-verified-lead: > service-butler-ai@0.1.0 proof:book-verified-lead
> mkdir -p .tmp/operator && npx tsc scripts/book-verified-live-provider-lead.ts --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --outDir .tmp/operator && node .tmp/operator/scripts/book-verified-live-provider-lead.js
No verified live-provider lead without a booked job was found.
- qualify-real-leads: real-lead-qualification=WARN
tenant_id=8e479ab5-58a2-4fef-ad9a-4d88b6f05d45
tenant_name=NY Restoration Group
lookback_days=14
live_provider_source_events=7
live_derived_source_events=0
synthetic_source_events=9
proof_cohort_source_events=16
proof_cohort_synthetic_source_events=9
unknown_source_events=0
live_provider_opportunities=7
live_provider_contactable_leads=7
