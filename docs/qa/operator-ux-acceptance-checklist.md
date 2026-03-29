# Operator UX Acceptance Checklist

Use this checklist to review the command-center UX phase before implementation is considered complete.

## Review Scope

- Scanner command center
- Verified queue inbox
- Onboarding flow
- Provenance and trust treatment
- Action hierarchy
- Layout rhythm and density

## Pass Criteria

The product should feel like a live operator system, not a dense grid of cards.

## Checklist

### Scanner

- [ ] Market, job type, urgency, and scan action are visible above the fold.
- [ ] The main opportunity is visually distinct from supporting results.
- [ ] Each result includes a clear evidence line.
- [ ] The primary CTA is obvious and not competing with secondary actions.
- [ ] The screen works cleanly on mobile viewport widths.

### Verified Queue

- [ ] Verified leads are clearly separated from review-only records.
- [ ] Contactable leads are easier to act on than non-contactable ones.
- [ ] The lead card shows source, status, location, and next step.
- [ ] The call/text/schedule/convert actions are easy to reach.
- [ ] The inbox feels like a working queue, not a CRM table.

### Onboarding

- [ ] A new user can understand the product in one session.
- [ ] The first setup steps are clearly ordered.
- [ ] The user is guided to the first scan quickly.
- [ ] The user can see how leads become booked jobs.
- [ ] Safe-mode or partial-config states are explained clearly.

### Provenance and Trust

- [ ] Every lead/opportunity has visible provenance.
- [ ] Freshness and verification state are not hidden.
- [ ] Evidence is understandable in one sentence.
- [ ] The UI makes uncertainty explicit.
- [ ] The verified label is only used when evidence supports it.

### Action Hierarchy

- [ ] Each screen has one primary action.
- [ ] Secondary actions are visually quieter than primary actions.
- [ ] Destructive or low-frequency actions are not dominant.
- [ ] The same hierarchy pattern repeats across scanner, leads, pipeline, and jobs.

### Layout and Feel

- [ ] The page uses fewer nested card borders than the current baseline.
- [ ] The content flows in sections rather than grid clutter.
- [ ] Metrics appear as a summary strip rather than a wall of boxes.
- [ ] Spacing and typography guide the eye naturally.
- [ ] The page feels more operator-first than admin-first.

## Operator Test Prompts

Ask operators these questions during review:

1. What is the next thing you would do on this screen?
2. Which lead would you call first?
3. Why do you trust this opportunity?
4. Does the onboarding get you to a useful lead fast enough?
5. Does this feel easier to use than a CRM?

## Stop-Ship Conditions

- A primary operator screen still feels like a grid of boxes.
- A verified lead does not show enough evidence to justify action.
- The user cannot identify the next action in under five seconds.
- Mobile usability is clearly worse than desktop.
- The onboarding path does not get the user to first value quickly.

