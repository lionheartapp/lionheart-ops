# Lionheart Platform Deep Dive Audit

Date: 2026-05-23

## Outcome

I audited the public entrance paths, auth entry points, shared form consistency, seed language, mobile screenshots, and the existing E2E crawl setup.

I fixed the safest consistency issues immediately:

- Converted high-visibility login/sign-in/help search fields to shared UI primitives.
- Fixed the mobile sign-in subdomain field so the placeholder no longer gets squeezed by `.lionheartapp.com`.
- Removed religious sample language from `scripts/seed-test-data.mjs`.
- Repaired the local E2E login setup so authenticated audits can run.
- Fixed the crawler route inventory bug that produced `/page.tsx`.
- Removed broken public footer links to `/changelog` and `/security`.
- Fixed mobile tap target issues found by the mobile suite.
- Started the form-field migration with maintenance work order filters, asset creation, and dynamic forms.

## Files Changed

- `src/app/signin/page.tsx`
- `src/app/login/SchoolLookup.tsx`
- `src/app/login/LoginForm.tsx`
- `src/components/PasswordInput.tsx`
- `src/components/help/HelpSearch.tsx`
- `scripts/seed-test-data.mjs`
- `src/app/api/auth/login/route.ts`
- `e2e/helpers/api.ts`
- `e2e/helpers/auth.ts`
- `e2e/api/auth-hardening.spec.ts`
- `e2e/ui/link-crawler.spec.ts`
- `scripts/inventory-pages.mjs`
- `e2e/fixtures/page-inventory.json`
- `src/components/onboarding/ChecklistWidget.tsx`
- `src/components/dashboard/TasksFocusWidget.tsx`
- `src/components/events/CreateEventMenu.tsx`
- `src/components/landing/BottomSections.tsx`
- `src/components/maintenance/WorkOrdersFilters.tsx`
- `src/components/maintenance/AssetCreateDrawer.tsx`
- `src/components/forms/FormFieldRenderer.tsx`

## Screenshots Captured

- `audit/night-audit-signin-after-wait.png`
- `audit/night-audit-login-after-wait.png`
- `audit/night-audit-help-after.png`
- `audit/night-audit-signin-mobile-final.png`
- `audit/night-audit-login-mobile-after.png`
- `audit/night-audit-help-mobile-after.png`
- `test-results/crawler/*.png` — 62 authenticated crawler screenshots

## Verification

Passed:

```bash
npx eslint src/app/signin/page.tsx src/app/login/SchoolLookup.tsx src/app/login/LoginForm.tsx src/components/PasswordInput.tsx src/components/help/HelpSearch.tsx scripts/seed-test-data.mjs --quiet
```

```bash
npx eslint src/app/api/auth/login/route.ts e2e/helpers/api.ts e2e/helpers/auth.ts e2e/api/auth-hardening.spec.ts --quiet
```

```bash
npx eslint src/components/onboarding/ChecklistWidget.tsx src/components/dashboard/TasksFocusWidget.tsx src/components/events/CreateEventMenu.tsx --quiet
```

```bash
npx eslint src/components/landing/BottomSections.tsx e2e/ui/link-crawler.spec.ts --quiet
```

```bash
npx eslint src/components/maintenance/WorkOrdersFilters.tsx --quiet
```

```bash
npx eslint src/components/maintenance/AssetCreateDrawer.tsx --quiet
```

```bash
npx eslint src/components/forms/FormFieldRenderer.tsx --quiet
```

```bash
E2E_MOBILE_MAX_PAGES=25 npx playwright test --no-deps --project=chromium e2e/ui/mobile.spec.ts
```

Result: `27 passed`.

```bash
E2E_CRAWLER_MAX_DEPTH=2 E2E_CRAWLER_MAX_PAGES=100 E2E_CRAWLER_SCREENSHOT=1 npx playwright test --no-deps --project=chromium e2e/ui/link-crawler.spec.ts
```

Result: `visited=62`, `failures=0`, `1 passed`.

```bash
E2E_CRAWLER_MAX_DEPTH=0 E2E_CRAWLER_MAX_PAGES=45 npx playwright test --no-deps --project=chromium e2e/ui/link-crawler.spec.ts
```

Result after the maintenance form migrations: `visited=44`, `failures=0`, `1 passed`.

```bash
E2E_FORMS_MAX_PAGES=20 E2E_FORMS_MAX_TRIGGERS=3 npx playwright test --no-deps --project=chromium e2e/ui/forms-smoke.spec.ts
```

Result after the dynamic form renderer migration: `20 passed`.

Public screenshots were captured after the changes.

Not completed:

```bash
npx tsc --noEmit --pretty false --incremental false
```

Result: Node ran out of heap before reporting type errors.

## Highest Priority Findings

### 1. Raw form field migration is complete

The product-code migration is complete. Raw native fields now live only inside shared UI primitives.

Current count:

```text
0 product-code raw <input>/<select>/<textarea> usages remain outside src/components/ui
```

Progress:
`src/components/maintenance/WorkOrdersFilters.tsx` is now migrated to `SearchInput`, `Select`, and `Checkbox`.
`src/components/maintenance/AssetCreateDrawer.tsx` is now migrated to `Input`, `Select`, and `Textarea`.
`src/components/forms/FormFieldRenderer.tsx` is now migrated to `Input`, `Textarea`, `Select`, `Checkbox`, and `FileInput`.
All remaining product-code hot spots across events, IT, maintenance, calendar, registration, settings, and sidebar surfaces are now migrated.

