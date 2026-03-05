# Agent Branch & Scope Contract

This document defines ownership and boundaries for agent branches used during integration.

## Branch ownership

- `main`: protected integration branch; receives reviewed pull requests only.
- `agent/integrator`: Release/Integrator Engineer branch for cross-cutting hardening, contracts, and safe merge preparation.
- Other `agent/*` branches: feature- or role-specific implementation branches.

## No-direct-main rule

- **Never commit directly to `main`.**
- All changes must be authored on a non-`main` branch and merged through a pull request.
- Emergency fixes still require a short-lived branch + PR path.

## Scope boundaries

Integrator work is limited to:

1. Integration contracts and process docs (for example demoability and branch rules).
2. Build/lint/typecheck/test hardening that keeps `main` releasable.
3. Non-feature operational scripts needed to keep local demo workflows functional.
4. PR quality gates/checklist updates that enforce branch and demo contracts.

Integrator work must **not** include:

- New product features.
- UI/UX scope changes not required for demoability contract compliance.
- Data model or API surface expansion unrelated to release safety.

## Merge safety expectations

Before opening a PR to `main`, run at minimum:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `bash scripts/smoke-test.sh`

If any check fails, document the failure and remediate before merge.
