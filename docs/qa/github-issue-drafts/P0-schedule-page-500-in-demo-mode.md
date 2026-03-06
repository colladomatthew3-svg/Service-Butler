# [P0] Schedule page crashes in demo mode (`/dashboard/schedule`)

## Summary
The schedule route fails with a server 500 and renders a blank page in demo mode, blocking the launch-critical journey.

## Why this matters
Schedule is a core destination in product demos. A hard crash undermines launch readiness and investor/customer confidence.

## Reproduction
1. Run app with `DEMO_MODE=true npm run dev -- --port 3000`
2. Open `http://localhost:3000/login`
3. Click **Demo Login**
4. Navigate to `http://localhost:3000/dashboard/schedule`
5. Observe blank page + server error.

## Observed error
`TypeError: Cannot read properties of null (reading 'from')`

## Expected
Schedule should load using demo-safe data and show actionable schedule state.

## Suggested fix
- Add demo-mode branch to schedule loader and avoid `supabase.from(...)` when `supabase` is null.
- Provide demo fixtures or a unified data service that supports both real + demo contexts.
- Add automated demo-mode route smoke test for `/dashboard/schedule`.
