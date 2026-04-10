# Permits Next Tranche

## What Is Still Missing

- A real permits provider endpoint is not configured.
- A real permits provider token is not configured.
- Terms status for live permits must be explicitly `approved`.
- Without `provider_url`, the permits connector falls back to static/sample mode and must not be treated as live supply.

## Why Permits Is Likely Better For Native Contactability

- The permits connector already normalizes owner/applicant/contractor contact fields when the provider exposes them.
- Permit records are structurally closer to owner, applicant, or contractor identity than Open311 complaints.
- The current connector and tests already expect permit payloads to carry `owner_*`, `applicant_*`, `contractor_*`, or generic contact fields.
- This means permits can satisfy dispatchable truth rules from source-backed contact provenance instead of historical lead reuse.

## Exact Minimum To Activate It Next

1. Configure a live provider:
   - `PERMITS_PROVIDER_URL`
   - `PERMITS_PROVIDER_TOKEN`
   - `PERMITS_TERMS_STATUS=approved`
2. Seed or update the tenant `v2_data_sources` row so the permits family points at that provider URL and approved terms state.
3. Run the existing permits connector path end to end:
   - `src/lib/v2/connectors/permits/providers.ts`
   - `src/lib/v2/connectors/permits/index.ts`
   - `src/lib/v2/connectors/runner.ts`
4. Validate that provider records include at least one grounded contact field:
   - `owner_phone` or `owner_email`
   - `applicant_phone` or `applicant_email`
   - `contractor_phone` or `contractor_email`
5. Re-run the existing validation set with permit-focused tests:
   - `tests/v2-permits-ingestion.spec.ts`
   - `tests/v2-permits-intelligence.spec.ts`
   - `tests/v2-free-sources-connectors.spec.ts`
   - `tests/dispatchable-leads.spec.ts`

## Code Notes

- The permits connector already preserves contact provenance in normalized payloads.
- The next tranche should stay narrow: activate one real provider and prove whether provider-native contact fields can reach dispatchable without historical-contact reuse.
