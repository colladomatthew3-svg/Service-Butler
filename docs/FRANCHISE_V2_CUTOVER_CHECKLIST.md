# Franchise V2 Cutover Checklist

## Pre-cutover
- [ ] Migration applied in staging and production.
- [ ] `v2_account_tenant_map` populated for all active accounts.
- [ ] Parent/child tenant visibility validated with real user accounts.
- [ ] Connector healthchecks passing for active sources.
- [ ] SLA escalation workflow (`v2/assignment.created`) tested.

## Dual-write parity
- [ ] Scanner writes produce rows in legacy and v2 tables.
- [ ] Opportunity counts are within acceptable parity threshold.
- [ ] Lead/job attribution is present in `v2_job_attributions`.

## Read cutover
- [ ] Enable `SB_USE_V2_READS=true` for one pilot tenant.
- [ ] Verify `/api/opportunities` and dashboard APIs return expected values.
- [ ] Monitor error rate and query latency for 24 hours.

## Full cutover
- [ ] Enable `SB_USE_V2_READS=true` globally.
- [ ] Keep `SB_USE_V2_WRITES=true` enabled.
- [ ] Keep legacy reads available for rollback window.

## Rollback
- [ ] Set `SB_USE_V2_READS=false`.
- [ ] Keep dual writes on while investigating.
- [ ] Reconcile parity gap before reattempting read cutover.
