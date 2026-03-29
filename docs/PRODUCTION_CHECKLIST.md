# Production Checklist

Use this checklist before deploying Service Butler to a hosted environment.

## Core environment

- Set `NEXT_PUBLIC_APP_URL` to the public app origin.
- Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Set `DEMO_MODE=off`.
- Set `REVIEW_MODE=off`.
- Leave `ALLOW_NON_DEV_DEMO_MODE=off` unless you intentionally need a controlled non-dev demo environment.
- Set `BILLING_MODE` to `stripe` if paid billing should be enforced.

## Enrichment provider

- Set `SERVICE_BUTLER_ENRICHMENT_URL` to your enrichment API endpoint.
- Set `SERVICE_BUTLER_ENRICHMENT_TOKEN` if the provider requires bearer auth.
- Set `SERVICE_BUTLER_ENRICHMENT_PROVIDER` to a short provider name for tracing, for example `attom`, `batchdata`, or `internal-enrichment`.
- Optionally tune `SERVICE_BUTLER_ENRICHMENT_TIMEOUT_MS`. The default is `4500`.
- Confirm the provider accepts this JSON payload:

```json
{
  "address": "124 Maple Ave",
  "city": "Brentwood",
  "state": "NY",
  "postalCode": "11717",
  "serviceType": "Water Mitigation"
}
```

- Confirm the provider may return this JSON shape:

```json
{
  "provider": "Vendor name",
  "propertyAddress": "124 Maple Ave",
  "city": "Brentwood",
  "state": "NY",
  "postalCode": "11717",
  "neighborhood": "North Ridge",
  "propertyImageLabel": "Parcel image",
  "propertyImageUrl": "https://example.com/property.jpg",
  "propertyImageSource": "Vendor parcel media",
  "propertyValueEstimate": "$542,000",
  "propertyValueVerification": "verified",
  "ownerContact": {
    "name": "Jamie Rivera",
    "phone": "+1 631 555 0100",
    "email": "jamie@example.com",
    "verification": "verified",
    "confidenceLabel": "Vendor verified"
  },
  "notes": [
    "Owner occupied according to county records."
  ]
}
```

## Messaging and billing

- Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` if SMS and voice should be active.
- Set `HUBSPOT_ACCESS_TOKEN` if HubSpot CRM task sync should be active.
- Set `POSTMARK_SERVER_TOKEN` or `SENDGRID_API_KEY`, plus `FROM_EMAIL`, for outbound email.
- Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_ID` when `BILLING_MODE=stripe`.
- Set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` if Inngest workflows run in your deployment.

## Franchise v2 rollout flags

- Set `SB_USE_V2_WRITES=true` in staging first to dual-write tenant-first records.
- Keep `SB_USE_V2_READS=false` until parity checks pass.
- Enable `SB_USE_V2_READS=true` during pilot cutover.
- Keep `SB_USE_POLYGON_ROUTING=false` until territory geometry validation is complete.
- Keep `SB_ENABLE_CITIZEN_CONNECTOR=false` unless legal and compliance approvals are complete.
- Set `WEBHOOK_SHARED_SECRET` before exposing webhook endpoints outside localhost.
- Keep `SB_TWILIO_SAFE_MODE=true` and `SB_HUBSPOT_SAFE_MODE=true` unless live outbound has been explicitly approved.

## Database and data

- Run Supabase migrations before deployment.
- Seed only the accounts or operator users you actually want in the environment.
- Verify `account_settings.weather_lat`, `account_settings.weather_lng`, and `account_settings.weather_location_label` exist for each live account.
- Verify Row Level Security and service-role usage in the target Supabase project.

## Safety checks

- Verify `/login` does not show demo login in production.
- Verify `/api/scanner/run` returns `mode: "live"` for authenticated production requests.
- Verify scanner opportunities include public-feed or weather-backed live data, not simulated demo data.
- Verify enrichment falls back gracefully to public-record-only data if the premium vendor is unavailable.

## Release verification

- Run `npm run check:production`.
- Run `npm run typecheck`.
- Run `npm run build`.
- Run `npm run proof:servpro` and inspect `output/proof/<timestamp>/summary.md`.
- Smoke test `/`, `/login`, `/dashboard`, `/dashboard/scanner`, and `/api/weather`.
- Check `/api/health/production` and confirm required checks return `pass`.
- Perform one real scanner run with a saved service area and verify opportunities persist.
