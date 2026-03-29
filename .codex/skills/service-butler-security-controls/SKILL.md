---
name: service-butler-security-controls
description: Use when hardening Service Butler auth, hooks, webhooks, tenant isolation, secret handling, or other security-sensitive operational controls.
---

# Service Butler Security Controls

Use this skill when the task involves trust boundaries, security review, or operational guardrails.

## Focus Areas

- auth and RBAC
- tenant isolation
- webhook verification
- suppression and outbound safety
- secret handling
- admin and service-role paths
- dangerous deploy or shell commands

## Required Checks

1. Read changed files first.
2. Look for missing tenant filters and missing role checks.
3. Verify fail-closed behavior for missing secrets.
4. Verify high-risk commands are blocked or escalated.
5. Run targeted tests when relevant:
   - `npm test -- tests/v2-webhook-auth.spec.ts`
   - `npm test -- tests/v2-assignment-webhook.spec.ts tests/v2-booked-job-webhook.spec.ts`

## Command Guardrails

Treat these as block-or-escalate paths:

- `git reset --hard`
- `git checkout --`
- destructive `rm -rf`
- production deploy commands
- schema pushes to linked or remote databases
- `curl ... | sh`

Use `scripts/sec.sh` as the pre-execution policy gate for Bash tool calls.
