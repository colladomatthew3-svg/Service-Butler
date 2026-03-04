# ServiceButler.ai MVP

## Hands-off local dev
1. Run one-command boot:
   ```bash
   bash scripts/dev-up.sh
   ```
2. One-time Twilio console action: paste the printed webhook URLs for Messaging, Voice, and Status Callback.
   - Twilio webhooks are auto-configured when credentials are present.
3. Run one-command smoke test:
   ```bash
   bash scripts/smoke-test.sh
   ```
4. Optional clean DB only when needed:
   ```bash
   bash scripts/db-reset.sh
   ```

## Review Mode
- Review Mode is for local UI walkthroughs without auth friction.
- Set `REVIEW_MODE=on` in `.env.local` (or run `npm run review`, which sets it automatically).
- In Review Mode, `/dashboard/*` routes are accessible for product review.
- Production behavior is unchanged: Review Mode only activates when `NODE_ENV=development` and `REVIEW_MODE=on`.

Troubleshooting:
- Twilio trial can only send to verified destination numbers (verify your phone in Twilio Console).
- Twilio signature mismatch: `WEBHOOK_BASE_URL` must exactly equal your ngrok HTTPS origin.
- Stripe webhook mismatch: make sure `STRIPE_WEBHOOK_SECRET` comes from `stripe listen`.
- Docker not running: start Docker Desktop and re-run `bash scripts/dev-up.sh`.
- Supabase ports busy: stop old stacks (`npx supabase stop`) and run `bash scripts/dev-up.sh` again.

## What dev-up does
- Installs dependencies.
- Starts local Supabase and checks core API health:
  - Auth: `/auth/v1/health` must return `200`
  - REST: `/rest/v1/` must return anything except `000` (401 is acceptable)
- Studio health is optional and never blocks boot.
- Defaults billing to MVP mode via `BILLING_MODE=disabled`.
- Auto-populates `.env.local` Supabase keys from local CLI output/status:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Applies migrations with `npx supabase db push`.
- Seeds users/data with:
  - `node scripts/seed-users.mjs`
  - `npx supabase db seed`
- If seeding fails, it keeps services/containers running and prints next-step recovery commands.
- Starts Next.js, Inngest, ngrok, and Stripe webhook listener in background.
- Auto-configures Twilio phone webhooks when Twilio credentials + `WEBHOOK_BASE_URL` are available.
- If `BILLING_MODE=disabled`, Stripe listener/product setup is skipped.
- Auto-writes `WEBHOOK_BASE_URL` and `STRIPE_WEBHOOK_SECRET` to `.env.local`.
- Attempts to auto-create `STRIPE_PRICE_ID` if missing.
- Prints a ready summary with copy/paste Twilio webhook URLs.

## Supabase seed boot note
- `supabase/config.toml` has `[db.seed].enabled=false` so `npx supabase start` does not auto-seed.
- Seeding is run explicitly by `scripts/dev-up.sh` in deterministic order.
- Use `scripts/db-reset.sh` only when you want to nuke/reset the local DB.
- `.env.example` includes the Supabase keys and `dev-up.sh` fills them automatically into `.env.local`.
- Billing modes:
  - `disabled` (default): Stripe endpoints return `{disabled:true}` and outbound is always allowed.
  - `stripe`: full Stripe checkout/portal/webhook/subscription gating behavior.

## Stop everything
```bash
bash scripts/dev-down.sh
```

## Logs
- `./logs/next.log`
- `./logs/inngest.log`
- `./logs/ngrok.log`
- `./logs/stripe-listen.log`

## Seed users
- `owner@servicebutler.local` / `Password123!`
- `dispatcher@servicebutler.local` / `Password123!`
- `tech@servicebutler.local` / `Password123!`

## Notes
- Tenant isolation is enforced with `account_id` + RLS.
- Webhook idempotency is enforced in `webhook_events(provider,event_id)`.
- Missed-call follow-up is guarded once per `CallSid` via `missed_followup:{CallSid}`.
- Stripe gating is strict by default. `ALLOW_OUTBOUND_WITHOUT_STRIPE=true` only allows outbound when subscription row is missing.
