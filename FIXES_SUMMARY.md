# Fixes Summary

This is the running log of what got fixed in this session. Saved as a file
so you can scan it on your own time without a wall of text in chat.

## What's now done

### Day-1 critical (everything red and orange in both reports)

- **CR-001 → CR-004** — multi-tenancy leaks in `approvalRuleService.ts`
  closed. Cross-tenant rule mutation now correctly returns 404.
- **CR-005 → CR-008** — principals route fixed. New principals get the
  `member` role (not super-admin), status is `PENDING` (not active), input
  is Zod-validated, GET search is admin-only.
- **CR-009 + CR-032** — audit logs and CSV export tightened to admin only.
- **CR-010 + CR-011** — users + ticket-routing inputs Zod-validated, FK ids
  verified against the caller's org.
- **F-001** — `tabPanelProps` ReferenceError gone. Was stale from a
  mid-refactor; the new `<TabPanel>` component replaced it cleanly.
- **F-002** — "Maximum update depth exceeded" loop on Settings tabs fixed.
  Root cause: TeamsTab/RolesTab/MembersTab used `data ?? []` which created
  a new empty array reference every render, churning downstream useMemo +
  useEffect deps. Now uses module-level stable references.
- **F-003** — `/maintenance/compliance` no longer renders blank during
  load; renders the DashboardLayout shell with skeleton cards.
- **F-004** — `/it/erate` no longer flashes blank during the redirect.
- **F-007** — login redirect now preserves the tenant subdomain.
- **F-008** — `?tab=members` and `?tab=facilities` now work as aliases for
  `users` and `campus`.
- **F-009 + F-040** — `usePageTitle` added to compliance, work-orders,
  knowledge-base, lifecycle. The other top-level pages already had it.
- **F-011** — stopped writing `users.read` audit-log rows on every GET.
- **F-012** — every `/api/ai/*` route now goes through the chat rate
  limiter (30 req/min/IP) instead of just `assistant/chat`.
- **F-013 + F-027 + F-035** — entrance fades disabled on signup, contact,
  about, pricing, inventory, onboarding setup. Plus a global
  `<MotionConfig reducedMotion="user">` so all motion respects the
  prefers-reduced-motion accessibility preference.
- **F-014** — login school-URL input has a real label, name attribute, and
  autocomplete hint.
- **F-015** — visually-hidden `<h1>` on the Settings content panel
  announces the active tab to screen readers.
- **F-016** — canonical `<EmptyState />` component added at
  `src/components/ui/EmptyState.tsx`. Existing pages can migrate over
  time.
- **F-021** — 11 `console.error/warn` calls replaced with the structured
  `logger` across AI, events, budget, and gemini service.
- **F-029** — Settings error boundary now names the broken tab, surfaces
  the digest hash for support, and offers "Go to My Profile" as a recovery.
- **F-030** — onboarding checklist now offers a dismiss affordance once
  the user is 80% complete (was: only after all required items done).
- **F-037** — Settings page uses `router.replace` instead of raw
  `window.history.replaceState`, keeping the URL and React state in sync.
- **F-039 + F-049** — hardcoded `lionheartapp.com` redirects in
  SigninModal, /signin, and /onboarding/setup now derive the base domain
  from the current host. Localhost dev no longer breaks.
- **F-046** — login email + password fields have `name` attributes so
  password managers can autofill.
- **F-047** — member-row 3-dot action menu has a per-row aria-label
  (`Actions for {name}`) instead of the generic "Row actions".
- **LIVE-001** — server-side HTML stripping for all user-supplied name
  fields (roles, teams, schools, principals, buildings, approval rules).
- **LIVE-002** — request coalescing for `/api/auth/me` so multiple
  components don't each spawn their own fetch.
- **LIVE-003** — inactive Settings tabs use the `inert` HTML attribute via
  ref. ~70 hidden focusable elements no longer in the keyboard /
  screen-reader graph.
- **LIVE-004** — toast container has `role="status"` + `aria-live="polite"`
  so screen readers announce save/error messages.
- **UX-001 → UX-007, UX-021, UX-023, UX-029, UX-032, UX-033, UX-045** —
  silent save failures get toast errors, destructive actions get
  ConfirmDialogs, ApprovalRulesBuilder is mobile-responsive, Main Campus
  auto-create is now visible.

### Loading shells (F-005 + F-019)

Added `loading.tsx` files for `/settings`, `/dashboard`,
`/maintenance`, `/maintenance/work-orders`, `/it`. Next.js renders these
during navigation so the user never sees a blank page.

## Deferred — needs more investigation than a quick edit

- **F-005 (full SSR shell)** — partial. We added `loading.tsx` files which
  handle most blank-page cases. A complete fix would server-render the
  DashboardLayout shell on every authenticated route — a meaningful
  refactor of the layout split.
- **F-006 (wrong scroll position on work-orders)** — likely fixed
  incidentally by `loading.tsx`, but I did not verify in the browser.
- **F-010 (34 dashboard API calls)** — partial. `/api/auth/me` is now
  coalesced (LIVE-002). The athletics auto-fetch and other dashboard
  duplicates were not touched in this pass.
- **F-018 (lazy-load Settings tab chunks)** — not done. Would need to
  convert all 12 `import` statements at the top of `src/app/settings/page.tsx`
  to `next/dynamic` calls. Real work, real win.
- **F-020 (`ignoreDuringBuilds: true` for ESLint)** — not done. Removing
  the flag will surface the 99 existing eslint-disables and a likely-large
  number of warnings; that's its own task.
- **F-022 (114 `any` types)** — not done. Audit / sweep, not a single fix.
- **F-023 (93 TODO/FIXME)** — not done. Triage exercise.
- **F-024 (red/green color signals)** — not done. Run axe-core or Pa11y
  in CI; spot-check at full viewport.
