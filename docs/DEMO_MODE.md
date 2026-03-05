# Demo Mode Contract (Local)

This contract defines exactly how `main` must be demoable on a local machine without authentication friction.

## Goal

Provide a deterministic local walkthrough path for stakeholder demos where dashboard pages are accessible in development with demo mode enabled.

## Demoability contract

A branch is considered demoable when all of the following are true:

1. Local dependencies install and the app builds.
2. Demo mode can be enabled with one command.
3. Dashboard routes open locally without login friction in demo mode.
4. Verification checks complete successfully.

## Exact local steps

From repository root:

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local stack (if not already running):
   ```bash
   bash scripts/dev-up.sh
   ```
3. Enable demo mode and run the app:
   ```bash
   npm run demo
   ```
4. Open demo routes:
   - `http://localhost:3000/dashboard`
   - `http://localhost:3000/dashboard/scanner`

`npm run demo` must ensure `DEMO_MODE=on` in `.env.local` and launch the development server.

## Verification steps (required)

Run the following from repo root:

```bash
npm run lint
npm run typecheck
npm run build
bash scripts/smoke-test.sh
```

Expected result:

- lint/typecheck/build pass.
- smoke test returns overall ready/manual-ready status (environment-dependent manual checks for Twilio/Stripe are acceptable per script output).

## Failure policy

If any required check fails:

1. Do not merge to `main`.
2. Fix or revert the offending change.
3. Re-run full verification commands before PR approval.
