# Service Butler Repository Diagnosis

## Current architecture

Service Butler already had a working scanner, lead workflow, dashboard shell, and a lightweight outbound demo surface. The fastest path was to reuse:

- `scanner_events` and `opportunities` for detected demand
- existing dashboard routes and shell
- existing Supabase auth/account scoping
- existing `/dashboard/outbound` route as the operator surface for outbound workflows

## What was real before this pass

- scanner UI and opportunity flow
- weather and public-signal ingestion work
- opportunities persisted in Supabase
- lead creation and dispatch workflows
- CSV import into legacy `outbound_contacts`

## What was simulated before this pass

- outbound sequencing
- contact list management
- incident-triggered outbound actions
- Smartlead integration
- prospect and referral-partner specific workflows

## What changed

This pass adds a real outbound-ready MVP layer:

- normalized `source_events`
- prospects
- referral partners
- outbound lists and members
- Smartlead sync logs and webhook storage
- Smartlead adapter + CSV export fallback
- incident-triggered outbound list generation off opportunities
- dashboard/operator wiring through the existing outbound surface

## Why this is the fastest path

- no second frontend
- no rewrite of lead or scanner flows
- no new auth model
- minimal new tables layered on top of existing account scoping
- outbound stays one dashboard area instead of becoming a separate product

## What remains mocked or deferred

- Smartlead API availability is assumed and wrapped behind the adapter
- live webhook semantics may vary by Smartlead workspace configuration
- prospect/referral datasets still need real imports or manual entry for production use
- source expansion beyond weather/fire/public signals remains incremental
