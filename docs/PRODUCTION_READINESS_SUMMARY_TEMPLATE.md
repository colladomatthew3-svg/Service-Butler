# Production Readiness Summary Template

Use this template for the final release-readiness summary after running the authoritative checklist.
Keep it short, evidence-backed, and explicit about what is live versus simulated.

## Release metadata

- Date/time:
- Author:
- Branch:
- Commit SHA:
- Target environment:
- Target environment URL:
- Decision: `GO` / `GO FOR INTERNAL REVIEW ONLY` / `NO-GO`

## Scope

- What was intended to ship:
- What was intentionally left out:
- Any unrelated local changes excluded from the release:

## Local gate results

- `npm run typecheck`:
- `npm run build`:
- Targeted operator smoke suite:
- `npm run operator-healthcheck`:
- `npm run validate-integrations`:
- `npm run proof:servpro`:
- Proof artifact path:

## Live gate results

- `npm run check:production`:
- `/api/health/production`:
- Target environment config truth:
- Demo/review mode state:
- Outbound safe mode state:
- V2 rollout flag state:
- Source readiness state:

## Operator trust readout

- Lead smoke status:
- Scanner trust status:
- Qualification / contactability status:
- Buyer-grade proof status:
- Any synthetic/demo/sample leakage found:

## Blockers and risks

- Current blockers:
- Risks that are acceptable for `GO FOR INTERNAL REVIEW ONLY`:
- Risks that block `GO`:

## Rollback notes

- Rollback order:
- Required safety switches:
- Any manual follow-up needed after rollback:

## Final decision

- Decision:
- Reason:
- Who approved:
- Next action:
