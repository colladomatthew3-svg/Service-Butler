# Service Butler Brand Guide

## Purpose
Service Butler should feel simple, trustworthy, readable, and operationally sharp for restoration and home service teams. The product is not a design experiment and should never drift toward low-contrast, overly technical, or overly decorative UI.

## Logo Usage
- Primary full logo asset: `/public/brand/logo.svg`
- Primary mark asset: `/public/brand/logo-mark.svg`
- Legacy archived assets remain in `/public/brand/servicebutler_logo.svg` and `/public/brand/servicebutler_icon.svg`, but header/footer/product chrome should use the approved `logo.svg` and `logo-mark.svg` pair
- Render the logo only through [src/components/brand/Logo.tsx](/Users/matthewcollado/Downloads/Service%20Butler/src/components/brand/Logo.tsx)
- Use the full logo in header, footer, login, and top-level marketing surfaces
- Use the mark only in compact product chrome where horizontal space is limited
- Do not crop, stretch, redraw, or replace the approved SVG with typed text approximations
- Preserve the white breathing room inside the four window cutouts so the house never looks like a solid green block
- Header and footer logo height target: `40px`
- Keep clear space around the lockup equal to at least half the icon height
- Do not add gradient pills, decorative blobs, or low-contrast surfaces behind the logo

## Color Tokens
- `--sb-primary`: primary CTA, active states, intent emphasis
- `--sb-primary-hover`: hover state for primary actions
- `--sb-bg`: global background
- `--sb-card`: card and panel surface
- `--sb-border`: borders and separators
- `--sb-text`: primary text color
- `--sb-muted`: secondary text color
- `--sb-primary-soft`: soft highlight surface
- `--sb-copper`: accent color for supporting emphasis only

Rules:
- Use semantic token mappings, not ad hoc color values
- Body copy must always sit on a high-contrast surface
- White text should be reserved for dark brand surfaces only
- Decorative gradients must never reduce text legibility

## Typography Scale
### Marketing
- Hero heading: `title-hero`
- Section heading: `section-title`
- Supporting copy: `text-body-lg`

### Product
- Page title: `dashboard-page-title`
- Section title: `dashboard-section-title`
- Body copy: `dashboard-body`
- Navigation/sidebar labels: `sidebar-label`

Rules:
- One clear heading per section
- Avoid stacking multiple competing headings in the same viewport
- Prefer short, direct labels over internal analytics language

## Buttons
- Primary: semantic brand background, white text, highest-priority action only
- Secondary: neutral background, border, semantic text
- Ghost: low-emphasis utility action only

Rules:
- One primary CTA per local area whenever possible
- Secondary actions must not visually overpower the primary action
- Do not introduce new button colors outside the shared button system

## Cards
- Use shared card primitives from [src/components/ui/card.tsx](/Users/matthewcollado/Downloads/Service%20Butler/src/components/ui/card.tsx)
- Standard treatment:
  - `rounded-xl`
  - `border`
  - `shadow-sm`
  - `bg-card`

Rules:
- Cards should group information, not create visual noise
- Avoid nesting too many bordered panels inside each other
- Prefer one strong content block over multiple competing mini-panels

## Spacing
- Respect shared spacing tokens in `globals.css`
- Use larger vertical spacing between sections than between controls
- Keep forms compact and scannable
- Marketing pages should breathe; dashboard pages should feel efficient

## Accessibility And Contrast
- All major headings, paragraphs, labels, and CTA text must be readable on desktop and mobile
- Avoid white or faint text on light backgrounds
- Avoid muted text for critical information
- Decorative surfaces must never reduce content contrast
- If a component looks elegant but harder to read, readability wins

## Product Content Rules
- Show addresses, neighborhoods, city/state, and distance before coordinates
- Hide lat/lon from normal users unless inside advanced controls
- Scanner and lead detail views should answer:
  - What is this opportunity?
  - Why does it matter?
  - How good is it?
  - What should I do next?

## Enrichment Rules
- Use provider-based enrichment, not hard-coded scraping
- In demo mode, simulated property/contact data must be labeled as demo
- Property/contact data must include verification or confidence status if shown
