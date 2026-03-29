# Suffolk Lead Quality Operations

This document explains how Suffolk Restoration Group should experience Service Butler in week one.

The product should feel valuable within the first week because it does three things clearly:

1. Surfaces real local demand before the phone rings.
2. Shows why a lead matters and whether it is worth action.
3. Connects the lead to a booked job or a clean rejection reason.

## Week-one value story

When the customer asks, "Why should I keep using this?" the answer should be:

- It helps us see service demand earlier.
- It helps us spend time on leads we can actually work.
- It helps us know which leads became revenue.

## What the customer should see

- A small queue of leads, not a flood of noise
- Clear territory and service-line fit
- A reason the lead was ranked highly
- A clear action: accept, reject, call, text, schedule, or defer
- A weekly summary of what turned into booked work
- A proof view that shows why a lead is worth working, using contact evidence, source quality, and booked-job traceability

## Daily operator review routine

Run this every business day:

1. Review new leads first thing in the morning.
2. Accept or reject each lead with a reason code.
3. Call or text the highest-confidence leads first.
4. Mark anything weak, duplicate, or off-target immediately.
5. Escalate bad routing, bad contacts, or suspicious sources the same day.

## Weekly review routine

Hold a 15-minute customer review once a week:

1. Review leads delivered.
2. Review accepted versus rejected leads.
3. Review booked jobs and attribution.
4. Review one example of a good lead and one example of a bad lead.
5. Decide which sources to keep, tune, or pause.

## Proof-of-value framing

Use this language in customer conversations:

- "Here are the leads we found early."
- "Here is why we think they matter."
- "Here is what your team did with them."
- "Here is what turned into booked work."

The dashboard read model now exposes a `lead_quality_proof` block that RevOps can use for weekly QA, including:

- verified / review / rejected lead counts
- booked jobs attributed to verified leads
- a source quality preview with keep / tune / pause recommendations
- proof samples with a short `why work it` summary
- a source trust summary so noisy feeds can be tuned or paused before they flood the queue

Do not lead with raw volume. Lead with relevance, contactability, and booked-job traceability.

## Lead quality review questions

For each lead, the operator should be able to answer:

- Is this in the right territory?
- Is this the right service line?
- Is the contact real and usable?
- Is the timing urgent enough to act?
- Do we have enough confidence to work it now?

## Keep / tune / pause rubric

### Keep

- Leads are contactable
- Leads match Suffolk territory
- Leads often turn into action or booked jobs

### Tune

- Leads are useful but arrive with incomplete context
- Leads are relevant but need better scoring or enrichment
- Leads produce mixed acceptance rates

### Pause

- Leads are not contactable
- Leads are not Suffolk-relevant
- Leads repeatedly fail compliance or provenance checks
- Leads flood the queue without helping booked-job conversion

## Support expectations

- If a lead looks wrong, the operator should know exactly who to contact.
- If the workflow breaks, the customer should know whether to pause outbound or keep working.
- If a source becomes noisy, RevOps should be able to explain what happens next.

## Success criteria for week one

- The customer can review leads every day without confusion.
- The customer can explain why a lead was accepted or rejected.
- The customer can see at least one booked-job attribution example.
- The customer can tell which sources are helping and which are not.
- The customer believes the system saves time and surfaces real work.
