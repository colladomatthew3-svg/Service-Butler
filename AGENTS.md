# Service Butler Codex Operating Manual

This file is the repo-level control plane for Codex. Treat it as the local equivalent of `CLAUDE.md`.

For product strategy, operator UX, and department charters, also read [docs/AGENTS.md](/Users/matthewcollado/Downloads/Service%20Butler/docs/AGENTS.md).

## Mission

Turn Service Butler into an operator-grade demand intelligence and lead-generation system for restoration and home services that can survive live pilots and customer scrutiny.

## Default Priorities

1. Protect customer trust.
2. Protect tenant isolation and auth boundaries.
3. Protect lead quality and explainability.
4. Protect operator usability in demos and live workflows.
5. Protect deployment safety and rollback paths.

## Non-Negotiables

- No unauthenticated mutation endpoints.
- No cross-tenant data leakage or fallback ambiguity.
- No live outbound without suppression, safe mode, and auditability.
- No "verified" or "pilot ready" claims without evidence.
- No silent degradation when critical config is missing.
- No production deploy without an explicit readiness pass.

## Working Rules

- Start with the smallest change that materially improves reliability or operator trust.
- Prefer hard failures with clear remediation over hidden best-effort behavior for security-sensitive paths.
- Prefer graceful fallback behavior for demo-only UX paths when data stores are absent.
- Keep schema, API, and workflow changes aligned with booked-job outcomes, not vanity metrics.
- When touching leadgen, preserve provenance, compliance status, freshness, and contactability signals.

## Review Standard

When asked to review:

- Findings first, ordered by severity.
- Focus on security, data loss, auth, tenant isolation, regressions, broken workflows, and missing tests.
- Include exact file references and recommended fixes.
- If no bugs are found, say that clearly and call out remaining test or rollout risk.

## Testing Standard

Before calling work ready, run the smallest relevant validation set from this list:

- `npm run build`
- `npm run typecheck`
- `npm test -- <targeted specs>`
- `npm run check:production`
- `npm run operator-healthcheck`
- `npm run validate-integrations`

If a check cannot run because credentials or services are missing, state that plainly.

## Deploy Standard

Before any production-affecting deploy or push:

1. Confirm what environment is being changed.
2. Run build plus the most relevant smoke and safety checks.
3. Surface any uncommitted changes that are not part of the deploy intent.
4. Require explicit confirmation for production deploys, destructive migrations, or force pushes.
5. Record rollback steps in the response.

## Security Gate

The repo-local security hook lives at `scripts/sec.sh`.

Treat these as escalation-required:

- `git push`
- production deploy commands
- schema pushes against linked/remote databases
- destructive filesystem commands
- history-rewriting git commands

Treat these as blocked by default:

- `git reset --hard`
- `git checkout -- <path>`
- high-risk `rm -rf` patterns
- shell-curl installers (`curl ... | sh`)

## Repo-Local Codex Assets

- Settings: `.codex/settings.json`
- Local overrides: `.codex/settings.local.json`
- Commands: `.codex/commands/`
- Agents: `.codex/agents/`
- Skills: `.codex/skills/`

## Specialized Assets In This Repo

- Use `.codex/skills/service-butler-code-review/` for review and regression work.
- Use `.codex/skills/service-butler-deploy-controls/` for release gating and deploy execution.
- Use `.codex/skills/service-butler-security-controls/` for auth, hook, secret, and mutation-surface hardening.