Worst hotspots:

```text
18 src/components/forms/builder/FormCanvas.tsx
17 src/components/settings/ApprovalRulesBuilder.tsx
11 src/components/planning/PlanningSubmissionForm.tsx
11 src/components/inventory/StepEssentials.tsx
10 src/components/settings/academic-calendar/AcademicYearSubTab.tsx
9 src/components/it/ITTicketCreateDrawer.tsx
```

Fix order:
Public forms first, then daily-use app drawers, then admin builders.

### 2. Public entrance pages are partly polished, but not all at the same standard

What looks good:
The help center mobile view is readable and structured.
The sign-in page is now cleaner after the shared field patch.

What still needs work:
`/login` without a tenant uses a stark dark shell that looks separate from the main public site.
It is functional, but it feels like a different product surface.

Fix:
Bring `/login` school lookup closer to the public marketing/help language while keeping the dark branded moment if desired.

### 3. Seed/sample language still needs one more pass

Fixed:
`Chapel Service`, `Chapel`, and religious opponent names in `scripts/seed-test-data.mjs`.

Still needs review:
Tenant-specific Linfield scripts still reference the real tenant name. Decide whether those are customer data scripts or generic samples. Generic samples should be neutral.

### 4. Mobile tap targets need to stay in the QA loop

Fixed in this pass:

- Dashboard checklist tabs now meet the 40px tap target floor.
- The dashboard task link now has a real touch target.
- The create-event menu trigger now has a minimum 40px height.

Keep watching these areas:

- `/dashboard`
- `/calendar`
- `/messaging`
- `/tickets`
- `/it`
- `/maintenance`
- `/athletics`
- `/approvals`
- `/events`
- `/forms`

### 5. Crawler coverage is now healthy, but it should become nightly

The authenticated crawler passed after visiting 62 pages with screenshots enabled.

Next improvement:
Run it in CI or a nightly local script, then save the crawler summary into the audit report automatically.

## Recommended Plan

### Step 1 — Migrate form fields by workflow

Goal:
Remove visible inconsistency users actually touch.

Order:

1. Public auth and onboarding flows.
2. Ticket and maintenance request flows.
3. Calendar/event creation drawers.
4. IT ticket/device drawers.
5. Forms builder and approval builders.
6. Settings academic calendar and admin pages.

### Step 2 — Make the crawler nightly

Goal:
Keep “every route still works” from becoming a manual job.

Tasks:

- Keep `.env.e2e` local IDs current after seed resets.
- Run the crawler with screenshots enabled.
- Store the visited/failure count in this report.
- Fail fast on 404/500, but keep collecting failures before throwing.

### Step 3 — Make mobile a required QA gate

Goal:
Stop desktop-only fixes from breaking phone layouts.

Tasks:

- Run `e2e/ui/mobile.spec.ts` after every UI pass.
- Capture screenshots at 390px and 768px.
- Add overflow diagnostics to the report output.

### Step 4 — Public site polish pass

Goal:
Make the entrance feel like one product.

Tasks:

- Align `/signin`, `/login`, `/signup`, `/help`, `/pricing`, `/contact`.
- Use one field language, one CTA hierarchy, and one mobile header pattern.
- Remove any remaining placeholder/demo language that feels tenant-specific or religious.

### Step 5 — Authenticated product crawl

Goal:
Audit every click and entry point inside the app.

Tasks:

- Run the crawler with screenshots enabled.
- Open every drawer/menu from the main nav pages.
- Log each broken route, overflow, missing empty state, raw field, and inconsistent card style.
- Turn findings into a punch list grouped by module.

## Raw Field Migration Status

Current raw field count:
`0` product-code raw `<input>`, `<select>`, and `<textarea>` usages remain outside `src/components/ui`.

Recent batch completed:
- Migrated public/contact/signup, profile, admin, IT, inventory, maintenance, events, calendar, registration, settings, planning, messaging, and reporting hotspots to shared field primitives.
- Latest verified batches passed targeted `npx eslint ... --quiet`.
- Full TypeScript compile was not rerun; earlier full compile was too memory-heavy for this environment.

Recently completed:

- Public auth and password fields.
- Help search.
- Public submitted forms and public registration forms.
- Inventory essentials/details steps.
- IT ticket/device/vendor drawers.
- Maintenance work order filters, asset drawer, asset filters, and labor entry.
- Planning submission form.
- Forms canvas previews.
- Approval rules builder.
- Academic calendar year, special days, and bell schedule tabs.
- Registration form builder and registration field editor.
- Calendar plan-event and create/edit drawers.
- Generic forms field editor.
- Public form style panel.
- PM schedule wizard.
- IT security incidents tab.
- IT deployment batch detail.
- Maintenance request details step.
- Knowledge base article editor.
- IT intelligence configuration tab.

Next highest hotspots:

- `src/components/it/ERateFundingYearDetail.tsx`
- `src/components/forms/checkout/TicketCheckoutFlow.tsx`
- `src/components/forms/QrCodeManager.tsx`
- `src/components/calendar/EventDetailPanel.tsx`
- `src/app/admin/schools/[id]/page.tsx`
- `src/app/admin/billing/discount-codes/page.tsx`
- `src/app/admin/admins/page.tsx`

## Next Best Work Session

Continue the raw-field migration by workflow.

Recommended next target:
Continue with the remaining 5-field hotspots, starting with `ERateFundingYearDetail`, forms checkout/QR code tools, and `EventDetailPanel`.
