# Servpro Proof Bundle

- Generated at: 2026-04-03T01:42:28.025Z
- Proof timestamp: 2026-04-03T01-42-26-096Z
- Status: FAIL

## Production Readiness

- Status: PASS
- Exit: 0
- Stdout: `production-readiness.stdout.log`
- Stderr: `production-readiness.stderr.log`

## Steps

| Step | Status | Exit | Duration (ms) | Stdout | Stderr |
| --- | --- | ---: | ---: | --- | --- |
| operator-healthcheck | FAIL | 1 | 858 | `operator-healthcheck/stdout.log` | `operator-healthcheck/stderr.log` |
| validate-integrations | FAIL | 1 | 788 | `validate-integrations/stdout.log` | `validate-integrations/stderr.log` |
| operator-test | FAIL | 1 | 118 | `operator-test/stdout.log` | `operator-test/stderr.log` |
| qualify-real-leads | FAIL | 1 | 53 | `qualify-real-leads/stdout.log` | `qualify-real-leads/stderr.log` |

## Excerpts

- operator-healthcheck: > service-butler-ai@0.1.0 operator-healthcheck
> mkdir -p .tmp/operator && npx tsc scripts/operator-healthcheck.ts --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --outDir .tmp/operator && node .tmp/operator/operator-healthcheck.js
Service Butler Operator Healthcheck
[PASS] supabase_env: Supabase URL + service role key present.
[FAIL] supabase_local_runtime: NEXT_PUBLIC_SUPABASE_URL points to local Supabase (127.0.0.1:54321), but nothing is listening there.
       remediation: Start Docker Desktop and run `npm run db:start`, or point the env at a hosted Supabase project before rerunning the healthcheck.
- validate-integrations: > service-butler-ai@0.1.0 validate-integrations
> mkdir -p .tmp/operator && npx tsc scripts/validate-integrations.ts --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --outDir .tmp/operator && node .tmp/operator/scripts/validate-integrations.js | stderr: Operator tenant not found (NY Restoration Group). Run npm run operator:seed.
- operator-test: > service-butler-ai@0.1.0 operator-test
> node scripts/operator-test.mjs
[operator-test] mode=live-partially-configured
[operator-test] config-note: PERMITS_PROVIDER_URL not set (connector will run in synthetic mode)
[operator-test] config-note: Inngest keys missing | stderr: Operator tenant not found (NY Restoration Group). Run operator seed first.
- qualify-real-leads: no stdout | stderr: real-lead-qualification=FAIL
Operator tenant not found (NY Restoration Group)
