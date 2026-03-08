# Outbound MVP

## What this adds

Service Butler now supports four connected motions:

1. signal-driven opportunities
2. territory-aware prospects
3. referral partner targeting
4. outbound list execution via Smartlead or CSV export

## Smartlead configuration

Set these environment variables to enable direct Smartlead sync:

- `SMARTLEAD_API_KEY`
- `SMARTLEAD_BASE_URL` (optional, defaults to `https://server.smartlead.ai/api/v1`)

Optional enrichment hook variables from the existing system still apply:

- `SERVICE_BUTLER_ENRICHMENT_URL`
- `SERVICE_BUTLER_ENRICHMENT_TOKEN`

## How outbound lists work

Outbound lists can be created:

- manually by territory + segment
- from the outbound operator screen
- from incident-triggered opportunities

Each list stores:

- type
- segment definition JSON
- territory
- source trigger
- optional Smartlead campaign id
- export/sync state

## Incident-triggered campaigns

When a high-interest opportunity is detected, Service Butler can generate a list for nearby audiences such as:

- property managers
- multifamily operators
- commercial owners
- plumbers
- insurance agents
- public adjusters

This supports immediate-response selling, not just passive monitoring.

## What is real vs mocked

Real:

- persisted prospects / referral partners / outbound lists
- Smartlead adapter shape and sync logging
- CSV export fallback
- incident-triggered list generation
- live weather/fire/public-signal opportunities already in the scanner stack

Mocked or environment-dependent:

- Smartlead live sync if API keys are missing
- imported prospect data quality
- webhook payload shape beyond stored raw events

## Local run

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm run dev
```

If you use Supabase locally, also run:

```bash
npm run db:push
```
