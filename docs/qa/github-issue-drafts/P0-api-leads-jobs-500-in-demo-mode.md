# [P0] `/api/leads` and `/api/jobs` return 500 in demo mode

## Summary
Both lead and job APIs crash in demo mode with null Supabase access, causing broken lead/pipeline experiences.

## Why this matters
The product narrative depends on scanner → lead → pipeline progression. API 500s make downstream pages unreliable in demos.

## Reproduction
1. Run with `DEMO_MODE=true`.
2. Open dashboard pages that fetch leads/jobs.
3. Observe network failures:
   - `GET /api/leads` → 500
   - `GET /api/jobs` → 500
4. Server logs show null dereference on `supabase.from`.

## Observed error
`TypeError: Cannot read properties of null (reading 'from')`

## Expected
APIs should return demo payloads or graceful empty data, not 500.

## Suggested fix
- Add `isDemoMode()` handling in both endpoints.
- Return seeded demo records from demo store.
- Add endpoint tests validating 200 responses in demo mode.
