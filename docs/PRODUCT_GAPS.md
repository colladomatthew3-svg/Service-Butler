# Product Gaps Blocking Revenue

## 1. The operator story is still too broad
The dashboard and navigation still expose more platform surface area than a pilot customer needs. The product needs one unmistakable command board centered on:
- today's opportunities
- leads ready to contact
- jobs scheduled or in progress
- revenue pipeline
- source proof and freshness

## 2. Research opportunities and contactable leads are not separated strongly enough everywhere
The repo has the right concepts, but the product contract needs to stay explicit on every operator-facing surface:
- `research opportunity` is not the same as a lead
- `verified/contactable lead` is the minimum bar for automated outreach
- only real/contactable rows should count toward revenue proof

## 3. Source truth is still too easy to overstate
Several connectors are legitimate architecturally but remain provider-dependent, partial, or simulated in practice. This blocks trustworthy sales claims unless the product clearly identifies:
- live-safe source families
- partially live source families
- simulated/demo-only sources
- proof-eligible versus non-proof-eligible capture

## 4. Release validation can still be too forgiving
Even with strong readiness infrastructure, pilot readiness is still at risk when scripts or operators read a simulated result as success. Pilot release rules must fail closed when:
- source truth is simulated
- integration validation runs without real Supabase/operator context
- safe-mode state is ambiguous
- buyer-facing counts include demo/sample/synthetic rows

## 5. Revenue metrics need to be first-class
The product needs one clean, persisted view of:
- opportunities generated per day
- verified/contactable leads per day
- contact rate
- response rate
- booking rate
- booked jobs
- revenue pipeline
- revenue per lead
- source-to-job attribution

These metrics should come from real stored records, not only dashboard-side summarization.

## 6. The first customer motion needs packaging, not just code
The repo has many operational artifacts, but the product is still missing a clean revenue package around one offer:
- one pilot tier
- one onboarding path
- one service area setup model
- one proof-of-value report rhythm
- one narrow promise: turn opportunities into booked jobs faster

## 7. Demo mode is useful, but it must stay isolated
Demo mode should remain for walkthroughs, but it cannot blur into proof mode. The repo still needs clear UX and release discipline so that:
- demo is for storytelling
- pilot mode is for evidence
- no buyer-safe metric includes synthetic rows

## 8. The best v1 source path is narrower than the repo’s total ambition
The architecture can support more over time, but the next 30 days should concentrate on:
- incidents
- weather-adjacent signals
- municipal/public urgency signals
- approved public incident pages
- direct verified inbound/contactable leads

Everything else should be treated as future expansion unless it is already live-safe and revenue-relevant.
