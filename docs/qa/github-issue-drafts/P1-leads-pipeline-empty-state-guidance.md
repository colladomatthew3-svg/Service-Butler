# [P1] Leads/Pipeline empty states lack next-action guidance

## Summary
When data is empty, Leads and Pipeline pages show skeleton-like placeholders with little instruction on what to do next.

## Why this matters
Users need guidance at first run. Non-instructional empty states make the app feel unfinished and reduce conversion through the launch-critical journey.

## Reproduction
1. Demo login.
2. Visit `/dashboard/leads` and `/dashboard/pipeline`.
3. Observe placeholder-heavy content with limited explicit guidance/CTAs.

## Expected
Clear empty states with direct actions (e.g., run scanner, convert opportunity, add lead).

## Suggested fix
- Replace indefinite skeletons with explicit empty-state cards.
- Add action-oriented copy and contextual CTAs.
- Ensure each stage has one clear “next best action.”
