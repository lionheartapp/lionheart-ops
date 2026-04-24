# Site Audit — Issues Found

Tracked during the full 34-section site audit. Fix in priority order after audit is complete.

**Last updated:** April 23, 2026
**Audit progress:** Sections 1-7 complete

---

## Critical (blocks users or loses revenue)

| # | Section | Page | Issue | Status |
|---|---------|------|-------|--------|
| C1 | 1b | Pricing page | Pricing mismatch — landing page says Essentials $7,800/yr, Pro $12,800/yr, Enterprise $16,800/yr. Pricing page says Starter $99/mo, Professional $199/mo, Custom. Different names AND different amounts. Buyers will be confused. | Open |
| C2 | 3d | Onboarding step 3 | "Welcome to Lionheart!" completion screen is invisible on load — content hidden behind scroll-triggered animation. New users will think the page is broken. | Open |

## High (bad UX, professional appearance)

| # | Section | Page | Issue | Status |
|---|---------|------|-------|--------|
| H1 | 1b | Pricing page | Design inconsistency — pricing page uses blue nav/CTAs, landing page uses black/white. Feels like two different products. | Open |
| H2 | 1a | Landing page | Full-page screenshot shows blank space — scroll-triggered animations hide content from bots/crawlers. SEO impact. | Open |
| H3 | 2g | Set password | Error page ("Missing setup token") is too bare — white background with tiny card. Should use branded split layout like login. | Open |
| H4 | 4c | Dashboard notifications | 1,041 unread stress test notifications pollute the demo ("Stress Create VU121 Iter2..."). Makes the demo look broken. Purge test data. | Open |
| H5 | 6d | Calendar sidebar | No calendar sidebar exists — users can't toggle calendar visibility, manage calendars, rename, delete, or change colors. Only the initial create flow exists. Need a sidebar panel with calendar list + checkboxes. | Open |

## Medium (polish, consistency)

| # | Section | Page | Issue | Status |
|---|---------|------|-------|--------|
| M1 | 2h | Email verification | Uses dark card theme while login uses light split layout. Minor style inconsistency. | Open |
| M2 | 1a | Landing page | 4 console errors on landing page (likely CSP or analytics). | Open |
| M3 | 7a | Events Hub board | Board view empty state is weak — each column just says "No events" with no illustration or CTA. List view has a good empty state with illustration + "Create First Event" button. Board should match. | Open |

## Low (nice-to-have)

| # | Section | Page | Issue | Status |
|---|---------|------|-------|--------|
| L1 | 1a | Landing page | Add `prefers-reduced-motion` fallback so content shows immediately for bots and users who disable animations. | Open |

---

## Notes

- Sections 8-34 pending — pick up at Section 8 (Events Project Detail Tabs)
- Athletics API returning 500s on dashboard/games routes — tracked separately as a code fix (Phase 1c uncommitted changes were pushed)
- Work orders TDZ crash fixed (currentUserId declaration order)
