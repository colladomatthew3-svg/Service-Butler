# Suffolk Launch-Day Support and Escalation SOP

Use this SOP on launch day and for the first 72 hours of live pilot activity.

## Objective

Keep the customer safe, keep the pilot moving, and prevent avoidable downtime or bad lead handling.

## Coverage window

- Launch day: full monitoring during business hours
- First 72 hours: heightened response window
- After 72 hours: weekly operating cadence unless an incident occurs

## Roles

- Customer ops owner: customer communication and issue triage
- Platform owner: webhook, integration, and workflow failures
- Data owner: source quality, scoring, and lead verification issues
- Frontend owner: UI or operator flow problems

## Support channels

- Primary customer contact:
- Secondary customer contact:
- Internal escalation contact:
- Emergency escalation contact:

## Severity levels

### Sev 1

Use when live workflows are blocked, data is mutating incorrectly, or the customer cannot operate the pilot.

### Sev 2

Use when a core workflow is degraded but the customer can still operate.

### Sev 3

Use when the issue is annoying, low risk, or can be handled in the next working block.

## Launch-day checklist

- Confirm the customer is seeded and can log in.
- Confirm territories and lead queues are visible.
- Confirm safe outbound mode is active unless the customer explicitly approved live traffic.
- Confirm lead acceptance reason codes are ready.
- Confirm weekly proof-of-value report ownership.
- Confirm escalation contacts are reachable.

## Incident response flow

1. Acknowledge the issue quickly.
2. Classify severity.
3. Stop any unsafe outbound or write action if needed.
4. Gather timestamps, lead IDs, job IDs, and screenshots if relevant.
5. Route to the right owner.
6. Confirm a workaround or rollback step.
7. Tell the customer what happened and what is next.
8. Record the issue for weekly review.

## Escalation triggers

- Webhook failure or duplicate processing
- Lead accepted but not attributed correctly
- Suppression or opt-out concern
- Territory routing mismatch
- Customer cannot access the system
- Dashboard data looks stale or inconsistent
- Any sign of cross-tenant behavior

## Customer communication rule

- Be direct.
- Give one sentence on impact.
- Give one sentence on next action.
- Do not speculate.
- Do not promise a fix time unless the owner has confirmed it.

## Rollback posture

If the issue is related to live writes or live outbound:

- Pause outbound first.
- Pause unsafe writes second.
- Preserve audit evidence.
- Resume only after the owner confirms the fix is safe.

## Post-incident follow-up

- Log the issue in the weekly review.
- Add the root cause to the support checklist.
- Update the onboarding checklist if the issue was avoidable.
- Update the proof-of-value report if the issue affected customer results.
