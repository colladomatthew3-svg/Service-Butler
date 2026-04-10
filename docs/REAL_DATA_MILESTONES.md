# Real Data Milestones

This is the execution cutline for turning Service Butler into a real lead engine instead of a seeded/demo system.

## Milestone 1: Truth Gates

Goal: fail fast when the environment is only seeded or partially configured.

Done when:
- `operator-healthcheck` fails if there are zero live-safe approved sources
- `operator-healthcheck` fails if there are zero fresh live-safe sources
- `operator-healthcheck` fails if there are zero recent approved source events
- `validate-integrations` reports the same truth before any provider validation

## Milestone 2: Source Inventory Honesty

Goal: every source is clearly classified as one of:
- configured only
- live-safe but stale
- live-safe and fresh
- blocked by compliance
- simulated/sample-backed

Done when:
- dashboard and source control plane stop implying that “active” means “real”
- buyer-proof and operator-proof counts exclude blocked/simulated/stale sources

## Milestone 3: Scanner Quality

Goal: scanner output produces fewer but more credible opportunities.

Done when:
- duplicate and near-duplicate source signals are collapsed reliably
- weak signals do not inflate priority
- each opportunity clearly preserves source, freshness, compliance, and route reason

## Milestone 4: Lead Integrity

Goal: one stable lead identity per real opportunity/contact path.

Done when:
- scanner, SDR, and conversion flows reuse leads instead of fanning out duplicates
- booked jobs reuse existing leads/jobs instead of creating second copies
- lead counts distinguish research-only from contactable verified leads

## Milestone 5: Real Pilot Proof

Goal: the repo can demonstrate a non-fake operator flow.

Done when:
- at least one live-safe source family produces current approved events
- those events create real opportunities
- at least one verified/contactable lead is derived from real source truth
- proof surfaces show only real rows, not seeded/sample/demo rows

## Current Status

As of 2026-04-07:
- Milestone 1: in progress
- Milestone 2: partial
- Milestone 3: partial
- Milestone 4: partial
- Milestone 5: blocked by source truth, not by UI

## Immediate Next Slice

1. Tighten truth gates in healthcheck and integration validation
2. Identify which seeded sources actually have fresh approved events
3. Promote exactly one source family to real, live-safe proof
4. Keep all counts and dashboards honest until that source is proven
