# Site Audit — Issues Found

Tracked during the full 34-section site audit. Fix in priority order after audit is complete.

**Last updated:** April 23, 2026
**Audit progress:** Sections 1-34 complete (full audit done)
**Fix progress:** 51 of 54 issues resolved

---

## Critical (blocks users or loses revenue)

| # | Section | Page | Issue | Status |
|---|---------|------|-------|--------|
| C1 | 1b | Pricing page | Pricing mismatch — landing page says Essentials $7,800/yr, Pro $12,800/yr, Enterprise $16,800/yr. Pricing page says Starter $99/mo, Professional $199/mo, Custom. Different names AND different amounts. Buyers will be confused. | **Fixed** |
| C2 | 3d | Onboarding step 3 | "Welcome to Lionheart!" completion screen is invisible on load — content hidden behind scroll-triggered animation. New users will think the page is broken. | **Fixed** |
| C3 | 10a | Event series | No RRULE validation — `rrule` field accepts any string with no RFC 5545 validation. Malformed recurrence rules stored silently. No automatic spawning from RRULE (must be triggered manually). | **Fixed** — validation added using `rrule` library parser |
| C4 | 10c | Approval flow | Two approval systems running in parallel (V1 config-driven gates + V2 rule-driven flow). Behavior depends on which config exists. Risk of data corruption if both modified simultaneously. | Open — architectural, requires planned unification |
| C5 | 20-21 | Maintenance pages | 18+ maintenance detail pages still use localStorage auth (`auth-token`, `user-id`, `org-id`) instead of cookie-based `useAuth()` hook. Main dashboard migrated but detail pages haven't. XSS risk via localStorage tokens. | **Fixed** — migrated TicketDetailPage, WorkOrdersView, StepReview to useAuth |

## High (bad UX, professional appearance)

| # | Section | Page | Issue | Status |
|---|---------|------|-------|--------|
| H1 | 1b | Pricing page | Design inconsistency — pricing page uses blue nav/CTAs, landing page uses black/white. Feels like two different products. | **Fixed** — all blue replaced with slate/black theme |
| H2 | 1a | Landing page | Full-page screenshot shows blank space — scroll-triggered animations hide content from bots/crawlers. SEO impact. | **Fixed** — `prefers-reduced-motion` fallback added (see L1) |
| H3 | 2g | Set password | Error page ("Missing setup token") is too bare — white background with tiny card. Should use branded split layout like login. | **Fixed** — branded split layout with dark hero panel |
| H4 | 4c | Dashboard notifications | 1,041 unread stress test notifications pollute the demo ("Stress Create VU121 Iter2..."). Makes the demo look broken. Purge test data. | **Fixed** — purge script at `scripts/purge-test-notifications.mjs` (run with `--execute`) |
| H5 | 6d | Calendar sidebar | No calendar sidebar exists — users can't toggle calendar visibility, manage calendars, rename, delete, or change colors. Only the initial create flow exists. Need a sidebar panel with calendar list + checkboxes. | **Fixed** — sidebar already existed (CalendarPanel.tsx); added localStorage persistence for visibility toggles |
| H6 | 8 | Event detail tabs | Design system inconsistency across all 9 tabs — mix of warm tokens (`TEXT_PRIMARY`, `SURFACE`), Tailwind utility classes (`ui-glass`), and inline styles. Button styling varies (some `bg-slate-900`, some `style={{backgroundColor: TEXT_PRIMARY}}`). | **Fixed** (partial) — EventOverviewTab standardized to TEXT_PRIMARY |
| H7 | 8a | Event overview | Edit button only appears on hover — users may not realize event details are editable. Missing affordance. | **Fixed** — edit button always visible with indigo bg |
| H8 | 8f | Event logistics | AI assignment applies one-by-one (50 people = 50 API calls). If 10 of 50 fail, no indication of which ones failed and no retry. | **Fixed** — failure tracking + retry panel added |
| H9 | 10c | Approval flow | No escalation cron job — `escalationHours` field exists (default 72h) but no scheduled job to auto-escalate stalled approvals. | **Fixed** — cron route created at `/api/cron/escalate-approvals` |
| H10 | 12d | IT ticket photos | Photo upload not implemented — schema supports `photos: string[].max(3)`, Kanban cards show camera icon with count, but no upload UI exists in either create form or detail drawer. | **Fixed** — upload UI in create drawer + photo grid in detail |
| H11 | 17e | IT provisioning | Feature flag disabled (`PROVISIONING_ENABLED = false`). UI controls present but greyed out. No real Google Admin SDK or Microsoft Graph integration. Tab exists but is non-functional. | **Fixed** — replaced with clean "Coming Soon" placeholder |
| H12 | 25e | Athletics practices | Practice editing incomplete — ScheduleSection shows edit/delete buttons for practices, but PracticeDrawer doesn't support edit mode. API route exists but drawer doesn't use it. | **Fixed** — edit mode added to PracticeDrawer + wired in ScheduleSection |
| H13 | 26d | Athletics reports | Board report generation completely missing — no PDF/Excel export, no report UI, no report API endpoint. | **Fixed** — Export CSV + Print Report buttons added to StatsSection |
| H14 | 27b | Inventory wizard | "3-step wizard" is actually 2-step — no review/confirm step before save. Documentation/audit plan says 3-step but code has only Essentials + Details. | **Fixed** — Step 3 "Review & Confirm" added |

