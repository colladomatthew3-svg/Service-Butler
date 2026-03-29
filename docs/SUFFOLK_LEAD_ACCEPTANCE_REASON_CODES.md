# Suffolk Lead Acceptance Reason Codes

Use these reason codes whenever a Suffolk lead is accepted, rejected, or deferred. Keep the language consistent so weekly reporting stays clean.

## Accepted

- `ACCEPTED_HIGH_INTENT`
- `ACCEPTED_GOOD_FIT`
- `ACCEPTED_BOOKABLE_NOW`
- `ACCEPTED_MULTIPLE_SIGNALS`
- `ACCEPTED_CUSTOMER_REQUEST`

## Rejected

- `REJECTED_WRONG_SERVICE_LINE`
- `REJECTED_WRONG_TERRITORY`
- `REJECTED_DUPLICATE`
- `REJECTED_BAD_CONTACT`
- `REJECTED_NO_CONTACT`
- `REJECTED_LOW_URGENCY`
- `REJECTED_LOW_CONFIDENCE`
- `REJECTED_OUT_OF_SCOPE`
- `REJECTED_COMPLIANCE`

## Deferred

- `DEFERRED_NEEDS_REVIEW`
- `DEFERRED_WAITING_FOR_CUSTOMER`
- `DEFERRED_CALL_BACK_LATER`
- `DEFERRED_NEEDS_ENRICHMENT`

## Required operator note fields

When a lead is accepted or rejected, capture:

- Short operator note
- Who made the decision
- Timestamp
- Whether follow-up was assigned
- Whether the lead was passed to outreach or booked directly

## Usage rules

- Use one primary reason code per decision.
- Add a short note if the reason is not obvious.
- Do not invent new codes during the pilot unless the ops lead approves them.
- Keep rejected reasons specific enough to improve future scoring and routing.

## Weekly review mapping

The weekly proof-of-value report should group outcomes by:

- Accepted
- Rejected
- Deferred
- Booked job
- No response
- Follow-up pending
