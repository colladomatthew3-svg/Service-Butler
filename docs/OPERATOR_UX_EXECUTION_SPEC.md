# Service Butler Operator UX Execution Spec

Status: Draft for implementation
Audience: Product, Design, Frontend, QA, RevOps
Scope: Operator-facing and product-facing UX only

## Purpose

Service Butler should feel like an operator command center for local service businesses. The product must help a dispatcher or owner quickly move from signal discovery to verified lead review to outreach to booked job, without visual clutter or ambiguous next steps.

This spec defines the UX contract for the current execution phase.

## Product Goal

The interface should answer four questions immediately:

1. What demand is happening right now?
2. Which opportunities are worth action?
3. What should I do next?
4. Can I trust this lead enough to work it?

## Core UX Principles

- Optimize for booked jobs, not raw lead volume.
- Make the next action obvious on every screen.
- Show provenance and evidence before asking for trust.
- Favor flowing sections over box-heavy grids.
- Keep the operator journey short: signal -> review -> claim -> contact -> book.
- Design for fast scanning on desktop and mobile.

## Screen Contracts

### 1. Scanner as Command Center

The scanner is the primary command center for demand generation.

Required structure:

- Top intent bar with market, job type, urgency, and scan action.
- One sentence summary of what the scan is targeting.
- Result area that prioritizes the strongest opportunity first.
- Clear separation between primary opportunity, supporting evidence, and available actions.

Required content on each opportunity:

- Headline title
- Location
- Job type or service line
- Confidence or intent score
- Short evidence line explaining why the opportunity exists
- Primary next action
- Secondary actions

Action hierarchy:

- Primary action: create lead or schedule inspection, depending on confidence and workflow mode.
- Secondary actions: preview details, open source context, assign technician.
- Avoid giving every action the same visual weight.

Visual language:

- The screen should read as a live queue, not a dense card wall.
- Replace repetitive boxed grid sections with fewer, more spacious content regions.
- Use summary strips, evidence lines, and action rails instead of nested cards where possible.

### 2. Verified Queue Leads UX

The lead inbox should be a verified queue, not a generic CRM list.

Required queue behavior:

- Sort by verification quality and urgency by default.
- Surface verified and contactable leads first.
- Distinguish verified, review, and lower-confidence records visibly.

Required content on each lead:

- Lead name
- Contactability state
- Source label
- Verification status
- Location
- Service type
- Next step
- Last updated or created time

Primary actions:

- Call
- Text
- Schedule
- Convert to job

Secondary actions:

- Open lead
- Review provenance
- Add notes

Queue rules:

- If a lead is verified, the UI should reward action with stronger placement and clearer CTA weight.
- If a lead is review-only, the UI should make uncertainty explicit and avoid overstating confidence.
- If a lead lacks contactability, the UI should explain why it exists and what supporting evidence is present.

### 3. Onboarding Flow

Onboarding should be a fast, operator-readable setup path.

Required flow:

1. Confirm operator identity or demo entry.
2. Confirm service area and market.
3. Explain what sources power the scanner.
4. Run first scanner pass.
5. Review first verified lead.
6. Take first action: call, text, schedule, or convert.
7. Confirm booked-job attribution path.

Onboarding content requirements:

- Plain-language setup steps
- One primary action per step
- Clear explanation of why the product needs the requested data
- Safe-mode messaging for integrations and outbound

Onboarding success criteria:

- User reaches first useful lead without needing a product walkthrough.
- The user can identify where value comes from within the first session.

### 4. Provenance and Trust Patterns

Every opportunity and lead must feel explainable.

Required trust signals:

- Source name
- Source provenance
- Freshness indicator
- Compliance or terms status where relevant
- Evidence line explaining what triggered the record
- Verification score or status
- Dedupe or duplicate warning if applicable

Trust language rules:

- Do not use vague language like “AI found this” without context.
- Avoid hiding uncertainty.
- Do not label a lead as verified unless the evidence is visible somewhere in the flow.

Trust treatment:

- Provenance should be compact but visible in the list view.
- Detailed evidence should be available without forcing a deep hunt through the UI.
- The operator should be able to explain why the lead exists in one sentence.

### 5. Action Hierarchy

Each major screen should have one primary action and a limited set of secondary actions.

Screen-level rules:

- Scanner: primary action is scan or create lead from high-confidence result.
- Leads: primary action is call or work the lead.
- Pipeline: primary action is advance the job stage.
- Jobs: primary action is open the next operational task.
- Onboarding: primary action is continue setup or run first scan.

Visual rules:

- Do not present every CTA with equal weight.
- Avoid large groups of repeated action buttons.
- Use secondary actions sparingly and consistently.
- Keep destructive actions visually quiet and out of the main path.

## Layout Language

The product should move away from rigid box-heavy dashboards.

Preferred patterns:

- Sectioned pages with clear rhythm
- Horizontal status strips for key metrics
- Evidence summaries that sit next to action areas
- Compact cards only where scan density is needed
- Fewer nested borders and repeated panels

Avoid:

- Wall-to-wall grids
- Overuse of bordered cards
- Multiple competing CTA clusters above the fold
- Dense admin-style layouts in operator surfaces

## Copy Rules

- Use operator language, not SaaS jargon.
- Prefer “verified lead,” “next action,” “booked job,” and “source evidence.”
- Avoid abstract language unless the user needs it for trust or compliance.
- Keep copy short enough to scan in a live workflow.

## Acceptance Criteria

This UX phase is ready for implementation when:

- Scanner reads like a command center.
- Lead inbox reads like a verified queue.
- Onboarding reaches the first useful lead quickly.
- Provenance is visible in list and detail views.
- Each screen has one obvious primary action.
- The product no longer feels overly boxy or grid-heavy.

## Operator Validation Questions

Use these questions in review sessions:

- What is the next thing you would do on this screen?
- Do you trust this lead enough to call it?
- Why do you think this opportunity exists?
- Which lead would you work first and why?
- Did the onboarding help you reach value quickly?
- Does this feel like a tool for operators or a generic CRM?

