# Servpro Proof Bundle

- Generated at: 2026-03-29T16:40:58.000Z
- Proof timestamp: 2026-03-29T16-40-56-002Z
- Status: FAIL

## Steps

| Step | Status | Exit | Duration (ms) | Stdout | Stderr |
| --- | --- | ---: | ---: | --- | --- |
| operator-healthcheck | FAIL | 1 | 1027 | `operator-healthcheck/stdout.log` | `operator-healthcheck/stderr.log` |
| validate-integrations | FAIL | 1 | 847 | `validate-integrations/stdout.log` | `validate-integrations/stderr.log` |
| operator-test | FAIL | 1 | 120 | `operator-test/stdout.log` | `operator-test/stderr.log` |

## Excerpts

- operator-healthcheck: > service-butler-ai@0.1.0 operator-healthcheck
> mkdir -p .tmp/operator && npx tsc scripts/operator-healthcheck.ts --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --outDir .tmp/operator && node .tmp/operator/operator-healthcheck.js
Service Butler Operator Healthcheck
[PASS] supabase_env: Supabase URL + service role key present.
[PASS] webhook_secret: WEBHOOK_SHARED_SECRET configured.
[FAIL] supabase_connectivity: Supabase connectivity check failed (TypeError: fetch failed).
       remediation: Confirm URL/key pair and that the target project is reachable.
- validate-integrations: > service-butler-ai@0.1.0 validate-integrations
> mkdir -p .tmp/operator && npx tsc scripts/validate-integrations.ts --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --outDir .tmp/operator && node .tmp/operator/scripts/validate-integrations.js | stderr: Operator tenant not found (NY Restoration Group). Run npm run operator:seed.
- operator-test: > service-butler-ai@0.1.0 operator-test
> node scripts/operator-test.mjs
[operator-test] mode=live-partially-configured
[operator-test] config-note: PERMITS_PROVIDER_URL not set (connector will run in synthetic mode)
[operator-test] config-note: Inngest keys missing | stderr: Operator tenant not found (NY Restoration Group). Run operator seed first.
