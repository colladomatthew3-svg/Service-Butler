# Suffolk Verified Lead Criteria

This document defines the operator-safe standard for a lead to be treated as verified in the Suffolk restoration pilot.

## Purpose

Verified leads are the small set of opportunities that RevOps and the operator should prioritize first. The goal is not raw volume. The goal is contactable, compliant, locally relevant leads that can realistically turn into booked jobs.

## Statuses

### `verified`

A lead may be marked `verified` when all of the following are true:

- A usable contact channel exists, such as phone or email
- The contact data is not placeholder data
- Compliance status is approved
- The source event has clear provenance
- The geography matches the Suffolk operating area
- The verification score clears the current threshold

### `review`

A lead should be marked `review` when it has some useful evidence but not enough to be handed to the operator as sales-ready without a human check.

Common review reasons:

- Only one contact method is present
- Contact quality is partially verified
- Source is useful but not strong enough to auto-qualify
- Geography is plausible but not precise enough

### `rejected`

A lead should be rejected when it fails one or more hard gates.

Hard rejection examples:

- Compliance is not approved
- Contact is obviously placeholder or invalid
- The lead cannot be tied to a Suffolk-relevant service need
- The record is duplicated against an existing verified lead
- The source event is too weak or too stale to trust

## Minimum evidence pack

Every verified lead should carry an evidence pack with:

- Lead name or contact name
- Contact method used to verify the lead
- Source type and source name
- Source provenance
- Event timestamp
- Service line or likely service line
- Verification score
- Verification reasons
- Opportunity title or summary
- A short "why work it now" summary that ties the evidence back to operator action

## Review prompts for operators

When reviewing a lead, the operator should be able to answer:

- Who is this lead?
- Why do we believe the issue is real?
- Why is it relevant to Suffolk service delivery?
- What evidence supports outreach now?
- What is the first best action?

## Quality rules

- Verified leads must be explainable
- Verified leads must be contactable
- Verified leads must be reversible if a source is later found to be weak
- Verified leads must not rely on hidden heuristics
- Verified leads must be safe to export into RevOps workflows

## Weekly QA expectation

RevOps should review verified leads weekly for:

- Contactability
- Booked-job conversion
- Operator rejection reasons
- Source reliability
- Evidence completeness

If a source produces too many review or rejected leads, it should be tuned or paused before it floods the queue.
