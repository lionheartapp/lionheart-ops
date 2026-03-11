---
phase: 12-settings-and-admin-tools
plan: "02"
subsystem: payments
tags: [stripe, billing, subscription, react, nextjs, prisma]

# Dependency graph
requires:
  - phase: 12-01
    provides: Activity log and exports infrastructure, Settings tab patterns
provides:
  - Self-service billing tab in Settings with plan comparison, proration preview, and invoice history
  - 4 API routes for billing management (GET billing, POST change-plan, POST portal, GET invoices)
  - Stripe integration with graceful degradation when unconfigured
affects: [13-platform-admin, stripe-integration, billing-management]

# Tech tracking
tech-stack:
  added: [stripe@20.4.1]
  patterns:
    - Stripe graceful degradation: check for STRIPE_SECRET_KEY before every Stripe call; return SERVICE_UNAVAILABLE (503) if missing
    - Proration preview pattern: POST /change-plan with preview=true returns estimate; preview=false executes
    - Stripe customer creation on-demand: create customer when first upgrade attempted if stripeCustomerId is null
    - Stripe portal error handling: explicit inline error message when stripeCustomerId is null (not silent failure)

key-files:
  created:
    - src/app/api/settings/billing/route.ts
    - src/app/api/settings/billing/change-plan/route.ts
    - src/app/api/settings/billing/portal/route.ts
    - src/app/api/settings/billing/invoices/route.ts
    - src/components/settings/BillingTab.tsx
  modified:
    - src/components/Sidebar.tsx
    - src/app/settings/page.tsx
    - package.json

key-decisions:
  - "Stripe graceful degradation: missing STRIPE_SECRET_KEY returns 503 SERVICE_UNAVAILABLE, not a crash"
  - "Proration preview uses Stripe invoices.createPreview (v20+); falls back to full plan price on error"
  - "stripeCustomerId checked on both Subscription and Organization tables to cover all cases"
  - "Portal inline error: text-red-600 shown below button for 5 seconds when no billing account configured"
  - "Stripe v20 API casts required for current_period_start/end fields (type mismatch vs Stripe v16 types)"

patterns-established:
  - "Billing settings tab: always fetch subscription + plans together on mount; invoices fetched separately (non-critical)"
  - "Plan card grid: 1 col mobile, 2 cols md, 3 cols lg, 4 cols xl; current plan has border-primary-500 + badge"
  - "Portal button: POST /billing/portal -> window.open(url, '_blank'); inline error for stripeCustomerId=null"

requirements-completed: [SET-02]

# Metrics
duration: 18min
completed: 2026-03-11
---

# Phase 12 Plan 02: Billing and Subscription Management Summary

**Self-service billing management tab with Stripe integration: plan comparison, proration preview, invoice history, and Customer Portal with graceful degradation when Stripe is unconfigured**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-11T15:30:00Z
- **Completed:** 2026-03-11T15:48:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Built 4 API routes for complete billing management (GET subscription+plans, POST plan change with proration, POST Customer Portal, GET invoices)
- Created BillingTab component (430+ lines) with current plan card, plan comparison grid, invoice table, and payment portal management
- Wired Billing tab into Settings sidebar (CreditCard icon, between Campus and Add-ons) and Settings page with pre-mount pattern
- All routes handle unconfigured Stripe state gracefully (SERVICE_UNAVAILABLE) and log errors without crashing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create billing API routes** - `3a2e860` (feat)
2. **Task 2: Build BillingTab component and wire into Settings page + Sidebar** - `9e26a26` (feat)

**Plan metadata:** (docs commit follows this summary)

## Files Created/Modified
- `src/app/api/settings/billing/route.ts` - GET endpoint returning current subscription + all active plans
- `src/app/api/settings/billing/change-plan/route.ts` - POST plan change with proration preview; creates Stripe customer if needed
- `src/app/api/settings/billing/portal/route.ts` - POST Stripe Customer Portal session creation
- `src/app/api/settings/billing/invoices/route.ts` - GET invoice history (Stripe primary, local Payment fallback)
- `src/components/settings/BillingTab.tsx` - Full billing management UI with skeleton, plan cards, invoice table
- `src/components/Sidebar.tsx` - Added 'billing' to SettingsTab type, added CreditCard tab to workspaceTabs
- `src/app/settings/page.tsx` - Added 'billing' to Tab type, BillingTab import, pre-mount, render block

## Decisions Made
- Stripe graceful degradation: missing `STRIPE_SECRET_KEY` returns 503 SERVICE_UNAVAILABLE rather than crashing — billing is optional until configured
- Proration preview uses `stripe.invoices.createPreview` (Stripe v20+ API); falls back gracefully to full plan price if that call fails
- `stripeCustomerId` checked on both `Subscription` and `Organization` tables to cover all cases (some orgs may have customer but no active subscription)
- Portal inline error uses `text-red-600 text-sm` below button, auto-clears after 5 seconds on retry — visible but not alarming
- Stripe v20 type casts required for `current_period_start/end` fields since the TypeScript types don't match the actual runtime shape

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Stripe v20 API type incompatibilities**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** `stripe.invoices.retrieveUpcoming` doesn't exist in Stripe v20 (renamed to `createPreview`); `current_period_start/end` type mismatch; `contactEmail` not in Organization schema
- **Fix:** Used `createPreview` with type cast; removed `contactEmail` (only `name` and `stripeCustomerId` needed); cast subscription results to extract period fields
- **Files modified:** `src/app/api/settings/billing/change-plan/route.ts`
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** `3a2e860` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — Stripe v20 API type fixes)
**Impact on plan:** Required correction for TypeScript compatibility. No scope creep.

## Issues Encountered
- Stripe v20 (installed: 20.4.1) introduced API changes: `stripe.invoices.retrieveUpcoming` renamed to `createPreview`, and subscription response types changed for `current_period_start/end`. Fixed with type assertions and correct method names.

## User Setup Required
Stripe requires manual configuration before billing features are functional:
- Add `STRIPE_SECRET_KEY` to environment variables (Vercel dashboard)
- Add `STRIPE_WEBHOOK_SECRET` if not already configured
- Create products and prices in Stripe dashboard, then link `stripePriceId` to `SubscriptionPlan` records via the platform admin panel

Without `STRIPE_SECRET_KEY`, the Billing tab shows a friendly "Billing Not Configured" message — no errors thrown.

## Next Phase Readiness
- Billing tab complete and accessible to org admins with `settings:billing` permission
- Stripe Customer Portal handles payment method management without additional code
- Platform admin panel (phase 13) can create/manage `SubscriptionPlan` records and link `stripePriceId`
- No blockers for subsequent phases

---
*Phase: 12-settings-and-admin-tools*
*Completed: 2026-03-11*