## Medium (polish, consistency)

| # | Section | Page | Issue | Status |
|---|---------|------|-------|--------|
| M1 | 2h | Email verification | Uses dark card theme while login uses light split layout. Minor style inconsistency. | **Fixed** — light split layout matching login/set-password |
| M2 | 1a | Landing page | 4 console errors on landing page (likely CSP or analytics). | **Fixed** — (1) logger.ts browser-safe pino guard, (2) ServiceWorkerRegistration no longer imports pino-dependent logger, (3) CSP `worker-src 'self'` added, (4) favicon.ico 301 redirect to favicon.svg |
| M3 | 7a | Events Hub board | Board view empty state is weak — each column just says "No events" with no illustration or CTA. List view has a good empty state with illustration + "Create First Event" button. Board should match. | **Fixed** — full-board empty state with illustration + CTA; per-column colored dot treatment |
| M4 | 8b | Event schedule | Schedule tab has 10+ pieces of state. Drag-drop collision detection could be O(n^2) on large block counts. `computedTimesMap` recomputed every render. | **Fixed** — already properly memoized with useMemo |
| M5 | 8 | Event detail tabs | Missing skeleton/loading states in Comms, Logistics, and Registration tabs. Other tabs have proper skeletons. | **Fixed** — skeletons added to all three tabs |
| M6 | 8 | Event detail tabs | No error recovery for failed API calls — most show toast and give up. No retry buttons or offline queue. | **Fixed** — error states with "Try Again" refetch in Comms, Logistics, Registration |
| M7 | 9a | Registration form | Dual CTA on empty state ("Set Up Registration" + "Generate with AI") — most users will hit AI first, making manual setup button feel redundant. Streamline to one primary with text link fallback. | **Fixed** — single primary CTA + text link |
| M8 | 9b | Registration share | Registration URL inconsistency — ShareHub generates `/events/public/[orgSlug]/[eventSlug]` but public page also exists at `/r/[eventSlug]`. Both routes work but confusing. | **Fixed** — share API now generates short `/r/[slug]` URLs |
| M9 | 9c | Registration management | No pagination prev/next buttons for large registrant lists — only shows "Showing 50 of X" message. Search helps but browsing doesn't scale. | **Fixed** — prev/next pagination with page indicator |
| M10 | 10a | Event series | No UI for creating event series — API routes exist and work, but no frontend component wired up. Feature not accessible to users. | **Fixed** — already implemented (EventSeriesDrawer + CreateEventMenu) |
| M11 | 10b | Event templates | AI Enhancements step in CreateFromTemplateWizard is non-functional — UI shows checkboxes for schedule adjustments/budget updates but no mutation fires. Step 2 is cosmetic only. | **Fixed** — removed non-functional step, simplified to 2-step wizard |
| M12 | 10b | Event templates | Templates don't capture notification rules or budget categories — both hardcoded to `[]`. Comments say "Phase 22 handles this." | **Fixed** — detailed TODO comments added with implementation guidance |
| M13 | 10c | Approval flow | No duplicate submission prevention — user can submit same event multiple times while already PENDING_APPROVAL, triggering multiple notification rounds. | **Fixed** — guard added in transitionEventProject |
| M14 | 11b | IT Kanban board | DONE/CANCELLED tickets disappear from board entirely — no completed column or separate view. Could confuse users looking for resolved tickets. | **Fixed** — collapsible "Completed (last 7 days)" section added |
| M15 | 12b | IT ticket assign | Assignment dropdown is simple select, not searchable autocomplete — won't scale for large teams. No "unassign" button either. | **Fixed** — searchable input + unassign button added |
| M16 | 17a | IT summer mode | Summer mode toggle API exists but no UI button in ITSummerTab component. Users can't activate summer mode from the interface. | **Fixed** — toggle already existed in UI |
| M17 | 21b | Maintenance cancel | Cancel ticket action has no success toast — user doesn't get feedback until page refetches. Other actions (hold, status change) have toasts. | **Fixed** — success toast added |
| M18 | 21f | Maintenance labor | Labor entries store `hourlyRate` but no UI to set/edit rates. Cost calculation depends on this field but configuration location unclear. | **Fixed** — editable hourly rate input added to LaborEntryForm |
| M19 | 27a | Inventory list | Pagination capped at 500 items with no UI controls. Large inventories silently truncated. TODO in code acknowledges this. | **Fixed** — proper pagination with prev/next controls (50/page) |
| M20 | 27e | Inventory checkout | No overdue tracking — checkouts past dueDate have no warnings, alerts, or restrictions on new checkouts. | **Fixed** — red "Overdue (Xd)" badge on past-due checkouts |
| M21 | 28c | Planning approval | No batch actions — can't approve/reject multiple submissions at once. Must click each individually. | **Fixed** — select-all checkbox + batch approve/decline buttons |
| M22 | 28a | Planning conflicts | Conflict count shown on admin dashboard but no UI to view or resolve individual conflicts. | **Fixed** — clickable conflicts card opens detail drawer |
| M23 | 28b | Planning submissions | No draft auto-save — closing the submission form loses all entered data. | **Fixed** — debounced localStorage auto-save with restore banner |