- **F-026 (KB header low contrast)** — fixed by removing the entrance
  fade on the header. Color tokens are already correct.
- **F-028 (sidebar active highlight on URL nav)** — sidebar code is
  spread across 8+ files (`useSidebarSelectionState`, etc.); fixing
  cleanly requires more time than a quick edit.
- **F-031 (redundant "SETTINGS" eyebrow)** — that "eyebrow" turned out
  to be the sidebar's section header, which is correct. The audit's
  observation of "above the page title" was likely the visual layout —
  not actually redundant once you understand the structure.
- **F-033 (SSR/hydration flash)** — fixed indirectly by the
  derive-from-URL refactor in F-002.
- **F-034 (onboarding stuck loading)** — needs same
  investigation pattern as F-003/F-004; deferred.
- **F-036 (calendar URL too long)** — POST-with-body refactor, not a
  one-line fix.
- **F-038 (tenant detection on /login)** — already partially correct;
  the login page already detects `x-org-subdomain` and skips the
  school-lookup step. The audit's observation might have been a false
  positive after F-007 + F-039.
- **F-041 (maintenance "1" badge unexplained)** — couldn't locate the
  badge code in a quick grep; needs targeted investigation.
- **F-042, F-043, F-045, F-048, F-050** — pure polish items, deferred.
- **F-044 (search inputs)** — partial. MembersTab search now
  `type="search"`. ApprovalRulesBuilder search input was inside a
  multi-line tag the regex didn't match cleanly.

## Files I touched in this session

API routes, services, and middleware:
- `src/middleware.ts`
- `src/lib/services/approvalRuleService.ts`
- `src/lib/sanitize.ts`
- `src/lib/hooks/useAuth.ts`
- `src/lib/services/ai/gemini.service.ts`
- `src/app/api/settings/principals/route.ts`
- `src/app/api/settings/audit-logs/route.ts`
- `src/app/api/settings/users/route.ts`
- `src/app/api/settings/ticket-routing/route.ts`
- `src/app/api/settings/roles/route.ts`
- `src/app/api/settings/roles/[id]/route.ts`
- `src/app/api/settings/teams/route.ts`
- `src/app/api/settings/teams/[id]/route.ts`
- `src/app/api/settings/schools/route.ts`
- `src/app/api/settings/schools/[id]/route.ts`
- `src/app/api/settings/campus/buildings/route.ts`
- `src/app/api/settings/approval-rules/route.ts`
- `src/app/api/settings/approval-rules/[id]/route.ts`
- `src/app/api/settings/export/users/route.ts`

Pages and layouts:
- `src/app/layout.tsx` (tag) and `src/components/providers.tsx`
- `src/app/settings/page.tsx`
- `src/app/settings/settings-types.ts`
- `src/app/settings/error.tsx`
- `src/app/settings/loading.tsx` (new)
- `src/app/settings/ProfileTab.tsx`
- `src/app/dashboard/loading.tsx` (new)
- `src/app/maintenance/loading.tsx` (new)
- `src/app/maintenance/work-orders/page.tsx`
- `src/app/maintenance/work-orders/loading.tsx` (new)
- `src/app/maintenance/compliance/page.tsx`
- `src/app/maintenance/knowledge-base/page.tsx`
- `src/app/it/page.tsx`
- `src/app/it/loading.tsx` (new)
- `src/app/it/erate/page.tsx`
- `src/app/inventory/page.tsx`
- `src/app/events/page.tsx`
- `src/app/athletics/page.tsx`
- `src/app/login/SchoolLookup.tsx`
- `src/app/login/LoginForm.tsx`
- `src/app/SigninModal.tsx`
- `src/app/signin/page.tsx`
- `src/app/onboarding/setup/page.tsx`

Components:
- `src/components/Toast.tsx`
- `src/components/RowActionMenu.tsx`
- `src/components/ui/EmptyState.tsx` (new)
- `src/components/ui/index.ts`
- `src/components/onboarding/ChecklistWidget.tsx`
- `src/components/settings/SecuritySettingsSection.tsx`
- `src/components/settings/BillingTab.tsx`
- `src/components/settings/billing/CancelSubscriptionSection.tsx`
- `src/components/settings/school-info/EventBufferSection.tsx`
- `src/components/settings/integrations/TwilioCard.tsx`
- `src/components/settings/integrations/GoogleCalendarCard.tsx`
- `src/components/settings/integrations/MicrosoftCalendarCard.tsx`
- `src/components/settings/integrations/PlanningCenterCard.tsx`
- `src/components/settings/ApprovalRulesBuilder.tsx`
- `src/components/settings/AddOnsTab.tsx`
- `src/components/settings/SchoolsManagement.tsx`
- `src/components/settings/TeamsTab.tsx`
- `src/components/settings/RolesTab.tsx`
- `src/components/settings/members/MembersTab.tsx`
- `src/components/settings/members/MemberListTable.tsx`
- `src/components/ai/ConversationSidebar.tsx`
- `src/components/ServiceWorkerRegistration.tsx`
- `src/components/events/LocationPicker.tsx`
- `src/components/events/EventDashboard.tsx`
- `src/components/events/dayof/DayOfDashboard.tsx`
- `src/components/events/budget/BudgetExpenseDrawer.tsx`
- `src/components/events/budget/BudgetLineItemTable.tsx`

CLAUDE.md updated with the "talk like a normal person" preference.

## Verification

- TypeScript compile: clean (`tsc --noEmit` exits 0).
- Browser sanity check: Settings + sub-tabs load with no console errors.
- 16/16 live API smoke tests pass (auth boundary, multi-tenancy 404 on
  fake IDs, principals creation, validation, XSS sanitization, etc.).
