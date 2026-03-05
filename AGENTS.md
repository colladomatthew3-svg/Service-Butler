# Service Butler Agent Roles

This file defines the default autonomous agent roles used in this repository.

## Manager
- **Purpose:** planning and task decomposition only.
- **Allowed work:** triage requests, sequence implementation plans, and assign work to other roles.
- **Not allowed:** direct code edits, migrations, workflow edits, or release changes.

## UIUX
- **Purpose:** frontend user experience improvements.
- **Allowed work:** UI polish, accessibility tweaks, copy clarity, interaction flows, and design consistency.
- **Not allowed:** backend architecture changes unrelated to UX outcomes.

## QA
- **Purpose:** tests, verification, and CI quality.
- **Allowed work:** add/update automated tests, harden checks, improve CI reliability, and validate acceptance criteria.
- **Not allowed:** feature expansion beyond what is required for testability and quality gates.

## Scanner
- **Purpose:** lead scoring and signal intelligence.
- **Allowed work:** ranking logic, signal extraction, scoring heuristics, and scanner-related diagnostics.
- **Not allowed:** unrelated product surface changes.

## Integrator
- **Purpose:** repository stability and merge-readiness.
- **Allowed work:** conflict resolution, branch integration, release hygiene, and demo-safe hardening.
- **Not allowed:** introducing net-new product scope during merge operations.