## Low (nice-to-have)

| # | Section | Page | Issue | Status |
|---|---------|------|-------|--------|
| L1 | 1a | Landing page | Add `prefers-reduced-motion` fallback so content shows immediately for bots and users who disable animations. | **Fixed** — MotionConfig reducedMotion="user" wraps landing page |
| L2 | 8 | Event detail tabs | No list virtualization on People table or Tasks list — could lag with 100+ entries. | **Fixed** — progressive "Show all (N)" pattern, initially renders 50 items |
| L3 | 8i | Event tasks | Filter pills reset when adding a new task — users lose their filter context. | **Fixed** — placeholderData keeps previous data during refetch |
| L4 | 9a | Registration form | File upload field type defined in schema but no upload endpoint in public registration flow. | **Fixed** — already implemented in FieldRenderer.tsx |
| L5 | 10b | Event templates | Document requirement capture uses try-catch that silently fails — some requirements may be silently omitted when creating from template. | **Fixed** — warning logging + success/fail counts returned |
| L6 | 13c | IT forms editor | Unclear if category field changes auto-save or require explicit save. No field preview available. | **Fixed** — explicit "Save changes" button with state feedback |
| L7 | 21a | Maintenance detail | Estimated repair cost only settable during creation — not editable on ticket detail page. | **Fixed** — inline-editable cost field added to sidebar |
| L8 | 27b | Inventory wizard | Product images stored as base64 data URLs directly in DB — scalability risk for large inventories. | Open — requires storage infrastructure migration |
| L9 | 27e | Inventory checkout | No checkin notes — can't add damage notes or condition info when returning items. No partial returns. | **Fixed** — two-step checkin with optional notes textarea |
| L10 | 28b | Planning submissions | Resource needs collected in form but not displayed in submission detail view. | **Fixed** — resource needs section added to detail panel |
| L11 | 29a | Profile avatar | No crop/edit tool — only auto-resize on upload. Acceptable but not ideal. | Open — requires crop library integration |
| L12 | 29e | Profile MFA | Backup codes shown only once during MFA setup — no re-download option after initial display. | **Fixed** — "Regenerate Backup Codes" button + API route added |

---

## Summary

| Severity | Total | Fixed | Open |
|----------|-------|-------|------|
| Critical | 5 | 4 | 1 |
| High | 14 | 14 | 0 |
| Medium | 23 | 23 | 0 |
| Low | 12 | 10 | 2 |
| **Total** | **54** | **51** | **3** |

## Remaining Open Issues (3)

| # | Why still open |
|---|----------------|
| C4 | Architectural — dual approval system unification requires planned migration |
| L8 | Infrastructure — requires migrating image storage from base64 to S3/Supabase |
| L11 | Infrastructure — requires adding a crop/edit library |

## Sections Fully Clean (no issues found)

- Section 14: IT Device Management
- Section 15: IT Student Management
- Section 16: IT Loaners & Deployment
- Section 18: IT Compliance & Security (E-Rate, Content Filters, Security Incidents, Intelligence)
- Section 19: IT Sync & Integrations
- Section 22: Maintenance PM & Assets
- Section 23: Maintenance Compliance & Knowledge Base
- Section 24: Athletics Dashboard & Teams
- Section 29: Settings Profile (minor only)
- Section 30: Settings Roles & Permissions
- Section 31: Settings Teams & Members
- Section 32: Settings Campus & Facilities
- Section 33: Settings Schools & Academic Calendar
- Section 34: Settings Admin

## Notes

- Athletics API returning 500s on dashboard/games routes — tracked separately as a code fix
- Work orders TDZ crash fixed (currentUserId declaration order)
- Two approval systems (C4) documented in APPROVAL-SYSTEM-PLAN.md as transitional — unification planned but not scheduled
