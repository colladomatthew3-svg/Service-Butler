# [P1] Weather Preferences in Settings appears stuck in skeleton state

## Summary
Weather Preferences section on `/dashboard/settings` remains placeholder/skeleton in demo mode, with no visible editable controls.

## Why this matters
Weather setup is central to the differentiated product story. A non-functional-looking setup area weakens launch demos.

## Reproduction
1. Demo login.
2. Navigate to `/dashboard/settings`.
3. Scroll to **Weather Preferences**.
4. Observe persistent placeholder blocks instead of interactive fields.

## Expected
Weather setup controls should render with seeded demo values and allow save/update flow.

## Suggested fix
- Ensure weather settings loader resolves in demo mode.
- Render form controls even when API latency/errors occur.
- Show explicit error/retry state instead of indefinite skeleton.
