# Settings QA — Full Report

_Generated 2026-05-03. Run against `http://demo.localhost:3004` (Springs Charter Schools demo org)._

## What we tested

Every part of the Settings area:

- **12 tabs**: Profile, School Information, Roles, Teams, Members, Facilities, Academic Calendar, Billing, Add-ons, Integrations, Activity Log, plus a hidden Approval Config.
- **58 backend endpoints** under `/api/settings/*` plus the `/api/auth/*` calls those tabs depend on.
- **80+ React components** under `src/components/settings/**`.

Three lenses were applied:

1. **Code review** — read every API route + component for bugs, security holes, multi-tenancy gaps, and `CLAUDE.md` rule violations.
2. **UX audit** — read every component for dead ends, missing empty states, hover-only actions, silent error handling, and inconsistencies.
3. **Live testing** — drove the dev server through your Chrome browser: clicked through every tab, ran 45+ API smoke tests including auth boundary and cross-tenant probes, attempted XSS injection, captured network/console for leaks.

## Headline numbers

- **Total findings: 99**
  - 🔴 Critical: **4** — fix before next release
  - 🟠 High: **21** — fix this sprint
  - 🟡 Medium: **44** — backlog this month
  - 🔵 Low: **30** — polish whenever convenient

## What works (positive findings)

- ✅ **Login + auth boundaries** — every endpoint correctly returns 401 for unauthenticated requests.
- ✅ **Cross-tenant header injection blocked** — sending a fake `X-Organization-ID` header is ignored; the server uses the org from your JWT.
- ✅ **System roles are protected** from deletion (Administrator, Member, etc. return `403 FORBIDDEN`).
- ✅ **Roles + Teams CRUD round-trip works** end-to-end (create → duplicate-detect at 409 → update → delete).
- ✅ **Retired endpoints return 410 GONE** with a helpful message pointing to the replacement (`/api/settings/campus/areas` → `/spaces`, etc.).
- ✅ **Validation works on most write endpoints** — bad payloads correctly return `400 VALIDATION_ERROR` with Zod details.
- ✅ **Most pages render fast** — Members, Roles, Teams, and Facilities show data immediately.

## The five things to fix first

### 1. Multi-tenancy leak in Approval Rules (CR-001 → CR-004)

`src/lib/services/approvalRuleService.ts` — four places where any admin in any organization can read, modify, or delete approval rules and steps belonging to a *different* organization, just by guessing the rule's ID. The service uses `rawPrisma` (which bypasses the auto-`organizationId` filter) without adding the filter back manually.

**Why this matters:** This is the only category of finding that crosses tenant boundaries. Everything else is contained to one org. Fix this first.

### 2. Silent failures across security & billing toggles (UX-001, UX-002, UX-003, UX-004)

Saving the Multi-Factor Auth requirement, the Data Processing Agreement, the Reactivate Subscription action, and the Event Buffer setting all do **`catch { /* noop */ }`**. If the server says no, the user sees nothing — they walk away thinking they saved a setting that didn't save.

**Why this matters:** Compliance attestation that silently fails to save is a real legal risk. Same for MFA enforcement.

### 3. PII over-exposure (CR-006, CR-009, CR-032)

Three places give regular Members access to data they shouldn't see:

- `GET /api/settings/principals?q=` returns names, emails, and phone numbers for any text query.
- `GET /api/settings/audit-logs` returns everyone's actions, IPs, and resource changes.
- `GET /api/settings/export/users` (CSV download) returns name/email/role/status for every member of the org.

All three are gated by `SETTINGS_READ`, which is in the default Member role. Tighten to `USERS_READ` (admin) or stricter.

### 4. Destructive actions firing without confirmation (UX-005, UX-006, UX-007, UX-033, UX-045)

Five places where one click destroys something with no "Are you sure?" dialog:

- Disconnect Google Calendar / Microsoft Calendar / Planning Center
- Remove Twilio (SMS) configuration
- Delete an Approval Rule
- Delete a passkey (could lock the user out if it's their last)
- Remove a Data Processing Agreement record

Add `<ConfirmDialog>` everywhere. The shared component already exists and is used elsewhere — these spots just don't use it yet.

### 5. Stored XSS sink in name fields (LIVE-001)

I created a role with the name `<img src=x onerror=alert(1)>` and the API stored it verbatim. React escapes it when rendering `{role.name}`, so it doesn't fire today. But the moment that name appears in:

- a welcome email
- an audit log entry shown with `dangerouslySetInnerHTML`
- a CSV export opened in an Excel spreadsheet
- a notification body or a Slack message

...you have a real stored-XSS or content-injection problem. Sanitize all user-supplied display strings server-side. Apply across roles, teams, schools, principals, buildings, and approval rules.

## The five things to fix next (UX papercuts)

These won't break anything, but they make the product feel sloppy.

1. **The Settings page is heavy on load** (LIVE-002). 32 API calls fire on a single visit. `/api/auth/me` runs 5 times, `/api/auth/permissions` runs 3 times. Add a single shared auth hook that owns the fetch.
2. **Tabs never unmount** (LIVE-003, UX-037). After clicking through everything, 100+ hidden focusable elements live in the DOM. Screen readers walk through them all. Memory grows.
3. **No live regions for screen readers** (LIVE-004). Toasts pop up visually but nothing is announced. Wrap the toast container in `aria-live='polite'`.
4. **Optimistic updates with no rollback** (UX-025). In Approval Rules and Ticket Routing, when you change a setting the UI shows it as saved immediately — but if the server actually rejects, the screen still shows your change.
5. **Dead code in Ticket Routing** (UX-009). The Staff Availability section was supposed to have add/remove buttons. The buttons exist as React components in the file but were never placed on the page. Either wire them in or delete them.

## Cross-cutting recommendations

Three patterns recur often enough to warrant a one-time fix that solves dozens of issues at once:

**A. Standardise the result-feedback contract.** Every save/delete/update should: show a skeleton during fetch, show a toast on success, show a toast on error, and never have an empty `catch`. Replace every `console.error` and `// silent` comment with a real toast call. Wire optimistic updates with `onError` rollback.

**B. Standardise destructive-action confirmation.** One shared `<ConfirmDialog>` component, used everywhere. Reserve `requireText='<orgName>'` for the truly irreversible (delete the whole org). Drop `requireText` from soft-deletes that an admin can undo from the database.

**C. Unify auth + fetch.** Remove the 16 places that read `localStorage.getItem('auth-token')` directly. Route everything through `fetchApi` from `@/lib/api-client`. This kills the cookie/JWT split, makes 401 handling consistent, and gives you a single global "session expired" surface for free.

## Tab-by-tab summary

### Cross-cutting (auth, layout, shared infra) — 16 findings (4 high, 5 medium, 7 low)

- 🟠 **LIVE-001** — Role 'name' accepts raw HTML/JS — stored XSS sink
  - *Issue:* POST /api/settings/roles with name='<img src=x onerror=alert(1)>' returned 201 and stored the name verbatim. The slug got sanitized but the displayable name did not. React escapes by default in {role.name}, but any future use in emails, audit-log messages, exports, or dangerouslySetInnerHTML becomes a real stored-XSS vector.
  - *Fix:* Sanitize / strip-tags name fields server-side before persisting. Apply across all user-supplied display strings (roles, teams, schools, principals, buildings, rules).

- 🟠 **LIVE-002** — 32 API calls fire on initial Settings page load
  - *Issue:* Single visit to /settings (Profile tab default) triggers 32 distinct API requests in network panel, including 5 calls to /api/auth/me and 3 calls to /api/auth/permissions, plus athletics/sports/teams/seasons/tournaments/games/practices/roster (none of which are settings-related but mount because of the dashboard layout).
  - *Fix:* Add a request-de-duplication layer for /api/auth/me and /api/auth/permissions (TanStack Query suspense or a single auth hook that owns the fetch). Defer athletics/dashboard fetches until those routes are visited.
  - *Where:* `src/app/settings/page.tsx + descendents`

- 🟠 **LIVE-003** — 100+ hidden focusable elements per tab — tabs never unmount
  - *Issue:* Counted with document.querySelectorAll('[hidden] button, [hidden] input, [aria-hidden=true] button, ...'): every settings tab shows 60–115 hidden focusable elements after a few tabs have been visited. Lazy-load mounts on first visit but never tears down. Headings from previously-visited tabs (Roles, Teams, Members, Facilities) all stay in the DOM.
  - *Fix:* Either render only the active tab's component (and accept the extra mount cost on switch), or wrap inactive panels with the inert attribute so they're truly removed from focus + screen reader navigation.
  - *Where:* `src/app/settings/page.tsx:312`

- 🟠 **LIVE-004** — No live regions in Settings — screen readers get no save/error announcements
  - *Issue:* document.querySelectorAll('[aria-live],[role=status],[role=alert]') = 0 on every Settings tab. Toast notifications likely render outside any aria-live container, so screen reader users hear nothing when actions succeed or fail.
  - *Fix:* Wrap the global toast container in an aria-live='polite' region (and aria-live='assertive' for error toasts). Add inline status regions next to forms for save success/error.
  - *Where:* `src/app/settings/page.tsx + ChildComponents`

- 🟡 **CR-019** — Interactive $transaction on org-scoped Prisma client (multi-tenancy hazard)
  - *Issue:* prisma.$transaction([...]) on the extended client. CLAUDE.md warns this can lose the extension on the inner tx and bypass org-scoping. Same pattern in roles/[id]/route.ts:97 and users/[id]/permissions/route.ts:150 affects org-scoped models like Role.
  - *Fix:* Switch batch ops to rawPrisma.$transaction([...]) with explicit organizationId in every where. For sequential writes, drop the transaction inside runWithOrgContext.
  - *Where:* `src/app/api/settings/users/[id]/route.ts:119`

- 🟡 **LIVE-006** — 'approval-config' tab is in VALID_TABS but not rendered in the nav
  - *Issue:* settings-types.ts lists 'approval-config' in VALID_TABS, but the rendered settings nav has 11 buttons (Profile, School Information, Roles, Teams, Members, Facilities, Academic Calendar, Billing, Add-ons, Integrations, Activity Log) — Approval Config is missing. URL ?tab=approval-config is accepted but lands on a blank panel.
  - *Fix:* Either add the Approval Config tab button to the workspace tab list, or remove 'approval-config' from VALID_TABS so the deep-link is rejected.
  - *Where:* `src/app/settings/settings-types.ts vs src/app/settings/page.tsx:20`

- 🟡 **LIVE-007** — Skeleton loaders only appear on Integrations and Activity Log
  - *Issue:* CLAUDE.md UI rules require skeleton loading (animate-pulse) during data fetches. Audit found .animate-pulse on the Integrations and Activity Log tabs only. Other data-loading tabs (Members, Roles, Teams, Facilities) flash a brief blank state.
  - *Fix:* Standardise: every tab that fetches on mount renders a skeleton matching the final layout shape until data resolves.

- 🟡 **UX-036** — localStorage-based auth headers used inconsistently with cookie auth
  - *Issue:* RolesTab, TeamsTab, MembersTab, AuditLogTab, BillingTab and several integration cards build auth headers from localStorage('auth-token'). useAuth + middleware moved to cookie-based auth. When cookie session is valid but localStorage token is missing/stale, calls 401 with no clear UI signal.
  - *Fix:* Centralize via fetchApi/getAuthHeaders helpers from @/lib/api-client and remove direct localStorage reads.
  - *Where:* `src/components/settings/RolesTab.tsx:96`

- 🟡 **UX-048** — RolesTab and TeamsTab duplicate massive reassign-on-delete logic
  - *Issue:* RolesTab (L286-379) and TeamsTab (L243-336) implement essentially the same flow: load assigned users, render bulk + per-user reassign dropdowns, gate the confirm button. ~150 lines duplicated almost verbatim.
  - *Fix:* Extract <ReassignBeforeDeleteDialog> taking { entity, entityName, assignedUsers, options, onConfirm } as a shared component.
  - *Where:* `src/components/settings/RolesTab.tsx:50`

- 🔵 **CR-024** — Components mix cookie auth with Bearer-token auth headers
  - *Issue:* 16 settings components read localStorage.getItem('auth-token') and send Authorization: Bearer ${token} — but the actual auth path uses cookies. When a user has cookies but no localStorage token, the Bearer header is 'Bearer null' (string).
  - *Fix:* Standardise on getAuthHeaders() from @/lib/api-client (already used by ProfileTab and SchoolsManagement).
  - *Where:* `src/components/settings/BillingTab.tsx:56`

- 🔵 **LIVE-012** — 401 from no-auth requests says 'Missing tenant context' — confusing
  - *Issue:* GET /api/settings/users without credentials returns 401 with message 'Missing tenant context'. The status code is right, but the message describes the org-scope mechanism rather than 'You're not signed in'.
  - *Fix:* Standardise on 'Authentication required' or 'Sign in to continue' for client-facing 401 messages.

- 🔵 **LIVE-013** — Cross-tenant header injection IS blocked (positive)
  - *Issue:* Sending X-Organization-ID: 00000000-... to GET /api/settings/users returns the same data as the legitimate org. Confirms the middleware uses the JWT-derived orgId and ignores client-supplied X-Organization-ID.
  - *Fix:* No fix needed — document this as the intended behavior so future contributors don't mistakenly trust the header.

- 🔵 **LIVE-014** — Roles + Teams CRUD round-trip works end-to-end (positive)
  - *Issue:* Create role → duplicate-detect (409) → update → delete all return 2xx with the right shape. System-role deletion correctly returns 403 FORBIDDEN.
  - *Fix:* No fix needed — keep the smoke test in CI.

- 🔵 **UX-037** — Lazy-loaded tabs are kept mounted forever
  - *Issue:* Once a tab is added to visitedTabs, it stays mounted (just hidden via CSS). Switching back is instant but every visited tab keeps its data fetches/mutations alive in the background, including Activity Log polling.
  - *Fix:* For heavy tabs (AuditLog, BillingTab with Stripe portal, Approval Rules) consider unmount-when-hidden or pause queries via TanStack Query's enabled flag.
  - *Where:* `src/app/settings/page.tsx:312`

- 🔵 **UX-044** — Unused imports
  - *Issue:* Plus is imported but never used in AddOnsTab. Minor — shows lint enforcement gap.
  - *Fix:* Remove unused imports; tighten ESLint config.
  - *Where:* `src/components/settings/AddOnsTab.tsx:7`

- 🔵 **UX-047** — Reassign user dropdown lacks descriptive aria-label per row
  - *Issue:* Each per-user reassign select uses aria-label='Reassign users to role' — same string for every row. Screen-reader user hears the same label N times with no way to distinguish which user.
  - *Fix:* aria-label={`Reassign ${displayName || user.email} to a different role`}.
  - *Where:* `src/components/settings/RolesTab.tsx:762`

### Approval Rules / Approval Config — 11 findings (4 critical, 2 high, 4 medium, 1 low)

- 🔴 **CR-001** — updateApprovalRule has no org-scope check
  - *Issue:* updateApprovalRule(id, input) calls rawPrisma.approvalRule.update({ where:{id} }). ApprovalRule is not in the org-scoped Prisma extension, so an admin in org A can mutate any approval rule in org B by guessing its id.
  - *Fix:* Use prisma.approvalRule.updateMany({ where:{id, organizationId: getOrgContextId()}, data: input }) and assert count===1, OR findFirst-then-update.
  - *Where:* `src/lib/services/approvalRuleService.ts:131`

- 🔴 **CR-002** — deleteApprovalRule has no org-scope check
  - *Issue:* rawPrisma.approvalRule.delete({where:{id}}) — same vector as CR-001. Cross-tenant rule deletion possible.
  - *Fix:* rawPrisma.approvalRule.deleteMany({ where:{id, organizationId: getOrgContextId()} }) and assert count===1.
  - *Where:* `src/lib/services/approvalRuleService.ts:140`

- 🔴 **CR-003** — updateStep / removeStep on ApprovalFlowEntry are unscoped
  - *Issue:* updateStep and removeStep use rawPrisma.approvalFlowEntry.update/delete({where:{id}}). Bypasses the org-scoped extension; cross-tenant step manipulation possible.
  - *Fix:* Use the org-scoped prisma client (which auto-injects organizationId), or add organizationId: getOrgContextId() to every where clause.
  - *Where:* `src/lib/services/approvalRuleService.ts:181`

- 🔴 **CR-004** — addStepToRule does not verify ruleId belongs to caller's org
  - *Issue:* addStepToRule({ruleId, ...}) blindly creates a flow entry with the supplied ruleId. Combined with CR-001 a caller in org A can attach steps to a rule in org B, planting team-membership references on the wrong tenant.
  - *Fix:* Before creating, verify rule with rawPrisma.approvalRule.findFirst({where:{id:ruleId, organizationId: getOrgContextId()}}). 404 if missing. Also verify supplied teamId belongs to caller's org.
  - *Where:* `src/lib/services/approvalRuleService.ts:157`

- 🟠 **UX-007** — Approval rule deletion has no confirm step
  - *Issue:* deleteRule(id) immediately fires DELETE — the delete button wipes a workflow rule with no confirmation. Steps and routing config are lost.
  - *Fix:* Add ConfirmDialog. For default catch-all rules, also warn that downstream events will fall through to the next matching rule.
  - *Where:* `src/components/settings/ApprovalRulesBuilder.tsx:340`

- 🟠 **UX-023** — Approval-rules builder uses a fixed 384px sidebar at all viewports
  - *Issue:* Two-column builder with w-96 flex-shrink-0 left panel and a flex-1 right panel. Below ~768px the right panel collapses to nothing usable.
  - *Fix:* Stack vertically below md breakpoint, or convert the left panel to a select dropdown on mobile.
  - *Where:* `src/components/settings/ApprovalRulesBuilder.tsx:485`

- 🟡 **CR-014** — Approval flow POST/PUT do not verify teamId/assignedUserId belong to the org
  - *Issue:* Schemas validate shape but the service writes supplied teamId and assignedUserId straight to DB. Org-scoped extension prevents row from being written under another org, but a caller can still attach an assignedUser from another org.
  - *Fix:* Validate teamId and assignedUserId against caller's org via prisma.team.findFirst / prisma.user.findFirst before create/update.
  - *Where:* `src/app/api/settings/approval-flow/route.ts:71`

- 🟡 **UX-024** — Rule name auto-overwritten while user is typing
  - *Issue:* The school-condition onChange handler auto-rewrites the rule name to '<schoolName> Events' if the user hasn't yet set campus/category. This silently throws away whatever name the user typed if they later picked a school first.
  - *Fix:* Only auto-name when the rule is brand new (e.g., name === 'New Rule'); never overwrite a user-typed name.
  - *Where:* `src/components/settings/ApprovalRulesBuilder.tsx:588`

- 🟡 **UX-025** — Optimistic rule edits with no rollback on failure
  - *Issue:* updateRule does optimistic cache update + background mutation; if mutation fails there's no rollback or visible error. Same pattern in TicketRoutingTab updateStrategy/updateCategory/updateStaffAvailability.
  - *Fix:* On mutation onError, rollback the cache to prior snapshot and surface a toast 'Failed to save — your change was reverted'.
  - *Where:* `src/components/settings/ApprovalRulesBuilder.tsx:345`

- 🟡 **UX-039** — Right panel shows nothing when no rule is selected
  - *Issue:* Per CLAUDE.md ('No empty states that require user action to see data'), the right panel of the builder requires picking a rule first. No auto-selection of the first/default rule on load.
  - *Fix:* Default selectedRuleId to the first rule (or default-catch-all) on first render.
  - *Where:* `src/components/settings/ApprovalRulesBuilder.tsx:575`

- 🔵 **CR-029** — Awaiting params inside handler when withAuth has already awaited it
  - *Issue:* const { id } = await params — params is already a plain object after withAuth awaited the dynamic-route Promise. Suggests confusion about Next.js 15 typing.
  - *Fix:* const { id } = params (no await).
  - *Where:* `src/app/api/settings/approval-rules/[id]/route.ts:31`

### Members — 11 findings (1 high, 4 medium, 6 low)

- 🟠 **CR-010** — Users POST has no Zod schema; weak hand-rolled validation
  - *Issue:* No email-format validation (only truthy-check). teamIds array values not verified to belong to caller's org before user creation.
  - *Fix:* Build a Zod schema (z.string().email(), enums for status/employmentType/campusScope/provisioningMode) via withAuth's schema option. Verify teamIds with prisma.team.findMany({where:{id:{in:teamIds}, organizationId:orgId}}) count check.
  - *Where:* `src/app/api/settings/users/route.ts:120`

- 🟡 **CR-017** — EditMemberDrawer calls setState during render
  - *Issue:* The component does prevUserId[1](user.id) and setEditForm(...) directly inside the render body whenever user.id changes. setState during render is a React rule violation that can produce 'Cannot update a component while rendering' warnings and infinite loops.
  - *Fix:* Replace with a proper useEffect(() => {...sync form...}, [user?.id]).
  - *Where:* `src/components/settings/members/EditMemberDrawer.tsx:40`

- 🟡 **UX-014** — useState misused to derive form state during render
  - *Issue:* useState(null) → setter called during render to sync editForm when user prop changes. Classic 'derived state' anti-pattern — fragile, fires extra renders, triggers React warnings.
  - *Fix:* Use useEffect([user?.id]) to reset the form, or use the documented derive-during-render with prev-state-comparison pattern.
  - *Where:* `src/components/settings/members/EditMemberDrawer.tsx:40`

- 🟡 **UX-015** — Invite form silently no-ops when email is blank
  - *Issue:* handleSubmit returns early on empty email with no setError. Disabled-button state hides the issue, but if the user removes the email after typing it, the form just does nothing on submit.
  - *Fix:* Use HTML required + show inline 'Email required' message; or display setError('Email is required').
  - *Where:* `src/components/settings/members/InviteMemberDrawer.tsx:41`

- 🟡 **UX-050** — Remove Member confirm requires typing 'DELETE' (heavy for soft-delete)
  - *Issue:* ConfirmDialog requires typing literal 'DELETE' for member removal. Members are soft-deleted and reversible by an admin via DB, so requiring DELETE-text feels heavy compared to actual destructiveness — and inconsistent with toggling member status which has no confirm.
  - *Fix:* Drop requireText for member removal (keep variant='danger' + clear message). Reserve requireText for hard-destructive ops like Delete Organization.
  - *Where:* `src/components/settings/members/MembersTab.tsx:254`

- 🔵 **CR-027** — User search uses contains without DB indexes
  - *Issue:* firstName/lastName/email contains: search, mode: insensitive on every keystroke. No pg_trgm GIN index. Becomes a full table scan once orgs cross a few hundred users.
  - *Fix:* Debounce client-side now. Long term, add GIN/trigram index on User.firstName, lastName, email.
  - *Where:* `src/app/api/settings/users/route.ts:33`

- 🔵 **CR-031** — Token / orgId pulled from localStorage at module-level scope
  - *Issue:* const token = ... localStorage.getItem('auth-token') is computed once on first render and never refreshed. If user re-authenticates in another tab, the existing tab keeps stale token in headers.
  - *Fix:* Read inside getAuthHeaders so each request reads current value, or rely on cookie auth.
  - *Where:* `src/components/settings/members/MembersTab.tsx:56`

- 🔵 **CR-033** — Bulk-PII audit log fires on every list-users request
  - *Issue:* Every page of users (limit 25 default) writes a users.read audit row. For an admin with the Members tab open + typing in search, that's one audit-log row per keystroke. Bloats the audit log; slows the table.
  - *Fix:* Throttle: only audit-log when search query changes meaningfully or page > 1. Move PII-bulk-access logging to a dedicated CSV-export endpoint.
  - *Where:* `src/app/api/settings/users/route.ts:102`

- 🔵 **UX-016** — Mixed error UI — banner for fetch error, toast for mutations
  - *Issue:* Fetch errors render an inline red banner with Retry; mutation errors show a toast. Inconsistent — users may not know where to look. RolesTab/TeamsTab use a top banner exclusively.
  - *Fix:* Pick one pattern per concern: toast for transient action results, inline banner for blocking-load failures.
  - *Where:* `src/components/settings/members/MembersTab.tsx:197`

- 🔵 **UX-017** — Filter rebuilt on every keystroke without memoization
  - *Issue:* filtered recomputes on every render. Each STATUS_TAB count badge re-iterates the full users array.
  - *Fix:* Memoize counts with useMemo.
  - *Where:* `src/components/settings/members/MembersTab.tsx:56`

- 🔵 **UX-038** — Export CSV uses window.open with no auth retry path
  - *Issue:* window.open opens /api/settings/export/users in a new tab. Browsers don't send Bearer header for new tabs — only works because the API also accepts the cookie. If cookies expire user gets a raw 401 page.
  - *Fix:* Stream the CSV via a fetch with credentials, then create an object URL to download — handles 401 gracefully.
  - *Where:* `src/components/settings/members/MembersTab.tsx:144`

### Ticket Routing — 8 findings (1 high, 5 medium, 2 low)

- 🟠 **CR-011** — Routing POST does not verify managerUserId/schoolId belong to the org
  - *Issue:* Caller-supplied managerUserId and schoolId written straight to ModuleRoutingConfig with no cross-org check.
  - *Fix:* Verify both via prisma.user.findFirst / prisma.school.findFirst against current org. 400 if missing.
  - *Where:* `src/app/api/settings/ticket-routing/route.ts:36`

- 🟡 **CR-012** — Routing categories PATCH does not verify specialistUserId/fallbackUserId belong to the org
  - *Issue:* Both ids accepted from body and written straight to the routing config — could pin a user from another org.
  - *Fix:* Validate both ids with prisma.user.findFirst({where:{id, organizationId:orgId}}) before update.
  - *Where:* `src/app/api/settings/ticket-routing/categories/route.ts:41`

- 🟡 **CR-013** — Escalation POST does not verify targetUserId belongs to the org
  - *Issue:* targetUserId written to EscalationRule with no cross-org check.
  - *Fix:* prisma.user.findFirst({where:{id:targetUserId, organizationId:orgId}}) before create.
  - *Where:* `src/app/api/settings/ticket-routing/escalation/route.ts:35`

- 🟡 **UX-008** — SLAInput onChange prop ignored
  - *Issue:* SLAInput accepts onChange in its type signature but never uses it; only onUpdate runs. The unused prop is misleading; SLA Resolve column wires onChange={()=>{}} showing the dev knew it was no-op.
  - *Fix:* Remove the dead onChange prop, or wire it for live cache updates.
  - *Where:* `src/components/settings/TicketRoutingTab.tsx:759`

- 🟡 **UX-009** — AddStaffButton and removeStaffMember defined but never rendered
  - *Issue:* AddStaffButton helper and removeStaffMember are declared but never invoked in the JSX. The Staff Availability section has no UI to add or remove staff — only an empty-state hint says 'Assign roles with ticket permissions to see staff here automatically.'
  - *Fix:* Either delete the dead code, or render AddStaffButton in the Staff Availability section header with a corresponding remove action per row.
  - *Where:* `src/components/settings/TicketRoutingTab.tsx:785`

- 🟡 **UX-040** — Manager picker shows when no config exists, hidden when config exists with non-MANAGER strategy
  - *Issue:* Condition (currentStrategy === 'MANAGER_TRIAGE' || !currentConfig) means before any config is seeded the Triage Manager dropdown shows even though no strategy is selected — confusing.
  - *Fix:* Only show the dropdown when MANAGER_TRIAGE is the active strategy; rely on the auto-seed to populate currentConfig before rendering.
  - *Where:* `src/components/settings/TicketRoutingTab.tsx:422`

- 🔵 **CR-034** — N+1 ticket-count queries in staff-availability GET
  - *Issue:* For each staff availability row, awaits rawPrisma.maintenanceTicket.count(...) inside Promise.all. N round-trips for N staff. Same N+1 in ticket-routing/dashboard/route.ts:34.
  - *Fix:* Use groupBy(['assignedToId']) once and look up counts per user from the result map.
  - *Where:* `src/app/api/settings/staff-availability/route.ts:86`

- 🔵 **LIVE-015** — ticket-routing/* GETs return 400 without ?module=
  - *Issue:* GET /api/settings/ticket-routing/categories|dashboard|fields|fields/library all return VALIDATION_ERROR 'module query param required (MAINTENANCE or IT)' when module is missing. This is correct API behavior, but consumers (UI components, scripts) need to know.
  - *Fix:* Document required query params on each route handler comment so consumers and AI assistants reading the code know what to send.

### Facilities (Campus map + buildings) — 7 findings (3 medium, 4 low)

- 🟡 **CR-015** — map-data PATCH has no Zod schema; no lat/lng bounds check
  - *Issue:* Manual typeof number checks, but no min/max on lat (-90..90) / lng (-180..180). Garbage coordinates land on records.
  - *Fix:* Wrap with a Zod schema (z.number().min(-90).max(90), etc.) via the schema option.
  - *Where:* `src/app/api/settings/campus/map-data/route.ts:234`

- 🟡 **LIVE-005** — Campus / map-data disagree about building counts
  - *Issue:* GET /api/settings/campus/buildings returns len=0 (no buildings) for the demo org, but GET /api/settings/campus/map-data returns 23 buildings. The tab and the map are sourced from different queries and don't agree. Also: 21 campuses defined but 0 rooms.
  - *Fix:* Decide which source is authoritative. Have map-data join through the buildings list, or have buildings include map-only records. Reconcile the seed/migration to match.

- 🟡 **UX-046** — SchoolsManagement mounted invisibly to hijack imperative API
  - *Issue:* FacilitiesTab renders <SchoolsManagement> inside a hidden div purely to drive openNew via a ref. Double-mounts the component, runs duplicate effects (loadSchools, resolveOrCreateCampus), hard to reason about.
  - *Fix:* Extract the school CRUD modals into a standalone <SchoolDialogs/> component that only renders the drawers, no fetch effects, accept data as props.
  - *Where:* `src/components/settings/FacilitiesTab.tsx:72`

- 🔵 **CR-028** — Building PATCH parses Zod manually inside handler instead of using schema option
  - *Issue:* UpdateBuildingSchema.parse(body) inside handler. If parsing throws, withAuth.classifyError turns it into a 400. Every other route uses the schema: option. Inconsistent style.
  - *Fix:* Move to withAuth(handler, { permission: ..., schema: UpdateBuildingSchema }).
  - *Where:* `src/app/api/settings/campus/buildings/[id]/route.ts:78`

- 🔵 **CR-030** — Use of any[] type for outdoor map spaces
  - *Issue:* const [outdoorMapSpaces, setOutdoorMapSpaces] = useState<any[]>([]) — explicit any violates the typescript style rule.
  - *Fix:* Define a proper interface for the outdoor space shape.
  - *Where:* `src/components/settings/CampusTab.tsx:99`

- 🔵 **LIVE-011** — GET /api/settings/campus/district returns 404 'No district found'
  - *Issue:* With no district configured, the route returns 404 with NOT_FOUND. The UI must handle this without showing an error banner — confirm there's a graceful empty-state path.
  - *Fix:* Verify the Facilities tab handles 404 from this route as 'no district yet, suggest creating one' rather than a hard error.

- 🔵 **UX-031** — CampusTab is approaching 1000 lines and should be split
  - *Issue:* Loose typing for map data and ad-hoc state inside an 800+ line file. Correlates with bugs that surface as UX problems.
  - *Fix:* Split CampusTab into ViewState reducer + CampusMapPanel + CampusListPanel; tighten types via existing ./campus/types.tsx module.
  - *Where:* `src/components/settings/CampusTab.tsx:99`

### Activity Log — 6 findings (1 high, 5 medium)

- 🟠 **CR-009** — Audit logs readable by all members (SETTINGS_READ)
  - *Issue:* Audit logs include other users' email addresses, IPs, and resource changes. Gated by SETTINGS_READ, which is granted to the MEMBER default role.
  - *Fix:* Stricter permission — PERMISSIONS.ALL (super-admin) or introduce audit-logs:read granted only to admin roles.
  - *Where:* `src/app/api/settings/audit-logs/route.ts:60`

- 🟡 **CR-018** — AuditLogTab triggers fetch from inside the render body
  - *Issue:* if (!fetched && !loading) { fetchLogs(1); setInitialized(true) } runs during render. Side effects + setState during render are a React anti-pattern.
  - *Fix:* Move the bootstrap fetch into a useEffect(() => { fetchLogs(1) }, []). The fetched flag is no longer needed.
  - *Where:* `src/components/settings/AuditLogTab.tsx:283`

- 🟡 **UX-011** — Initial fetch performed during render
  - *Issue:* Calls fetchLogs(1) and setInitialized(true) inside the function body during render (not inside useEffect). Triggers a state update during render; can produce React warnings and re-runs on every render until fetched flips.
  - *Fix:* Move the initial fetch into useEffect with [] deps; or use useQuery like the rest of the codebase does.
  - *Where:* `src/components/settings/AuditLogTab.tsx:283`

- 🟡 **UX-012** — Action filter dropdown shows raw machine codes
  - *Issue:* ACTION_OPTIONS uses raw enum values like 'user.password-reset-complete' as labels. Users have to parse dotted, kebab-cased identifiers.
  - *Fix:* Provide human labels (e.g., 'User · Login', 'Role · Created') while keeping the value as the API code. Group by resource.
  - *Where:* `src/components/settings/AuditLogTab.tsx:192`

- 🟡 **UX-013** — div with onClick used to lazy-load users for filter
  - *Issue:* Wrapping div uses onClick={fetchUsers}/onFocus={fetchUsers}. Not focusable, no role, keyboard-only users can't trigger the load.
  - *Fix:* Move the lazy-load trigger onto the FloatingDropdown's onFocus/onClick props, or fetch users on mount via useQuery.
  - *Where:* `src/components/settings/AuditLogTab.tsx:330`

- 🟡 **UX-028** — No virtualization on potentially large audit-log table
  - *Issue:* Table renders every row in current page. With LIMIT=25 fine, but expand-row mounts AnimatePresence div for every row; no cap on changes object size — a single big diff will lock the row.
  - *Fix:* Truncate ChangesDisplay values past N characters with a 'show full' link; consider react-virtual if page size is increased.
  - *Where:* `src/components/settings/AuditLogTab.tsx:422`

### Billing + subscription — 6 findings (1 high, 4 medium, 1 low)

- 🟠 **UX-003** — Reactivate subscription failure is invisible
  - *Issue:* handleReactivate catch contains only '// noop — button will re-enable on error'. User clicks Reactivate, network fails, sees nothing.
  - *Fix:* Set a reactivateError state and render it next to the button, mirroring how cancelError is displayed.
  - *Where:* `src/components/settings/BillingTab.tsx:190`

- 🟡 **CR-023** — Stripe error message returned to client verbatim
  - *Issue:* On Stripe failure: fail('PAYMENT_ERROR', stripeError.message). Returns Stripe internal error strings (account ids, internal codes) to the client. Same in change-plan, portal, reactivate, organization/delete.
  - *Fix:* Log Stripe error server-side; return generic message: fail('PAYMENT_ERROR', 'Failed to cancel subscription. Please try again or contact support.').
  - *Where:* `src/app/api/settings/billing/cancel/route.ts:92`

- 🟡 **UX-018** — Org-name confirmation input has no accessible label
  - *Issue:* The 'Type organization name to confirm' input has only a placeholder, no <label> and no aria-label. Screen reader users hear 'edit text' with no purpose.
  - *Fix:* Add <label htmlFor="delete-org-confirm"> or aria-label='Type organization name to confirm'.
  - *Where:* `src/components/settings/billing/DangerZoneSection.tsx:85`

- 🟡 **UX-019** — Custom modal instead of shared ConfirmDialog
  - *Issue:* DangerZone hand-rolls a modal with its own backdrop, focus management, and z-index, while the rest of settings uses ConfirmDialog with requireText='DELETE'. Visual style and keyboard behavior diverge.
  - *Fix:* Replace with ConfirmDialog requireText={orgName} variant='danger'. Eliminates duplicated focus-trap and Escape-handling code.
  - *Where:* `src/components/settings/billing/DangerZoneSection.tsx:60`

- 🟡 **UX-020** — Stripe-not-configured detection conflates network errors
  - *Issue:* catch sets stripeConfigured=false on ANY fetch failure, so a transient 500 or offline state shows 'Billing Not Configured — Contact your administrator' rather than a retry option.
  - *Fix:* Only set stripeConfigured=false on the specific 'not yet configured'/SERVICE_UNAVAILABLE response codes; show generic error+retry on other failures.
  - *Where:* `src/components/settings/BillingTab.tsx:87`

- 🔵 **UX-043** — Button label varies between 'Upgrade to X' and 'Upgrade'
  - *Issue:* Plan card button cycles through 'Upgrade to Pro', 'Upgrade', 'Downgrade', 'Select Plan' depending on subscription state. Inconsistent verbosity makes plan rows visually uneven.
  - *Fix:* Standardize on '<Action> <Plan name>' (e.g., 'Upgrade to Pro', 'Downgrade to Starter').
  - *Where:* `src/components/settings/billing/PlanComparisonSection.tsx:113`

### School Information — 5 findings (2 medium, 3 low)

- 🟡 **LIVE-009** — School Info has unlabeled inputs and one unlabeled toggle switch
  - *Issue:* The address autocomplete (placeholder='Start typing an address...') has no label. A button with role='switch' and aria-checked='false' has no accessible name. Screen reader users can't know what the toggle controls.
  - *Fix:* Wrap inputs in <label>, add aria-label to the switch (e.g. aria-label='Enable Google Places autofill').
  - *Where:* `src/components/settings/SchoolInfoTab.tsx`

- 🟡 **LIVE-010** — Icon-only 'Remove image' buttons use title= instead of aria-label
  - *Issue:* Two buttons with title='Remove image' have no aria-label. Screen readers may or may not announce title, and rely on aria-label per WAI-ARIA recommendations.
  - *Fix:* Switch title to aria-label, or add aria-label alongside.

- 🔵 **UX-041** — Two save bars compete on long pages
  - *Issue:* When the form is dirty, the user sees BOTH the inline 'Save Changes' button at L522 AND the fixed bottom bar at L541. Clicking either does the same thing — but the redundancy is visual noise.
  - *Fix:* Hide the inline button when isDirty (the sticky bar takes over).
  - *Where:* `src/components/settings/SchoolInfoTab.tsx:522`

- 🔵 **UX-042** — Institution Type dropdown omits FAITH_BASED option
  - *Issue:* The form only offers PUBLIC/PRIVATE/CHARTER/HYBRID. But FAITH_BASED is a valid value used elsewhere. Existing FAITH_BASED orgs cannot edit this field correctly without losing their setting.
  - *Fix:* Add FAITH_BASED option (consistent with the platform's secular, multi-tenant stance — it's a category, not a religious reference).
  - *Where:* `src/components/settings/SchoolInfoTab.tsx:411`

- 🔵 **UX-049** — Slug success message hardcodes lionheartapp.com
  - *Issue:* setSlugSuccess(`Subdomain updated to ${slugInput}.lionheartapp.com`) hardcodes the domain. NEXT_PUBLIC_PLATFORM_URL exists for this. White-label or staging instances will show wrong copy.
  - *Fix:* Read from process.env.NEXT_PUBLIC_PLATFORM_URL or NEXT_PUBLIC_APP_URL.
  - *Where:* `src/components/settings/SchoolInfoTab.tsx:145`

### Schools — 5 findings (1 high, 4 medium)

- 🟠 **UX-029** — Auto-creates 'Main Campus' silently when no campuses exist
  - *Issue:* On mount, if the org has no campuses, the resolveOrCreateCampus effect silently POSTs a 'Main Campus' record. Catch is /* silent */. User has no idea a campus was just created.
  - *Fix:* Either gate behind a visible onboarding step ('We've added a default Main Campus — rename or add more in Facilities'), or move auto-creation into org signup so it happens once with feedback.
  - *Where:* `src/components/settings/SchoolsManagement.tsx:60`

- 🟡 **CR-020** — School lookup uses findUnique by id with post-hoc org check
  - *Issue:* prisma.school.findUnique({where:{id}}) then check school.organizationId !== orgId. School IS auto-scoped so unique find returns null for cross-org ids, but the post-hoc check is dead code suggesting confusion. Inconsistent with buildings/rooms/spaces handlers that use findFirst.
  - *Fix:* Use prisma.school.findFirst({where:{id, organizationId:orgId}}) consistently.
  - *Where:* `src/app/api/settings/schools/[id]/route.ts:50`

- 🟡 **CR-021** — GET /api/settings/schools?campusId=X is silently ignored by the route
  - *Issue:* Component builds /api/settings/schools?campusId=${campusId} but the route only filters on organizationId. Per-campus facilities view shows ALL org schools instead of those assigned to that campus.
  - *Fix:* Either implement campusId filtering in the route, or remove the unused param from the client.
  - *Where:* `src/components/settings/SchoolsManagement.tsx:154`

- 🟡 **CR-022** — School create silently hard-deletes any soft-deleted school with the same name
  - *Issue:* POST does rawPrisma.school.deleteMany({where:{organizationId, name, deletedAt:{not:null}}}) to free up the unique constraint. Destructive op hidden behind a CREATE — orgs lose soft-deleted history when recreating same-named schools. Also bypasses audit logging.
  - *Fix:* Either keep the unique constraint partial (where: { deletedAt: null }) via raw SQL, or rename the soft-deleted record (append deletedAt to name). At minimum, audit-log the destructive deletion.
  - *Where:* `src/app/api/settings/schools/route.ts:90`

- 🟡 **UX-030** — Imperative openEdit fallback silently fails
  - *Issue:* openEdit() ref method: if the school isn't in local state, tries to refetch all schools and find it. Catch is empty — // silent — school not found. If the network fails or the school truly doesn't exist, drawer just never opens.
  - *Fix:* Throw or return false from openEdit so callers can show a toast 'School not found'.
  - *Where:* `src/components/settings/SchoolsManagement.tsx:137`

### Principals (search + assignment) — 4 findings (4 high)

- 🟠 **CR-005** — Principal POST creates User with empty passwordHash + no setup token
  - *Issue:* POST creates a User row with passwordHash:'' and status:ACTIVE. Login is blocked for empty hashes, but no setup token / welcome email is generated; the org is left with a half-provisioned user. Any future SSO/OAuth/passkey path that bypasses passwordHash would log the user in.
  - *Fix:* Use the same flow as POST /api/settings/users — generate a setup token, send the welcome email, default status to PENDING, drop the empty passwordHash.
  - *Where:* `src/app/api/settings/principals/route.ts:193`

- 🟠 **CR-006** — Principals search exposes PII to all org members (SETTINGS_READ)
  - *Issue:* GET /api/settings/principals?q= is gated by SETTINGS_READ which is granted to MEMBER (default role). Returns id, firstName, lastName, email, phone, jobTitle for up to 15 matches. Any active org member can scrape staff contact info.
  - *Fix:* Gate with PERMISSIONS.USERS_READ (admin only), or if regular members truly need this, return only id+name with no email/phone.
  - *Where:* `src/app/api/settings/principals/route.ts:60`

- 🟠 **CR-007** — Principals POST/PATCH have no Zod schema
  - *Issue:* Inputs hand-pulled from body.name/phone/phoneExt with no schema. Inconsistent with the rest of the settings surface; weakens defense.
  - *Fix:* Add a Zod schema and pass via the schema option of withAuth().
  - *Where:* `src/app/api/settings/principals/route.ts:100`

- 🟠 **CR-008** — Principal POST silently picks an arbitrary role (first one returned)
  - *Issue:* prisma.role.findMany({take:1}) with no orderBy. The first role returned (often super-admin since system roles seed first) becomes the principal's role.
  - *Fix:* Resolve a specific safe role by slug (member or a dedicated principal role). Never pick the arbitrary first row.
  - *Where:* `src/app/api/settings/principals/route.ts:175`

### My Profile — 4 findings (1 high, 2 medium, 1 low)

- 🟠 **UX-032** — Avatar Remove has no confirmation; sits next to Change Image
  - *Issue:* handleRemoveAvatar immediately PATCHes avatar=null. Reversible by re-uploading, but the Remove button is right next to Change Image with no distinguishing color or confirmation.
  - *Fix:* Make Remove visually destructive (red text/icon), or add a quick confirm popover.
  - *Where:* `src/app/settings/ProfileTab.tsx:209`

- 🟡 **UX-033** — Passkey Delete has no confirmation
  - *Issue:* handleDeletePasskey is wired to the trash icon and runs immediately. Removing your last passkey when MFA is required can lock you out.
  - *Fix:* Add ConfirmDialog ('Remove this passkey? You'll need another sign-in method to access your account.'). Block deletion of the last MFA method when org-level MFA is required.
  - *Where:* `src/app/settings/ProfileTab.tsx:1064`

- 🟡 **UX-034** — Passkey rename/delete buttons missing aria-label
  - *Issue:* Icon-only buttons for Rename/Delete passkey use title= but no aria-label. Screen readers may or may not announce title; aria-label is the WAI-ARIA-recommended attribute.
  - *Fix:* Add aria-label='Rename passkey' / 'Delete passkey'.
  - *Where:* `src/app/settings/ProfileTab.tsx:1062`

- 🔵 **UX-035** — Initial mount fetches MFA via fetch in addition to useAuth context
  - *Issue:* ProfileTab does its own fetch('/api/auth/me') on mount bypassing the cached context already provided by useAuth. Causes an extra network call and races with the context refresh.
  - *Fix:* Read mfaEnabled from useAuth or a shared query hook.
  - *Where:* `src/app/settings/ProfileTab.tsx:91`

### Academic Calendar — 3 findings (2 medium, 1 low)

- 🟡 **UX-010** — Bell schedule edit/delete actions are hover-only
  - *Issue:* Schedule Edit and Delete buttons live in a div with opacity-0 group-hover/sched:opacity-100. Touch users have no hover; keyboard-only users see actions only via :focus-within after tabbing in. Same pattern for period removal.
  - *Fix:* Show actions at low opacity by default (e.g. opacity-60) with full opacity on hover/focus, OR move them into a persistent RowActionMenu overflow.
  - *Where:* `src/components/settings/academic-calendar/BellScheduleSubTab.tsx:301`

- 🟡 **UX-027** — Delete mutations have no onError handler
  - *Issue:* deleteYear, deleteTerm, deleteSchedule, deleteSpecialDayMut only define onSuccess. If the API rejects (e.g., year has linked events), the user sees the dialog close with no feedback and the row still present.
  - *Fix:* Add onError that toasts the API error message.
  - *Where:* `src/components/settings/AcademicCalendarTab.tsx:42`

- 🔵 **UX-026** — Tab depends on activeSchoolId but doesn't surface 'no school selected'
  - *Issue:* Sub-tabs receive activeSchoolId from useActiveSchool. If no school is selected, schedules filter to nothing and show only 'No bell schedules configured' — user has no clue this is because of an unset filter.
  - *Fix:* Show a one-line context banner: 'Showing schedules for: <school>' with a school picker; or 'All schools' when activeSchoolId is empty.
  - *Where:* `src/components/settings/AcademicCalendarTab.tsx:21`

### Organization (delete, event buffer) — 3 findings (1 medium, 2 low)

- 🟡 **UX-004** — Event buffer save logs to console only
  - *Issue:* Save handler only does console.error on failure and never calls setSaved(false) or surfaces the error. Admin assumes the buffer is saved when it isn't.
  - *Fix:* Track an error state and render an inline message; or use the global toast pattern.
  - *Where:* `src/components/settings/school-info/EventBufferSection.tsx:40`

- 🔵 **CR-025** — Org delete uses string match on roleName instead of permission check
  - *Issue:* if (ctx.roleName !== 'super-admin') is fragile. The route already has permission: PERMISSIONS.SETTINGS_BILLING as the wrapper-level gate, which is too weak (admin has it).
  - *Fix:* Replace with await assertCan(ctx.userId, PERMISSIONS.ALL). Tighten wrapper-level permission too.
  - *Where:* `src/app/api/settings/organization/delete/route.ts:37`

- 🔵 **CR-026** — Organization GET readable by all members
  - *Issue:* SETTINGS_READ granted to default MEMBER role. Returns name, slug, eventBufferMinutes — exposes org slug to non-admins. Likely intentional but worth confirming.
  - *Fix:* If non-admins genuinely don't need this endpoint, gate with USERS_READ or stricter.
  - *Where:* `src/app/api/settings/organization/route.ts:26`

### Add-ons — 2 findings (1 high, 1 low)

- 🟠 **UX-021** — 'Enable for entire organization' button passes wrong arg in modal
  - *Issue:* When activeCampuses is empty, the button calls onToggle(mod.id, false) (currentlyEnabled=false meaning 'enable now') for what is actually a campus-scoped module. Modal closes; if API rejects org-level enable for a campus-scoped feature, no error is shown.
  - *Fix:* Disable the button when no campuses exist and show 'Add a campus first', or surface API errors back into the modal before closing it.
  - *Where:* `src/components/settings/AddOnsTab.tsx:137`

- 🔵 **UX-022** — Single-module registry yields a one-card Add-ons tab
  - *Issue:* Only Athletics is registered. The whole tab presents as a half-empty grid with one card and a long inline comment about features being now-core. First-time admins land on what looks like an empty/buggy screen.
  - *Fix:* Either hide the Add-ons tab from the sidebar when only one optional add-on exists, or add an explanation card alongside the Athletics card listing what's now built-in.
  - *Where:* `src/components/settings/AddOnsTab.tsx:33`

### Compliance / DPA — 2 findings (1 high, 1 medium)

- 🟠 **UX-002** — DPA save and revoke swallow all errors
  - *Issue:* handleDpaSave and handleDpaRevoke catch blocks contain only comments — '// Keep form open on failure'. Compliance attestation silently failing is an audit/legal risk.
  - *Fix:* Add a toast or inline error banner; keep the form open AND show the error message so the user can retry.
  - *Where:* `src/components/settings/SecuritySettingsSection.tsx:95`

- 🟡 **UX-045** — Remove DPA Record sits next to Save with no confirmation
  - *Issue:* 'Remove DPA Record' button placed inline with Save and Cancel and triggers handleDpaRevoke immediately. Revoking compliance attestation is significant and reversible only by re-recording.
  - *Fix:* Add ConfirmDialog with copy explaining the consequence.
  - *Where:* `src/components/settings/SecuritySettingsSection.tsx:290`

### Integrations (Google/Microsoft/Planning Center/Twilio) — 2 findings (2 high)

- 🟠 **UX-005** — Removing Twilio config has no confirmation
  - *Issue:* 'Remove' button calls handleRemove() directly with no ConfirmDialog. Removing Twilio destroys SMS credentials and silently breaks every notification flow that depends on it.
  - *Fix:* Wrap with a ConfirmDialog ('Remove Twilio configuration? Outbound SMS will stop immediately.').
  - *Where:* `src/components/settings/integrations/TwilioCard.tsx:184`

- 🟠 **UX-006** — Calendar Disconnect (Google/Microsoft/Planning Center) has no confirmation
  - *Issue:* Disconnect buttons in GoogleCalendarCard, MicrosoftCalendarCard, and PlanningCenterCard all execute the destructive call immediately. OAuth tokens are wiped + saved calendar selections lost.
  - *Fix:* Add a ConfirmDialog with consequences ('You'll need to reauthorize to reconnect. Saved calendars will be lost.').
  - *Where:* `src/components/settings/integrations/GoogleCalendarCard.tsx:291`

### Security policy — 2 findings (1 high, 1 medium)

- 🟠 **UX-001** — MFA toggle silently fails on error
  - *Issue:* handleMfaToggle catch is just '// Revert on failure' — no revert and no user-facing error. Admin sets a security policy thinking it saved when it didn't.
  - *Fix:* Show a toast on failure, revert mfaRequired to its prior value, surface the API error message.
  - *Where:* `src/components/settings/SecuritySettingsSection.tsx:68`

- 🟡 **CR-016** — security/compliance routes mask Zod and permission errors as 500
  - *Issue:* Both routes do not use the canonical withAuth wrapper. Their catch falls through to fail('INTERNAL_ERROR') with 500. Zod parse errors and permission denials get swallowed and reported as 500 instead of 400/403.
  - *Fix:* Migrate both routes to withAuth({permission: PERMISSIONS.ALL, schema: UpdateSchema}). The wrapper already classifies Zod, permission, and Prisma errors correctly.
  - *Where:* `src/app/api/settings/security/route.ts:36`

### Activity Log (live findings) — 1 findings (1 medium)

- 🟡 **LIVE-008** — Activity Log date inputs missing labels
  - *Issue:* Two date inputs in the Activity Log filter row have no <label>, aria-label, or aria-labelledby. Screen readers announce only 'date'.
  - *Fix:* Add visible labels ('From', 'To') with htmlFor wiring, or aria-label='From date' / 'To date'.
  - *Where:* `src/components/settings/AuditLogTab.tsx`

### Exports (CSV) — 1 findings (1 low)

- 🔵 **CR-032** — Users CSV export gated by SETTINGS_READ — too permissive for PII bulk download
  - *Issue:* Exports name, email, role, status, createdAt for all org users. Gated by SETTINGS_READ (granted to MEMBER). Members shouldn't be able to bulk-download the org member list as CSV.
  - *Fix:* Use PERMISSIONS.USERS_READ (admin only).
  - *Where:* `src/app/api/settings/export/users/route.ts:57`

## Where to go from here

Open the companion file `SETTINGS_QA_ISSUES.xlsx` for a sortable, filterable issue tracker. The spreadsheet has every finding with severity, area, file, line, the issue, and the suggested fix — filter by Severity=Critical to start, then Severity=High, then work area-by-area.
