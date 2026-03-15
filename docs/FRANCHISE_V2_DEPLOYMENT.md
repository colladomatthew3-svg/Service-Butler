# Franchise V2 Deployment Guide

## Purpose
This guide covers deploying the tenant-first Franchise Revenue OS (v2) alongside the existing account-based stack.

## Required environment variables
- `SB_USE_V2_READS`
- `SB_USE_V2_WRITES`
- `SB_USE_POLYGON_ROUTING`
- `SB_ENABLE_CITIZEN_CONNECTOR`
- `HUBSPOT_ACCESS_TOKEN`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

## Rollout sequence
1. Apply migrations with `npx supabase db push`.
2. Keep all v2 flags disabled and verify legacy paths still operate.
3. Enable `SB_USE_V2_WRITES=true` in staging and verify v2 tables receive scanner and connector data.
4. Run connector workflows via `/api/connectors/runs` and validate `v2_connector_runs` telemetry.
5. Verify routing and assignment lifecycle via:
   - `POST /api/opportunities/:id/route`
   - `POST /api/assignments/:id/accept`
   - `POST /api/assignments/:id/reject`
6. Enable `SB_USE_V2_READS=true` for dashboard and opportunity reads.
7. Keep polygon routing off until territory geometries are validated.
8. Enable `SB_USE_POLYGON_ROUTING=true` only after GIS QA sign-off.

## Observability checks
- Connector failure rate in `v2_connector_runs`.
- Assignment SLA misses in `v2_assignments` where `status='pending_acceptance'` and `sla_due_at < now()`.
- Outreach compliance events in `v2_outreach_events` (`skipped` with outcomes `suppressed`, `cooling_window`, `lead_marked_do_not_contact`).

## Webhook/security checks
- Verify Twilio signatures on inbound routes before enabling full production traffic.
- Rotate HubSpot and Twilio credentials quarterly.
- Ensure service-role use is limited to server-side workflow modules.

## Catastrophe demo seeding
- Seed cluster-like opportunities by inserting high `catastrophe_linkage_score` values in `v2_opportunities`.
- Confirm those opportunities route via catastrophe override rules.
