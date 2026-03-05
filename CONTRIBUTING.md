# Contributing

## Agent Workflow
- Integrator agent merges code and owns cross-cutting integration work.
- UIUX agent owns journeys, layout, and usability improvements.
- Brand agent owns design system and brand consistency.
- Scanner agent owns opportunity discovery and scanner intelligence.
- Product Critic agent reviews UX and product clarity; does not write code.
- QA agent writes tests and ensures demo stability.

## Local Demo Stability
Use these commands for local review:

```bash
npm install
npm run review
```

Then open:
- `http://localhost:3000/__review`

`/__review` is the review hub for clicking through product flows with minimal login friction.

## Pull Request Expectations
Every PR should include:
- Summary
- Files changed
- Demo steps
- Screenshots (if UI changes)
- Checks passed: lint, typecheck, build
