# Marketing Site Audit, May 25 2026

Scope: live `www.lionheartapp.com` homepage, pricing, about, and contact pages.

Skills used as lenses: Impeccable, Emil design engineering, GPT Taste, High-End Visual Design, Page CRO, Copywriting.

## Biggest Fixes

| Before | After | Why |
| --- | --- | --- |
| Hero says "School operations infrastructure for absolutely everyone." | Use a clearer outcome: "Run school operations from one shared workspace." | The current line sounds impressive, but a cold school buyer has to translate it. Say the job Lionheart does. |
| Homepage shows two large product demos before the problem section. | Keep one hero demo, then move the second demo below the "twelve tools" problem. | On mobile the top story takes about 2,500px before the next argument. Too much before the visitor knows why they should care. |
| Pricing appears very far down the mobile homepage, around 12,300px. | Add a compact pricing teaser right after the problem section. | Price is a major objection. Let serious buyers answer "can we afford this?" sooner. |
| Homepage has 12 module cards in a long equal grid. | Group modules into 4 outcomes: plan the day, fix the campus, communicate clearly, collect forms/payments. | Twelve same-weight cards feels like a feature inventory. Buyers need a mental model. |
| Homepage and pricing page use different navs, button shapes, and visual tone. | Use one public marketing shell for homepage, pricing, about, and contact. | The pricing page currently feels like a separate template, which lowers trust. |
| Leo section uses gradient text and large blurred color blobs. | Use solid type, one restrained accent, and product UI as the visual proof. | Gradient text and decorative blobs read generic. The product is stronger than the decoration. |
| About page is mostly broad claims. | Add concrete founder/context proof, screenshots, or one real story. | "Built by educators for educators" needs evidence. Specifics build trust without fake testimonials. |
| Contact page logs a public 401 from `/api/auth/me`. | Prevent auth bootstrap calls on public marketing routes, or silence expected unauthenticated checks. | Console noise is not visible to users, but it hides real production errors. |

## Quick Wins

1. Change the hero headline and subheadline.

Suggested copy:

```text
Run school operations from one shared workspace.

Tickets, work orders, events, forms, messages, approvals, and payments stay connected, so staff stop chasing updates and everyone knows what happens next.
```

2. Rename the primary CTA everywhere to the same phrase.

Use `Start 30-day trial` or `Create school workspace`. Avoid mixing `Get Started`, `Start Free Trial`, and `Start your 30-day free trial`.

3. Add a short "who this is for" line above the hero CTA.

Example:

```text
For K-12 leaders, office teams, IT, facilities, athletics, and teachers.
```

4. Keep the honest proof stance.

Do not add fake trust logos or fake testimonials. Use proof you can own:

```text
Built for K-12 operations: unlimited users, role-based access, passkeys, audit logs, daily backups, and U.S.-based support.
```

5. Fix the pricing page hero.

Current: "Simple, transparent pricing."

Stronger:

```text
One flat platform price. Unlimited staff.
```

Subcopy:

```text
Start with the core school operations workspace, then add athletics, messaging, registration, fleet, or premium support only when you need them.
```

## High-Impact Changes

1. Reorder the homepage.

Recommended flow:

```text
Hero
Problem: schools run on too many tools
Outcome groups
One product demo
Pricing teaser
Leo AI
FAQ
Final CTA
```

The current page has strong pieces, but the argument is too long before it reaches price and decision support.

2. Redesign the module grid.

Replace the 12 equal cards with 4 outcome panels:

```text
Plan the school day: events, calendar, approvals, rooms
Fix what breaks: maintenance, IT, assets, fleet
Keep people aligned: messaging, notifications, mobile
Collect what matters: forms, registration, payments, reports
```

Then list the detailed modules inside each panel.

3. Make pricing feel native to the homepage.

The homepage uses a refined product-story style. The pricing page uses a more generic SaaS layout. Bring over the homepage typography, CTA language, and card treatments.

4. Make mobile shorter.

Observed mobile page heights:

```text
Homepage: about 17,210px
Pricing: about 10,626px
```

Those are not automatically bad, but the mobile homepage has too many large product visuals before the first major conversion decision. Collapse or defer some mockups.

5. Add real product screenshots or short screen recordings.

The current mockups are polished, but they feel simulated. One real admin dashboard crop, one work order, and one event approval flow would make the page more believable.

## Source Areas

- Homepage hero copy and CTA: `src/app/page.tsx`, around lines 168 to 263.
- Hero product motion and mobile clipping risk: `src/app/page.tsx`, around lines 700 to 750.
- Trust/proof strip: `src/app/page.tsx`, around lines 1157 to 1209.
- Leo gradient text and ambient blobs: `src/components/landing/BottomSections.tsx`, around lines 11 to 70.
- Shared public nav mismatch: `src/components/public/PublicNav.tsx`, around lines 5 to 40.
- Pricing hero and cards: `src/app/pricing/page.tsx`, around lines 344 to 430.
- Pricing final CTA: `src/app/pricing/page.tsx`, around lines 745 to 791.
- About page positioning: `src/app/about/page.tsx`, around lines 24 to 100.

## Suggested Tests

1. Test hero headline:

Variant A:

```text
Run school operations from one shared workspace.
```

Variant B:

```text
Stop running your school on twelve different tools.
```

2. Test CTA:

Variant A:

```text
Start 30-day trial
```

Variant B:

```text
Create school workspace
```

3. Test homepage order:

Variant A: current flow.

Variant B: move the "twelve tools" problem section directly under the hero and place pricing before the detailed module grid.

## Notes

Screenshots captured locally:

```text
lionheart-homepage-full.png
lionheart-homepage-mobile-full.png
lionheart-pricing-full.png
lionheart-pricing-mobile-full.png
```

No fake social proof recommended. The site should sound confident without pretending schools are already using it.
