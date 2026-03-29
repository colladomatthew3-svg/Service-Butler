# Service Butler Operator Command Center Brief

Status: Draft for execution
Audience: Product, Design, Frontend, QA
Scope: Docs only, no app code

## Design Reference Takeaways from `/tmp/franchise-hub-orchestra`

Borrow the strongest parts of the Lovable-style reference:

- Clean shell with a persistent left rail and a simple top surface
- Strong type contrast with a calm body font and a more expressive display font
- Soft, readable panels instead of aggressive admin chrome
- Clear sectioning, not visual noise
- Data surfaces that feel premium, calm, and immediately scannable

Adapt those patterns to a different product truth:

- Service Butler is not a marketing site or general CRM
- Service Butler is a demand command center for operators
- Every surface should optimize for action, trust, and booked jobs

## What Must Feel One-of-a-Kind

The product should feel unlike a commodity CRM in four ways:

- It shows live demand, not just records
- It explains why a lead matters
- It makes the next action obvious
- It treats booked jobs as the real unit of value

## Implementation Brief

### 1. Shell

- Use a stable operator shell with a strong left navigation rail and a compact top command bar
- Make the shell feel like a workspace, not a website
- Keep the main canvas wide and calm, with enough breathing room for evidence and action
- Reduce repeated card nesting and heavy borders

### 2. Typography

- Use a clear display/body contrast that feels premium and readable under pressure
- Headlines should be short and decisive
- Body copy should be concise enough to scan in a live workflow
- Operator labels should be direct, not SaaS-y
- Avoid overusing all caps and dense label stacks

### 3. Navigation Model

- The nav should reflect the operator mental model, not internal product structure
- Priority order should be:
  - Command center
  - Scanner
  - Verified leads
  - Pipeline
  - Jobs
  - Territories
  - Outbound
  - Data sources
- Keep the active state obvious and the hierarchy shallow
- Surface only the routes that help an operator work the day

### 4. Map and Data Presentation

- The map should be a situational awareness tool, not decoration
- Pair map context with a tight data rail showing:
  - Territory
  - Demand level
  - Source mix
  - Confidence
  - Next action
- Use summary strips for the important numbers instead of a wall of charts
- Keep geographic data close to operational actions, not separated from them

### 5. Trust and Provenance Surfaces

- Every opportunity and lead should show source, freshness, verification state, and evidence
- Trust should be visible where the decision is made, not hidden in detail views
- Explain why the lead exists in one sentence
- Surface compliance or terms status when it matters
- Make uncertainty explicit, especially for review-only records

### 6. Operator-First Lead Engine

- The primary journey is signal -> verified lead -> action -> booked job
- The product should reward speed to contact and speed to booking
- Call, text, schedule, and convert actions should feel like operational tools, not generic buttons
- The UI should always answer: what is happening, why does it matter, what do I do now?

## Recommended Structure for the Next UX Wave

1. Command center home
2. Scanner as live demand feed
3. Verified lead queue
4. Territory and map intelligence
5. Job and pipeline progression
6. Trust and evidence details

## Top Recommendations

1. Make the shell feel like an operator workspace, with a persistent rail and a calm, high-signal command bar.
2. Treat typography as a trust tool, with fewer labels and stronger hierarchy.
3. Rework navigation around the operator workflow, not the product catalog.
4. Use map and data together as a decision surface, not two separate experiences.
5. Make provenance visible at the point of action so every lead can be trusted quickly.

## Implementation Targets

- The scanner should read like a command center
- The inbox should read like a verified queue
- The map should support territory decisions
- The UI should feel premium, calm, and operator-first
- The product should no longer feel like a commodity CRM

## Validation Questions

- Does this feel like a workspace for operators?
- Can I tell why this lead matters in one glance?
- Is the next action obvious?
- Does the map help me make a routing decision?
- Would a dispatcher trust this screen during a live day?

