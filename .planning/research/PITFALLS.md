# Domain Pitfalls — K-12 CMMS / Facilities Management Module

**Domain:** Multi-tenant K-12 facilities management SaaS (CMMS)
**Project:** Lionheart Maintenance & Facilities Module
**Researched:** 2026-03-05
**Confidence:** HIGH (most pitfalls verified against official docs, community reports, and known issues)

---

## Critical Pitfalls

Mistakes in this category cause rewrites, data corruption, or security failures.

---

### Pitfall 1: Soft-Delete Leaking Through Prisma Relations

**What goes wrong:** The existing org-scoped Prisma extension intercepts top-level `.find*` and `.delete()` calls. It does NOT intercept `include`/`select` subqueries for related records. If `MaintenanceTicket` is fetched with `include: { asset: true }` and the Asset is soft-deleted (`deletedAt != null`), the soft-deleted asset leaks into the response. Same issue applies to `TicketActivity`, `TicketLaborEntry`, `TechnicianProfile`, and every new soft-delete model added in Phase 1–2.

**Why it happens:** Prisma middleware and client extensions can only intercept at the query operation level. Nested `include` clauses run as separate sub-selects that bypass the extension's `where` injection. This is a documented, open issue in the Prisma repo (prisma/prisma#5771).

**Consequences:**
- Deleted assets appear linked to tickets (corrupted UI state)
- Activity feed shows entries from cancelled/deleted technician profiles
- FCI calculations in Phase 3 include decommissioned asset costs if not manually guarded

**Prevention:**
- For every new model with soft-delete: always add explicit `deletedAt: null` guards inside `include` clauses, do not rely on the extension alone for nested relations
- Write a test fixture: create a soft-deleted related record, fetch parent via `include`, assert the deleted record does not appear
- Document this as a project convention in CLAUDE.md before Phase 1 starts

**Detection:** Write a smoke test specifically exercising `include` with soft-deleted related records. If it returns deleted data, the bug is present.

**Phase:** Phase 1 (affects MaintenanceTicket → TechnicianProfile, TicketActivity from day one)

---

### Pitfall 2: Ticket Status Transitions Not Enforced Server-Side

**What goes wrong:** The Kanban board drag-and-drop sends `PATCH /api/tickets/:id/status` with `{ status: "DONE" }`. If the API only checks that the caller has `maintenance:update:status` permission and does not validate the transition path, any user can skip QA entirely (move a ticket from `IN_PROGRESS` directly to `DONE`), or move a ticket backwards in ways the spec forbids.

**Why it happens:** Client-side code validates the drag-drop visually (the board enforces column adjacency). But the API endpoint is callable directly via curl. When developers build the API first and the UI second, they assume the UI will enforce the rules.

**Consequences:**
- Tickets closed without completion photos (the QA gate exists specifically for this)
- Labor hours and cost unconfirmed — corrupts analytics
- Compliance audit trails are incomplete (a ticket can show DONE without a QA inspector sign-off)
- "Inspection failed" rollback (QA → IN_PROGRESS) can be bypassed, undermining the Head of Maintenance review process

**Prevention:**
- Implement a `validateTransition(fromStatus, toStatus, actorRole)` function that encodes the full transition table from the spec (Section 3.2) and call it in every `PATCH /status` handler
- The function should also enforce field prerequisites: transition to QA requires `completionPhoto` present; transition to ON_HOLD requires `holdReason`; transition to CANCELLED requires `cancellationReason`
- Return `400` with a specific error code (`INVALID_TRANSITION`) when the transition is forbidden
- Unit test every valid and invalid transition pair

**Detection:** Call `PATCH /api/tickets/:id/status` with `{ status: "DONE" }` on a ticket in `BACKLOG`. If it succeeds, the validation is missing.

**Phase:** Phase 1 (state machine is the core of the module)

---

### Pitfall 3: Optimistic Drag-Drop With No Server-Side Rollback Path

**What goes wrong:** The Kanban board uses optimistic updates — dragging a card immediately moves it visually, then fires `PATCH /api/tickets/:id/status`. If the API rejects the move (permission denied, invalid transition, server error), the card must snap back. Most dnd-kit implementations forget to implement the rollback, leaving the UI in a phantom state that diverges from the database until a full page refresh.

**Why it happens:** The dnd-kit `onDragEnd` handler fires the API call, but `useQuery` cached data does not revert automatically on mutation failure. The optimistic state and the server state are now out of sync.

**Consequences:**
- Head of Maintenance sees a technician's ticket as "In Progress" when the DB still shows "Backlog"
- Multiple technicians drag the same unassigned card simultaneously — last write wins, but intermediate states are visible to all
- Real-time polling (every 30s) eventually fixes the state, but the 30-second window causes confusion in multi-user environments

**Prevention:**
- Use TanStack Query's `useMutation` with `onMutate` (optimistic update), `onError` (rollback to previous cache value), and `onSettled` (invalidate query to force re-fetch)
- Keep a snapshot of the pre-drag board state; restore it in `onError`
- `refetchInterval` on the board query should be short (10–15 seconds) during active use to reduce divergence windows
- When server rejects a drag, show a toast explaining why (e.g., "Cannot move to Done — QA sign-off required")

**Detection:** Drag a card to an invalid column, simulate a 500 response, and verify the card snaps back within one polling cycle.

**Phase:** Phase 1

---

### Pitfall 4: PM Ticket Duplicate Generation from Concurrent Cron Runs

**What goes wrong:** Phase 2 requires a cron job to auto-generate `MaintenanceTicket` records from `PmSchedule` when `nextDueDate - advanceNoticeDays <= today`. If the cron runs on two Vercel edge instances simultaneously (common at startup or during cold starts), the same PmSchedule generates two identical tickets.

**Why it happens:** PostgreSQL sequences cannot guarantee gapless serials without explicit locking. The check-and-insert operation (`if no open PM ticket exists for this schedule, create one`) is a read-then-write and is not atomic unless wrapped in a transaction with advisory lock or `SELECT FOR UPDATE`.

**Consequences:**
- Duplicate PM tickets inflate workload counts, skew PM compliance rate metrics, and confuse technicians
- If both tickets are completed, labor hours are double-counted
- FCI and analytics dashboards show doubled PM activity

**Prevention:**
- Add a unique constraint to the DB: `@@unique([pmScheduleId, scheduledDueDate])` on `MaintenanceTicket` where `isPmGenerated = true` — the DB will reject the second insert with a unique constraint violation
- Wrap the generation query in a try/catch that handles `P2002` (Prisma unique constraint error) silently — this is the expected "already created" path
- Use Vercel Cron (or a dedicated job via pg_cron in Supabase) with the idempotency constraint as the sole safeguard — do not rely on application-level locking
- Log each generation attempt with `pmScheduleId` + `scheduledDueDate` for debugging

**Detection:** Trigger the PM generation endpoint twice in rapid succession. Without the unique constraint, two tickets with identical `pmScheduleId` exist. With it, the second call produces a `P2002` that is swallowed silently.

**Phase:** Phase 2

---

### Pitfall 5: Missing `organizationId` on New Models Bypasses Org Scoping

**What goes wrong:** Every new model added for the maintenance module (`MaintenanceTicket`, `Asset`, `PmSchedule`, `TicketLaborEntry`, `TicketCostEntry`, `TicketActivity`, `TechnicianProfile`, `ComplianceRecord`, `KnowledgeArticle`) must be explicitly added to the org-scoped extension whitelist in `src/lib/db/index.ts`. Models not on the list use `rawPrisma` behavior — no automatic `organizationId` injection — meaning data from different schools leaks across tenant boundaries.

**Why it happens:** The org-scoped extension in `db/index.ts` has an explicit list of model names. Adding a new model to `schema.prisma` does not automatically add it to the extension. Developers assume the extension covers everything.

**Consequences:**
- A technician at School A can read assets belonging to School B
- Analytics queries aggregate costs and labor across all orgs
- This is a hard data breach, not a UI bug — user data from other organizations is exposed via API

**Prevention:**
- Add a runtime check (dev-only): on server startup, assert that every model in the Prisma schema that has an `organizationId` column is present in the extension's model list
- Code review checklist item: "Is this new model in the org-scope extension whitelist?"
- Write an integration test that creates records for two different orgs, then queries as org A and asserts org B records are absent

**Detection:** Create a record for `orgId = "org-a"`, query via API authenticated as `orgId = "org-b"`, and check if the record appears.

**Phase:** Phase 1 (must be addressed before any new model ships)

---

### Pitfall 6: Next.js Server Action 1MB Body Limit Breaks Photo Uploads

**What goes wrong:** Next.js 15 App Router enforces a **1MB default body size limit on Server Actions**. If the ticket submission form POSTs photos through a Server Action (or even through an API Route that relies on `request.json()`), any photo larger than 1MB throws a 413 or silently truncates.

**Why it happens:** Mobile camera photos are typically 3–8MB. The spec requires 1–5 photos per ticket. Developers naturally write a Server Action that handles both form fields and files in one call.

**Consequences:**
- Teacher submits a ticket with a phone photo; upload silently fails or throws a cryptic error
- Sub-60-second submission target is broken if the user must compress photos manually
- Completion photos (required for QA transition) fail in the field on technician phones

**Prevention:**
- Use the **signed URL upload pattern**: Server Action (or API Route) only generates a Supabase signed upload URL; client uploads the file directly from the browser to Supabase Storage; the Server Action is never in the file path
- For files over 6MB, use TUS resumable upload (Supabase Storage supports this natively)
- Client-side: compress photos to ~1.5MB maximum before upload using `browser-image-compression` — preserve quality but reduce transfer time on 4G
- Never pass image bytes through a Next.js API route body

**Detection:** Attempt to upload a 4MB JPEG through the submission form. If it fails or times out, the signed URL pattern is not implemented.

**Phase:** Phase 1 (ticket photo upload is core to the sub-60-second experience)

---

### Pitfall 7: iOS Safari PWA Camera Access Does Not Persist

**What goes wrong:** Phase 3 delivers a true offline PWA. For QR code scanning, the app needs camera access. On iOS, when a web app is installed to the home screen as a PWA, the camera permission granted inside Safari does NOT carry over to the installed PWA context. Users must re-grant permission, and if they dismiss the prompt once, they often cannot re-grant it without going to iOS Settings.

**Why it happens:** iOS treats PWAs as a separate app context from Safari. The `MediaDevices.getUserMedia` API works in both, but permissions are not shared. The Barcode Detection API (which would simplify QR scanning) is not supported on iOS Safari as of early 2026.

**Consequences:**
- Technicians cannot scan asset QR codes in the field
- The QR scan flow requires a fallback for iOS (manual asset number entry)
- First-time iOS users hitting the permission prompt without context causes confusion and abandonment

**Prevention:**
- Do not assume camera works in PWA context on iOS — test on actual iOS device before committing to a QR-first UX
- Always provide a manual entry fallback (type or search the asset number) that is equally prominent to the QR scan button
- Show an explicit permission explanation screen before requesting camera access
- For QR scanning, use a library like `jsQR` (pure JS, no native API dependency) rather than the Barcode Detection API for cross-platform compatibility

**Detection:** Install the app as a PWA on an iPhone, attempt QR scan, verify camera prompt appears and permission state persists after app relaunch.

**Phase:** Phase 2 (QR scanning), Phase 3 (offline PWA)

---

## Moderate Pitfalls

### Pitfall 8: Ticket Splitting Breaks Activity Feed Lineage

**What goes wrong:** When a ticket is split (one multi-issue ticket becomes two or three tickets), the child tickets have no visible connection to the parent in the UI or API. A Head of Maintenance sees "MT-0042" and "MT-0043" as independent tickets with no indication they came from the same original report. Activity history from the parent is not copied to children.

**Why it happens:** The `MaintenanceTicket` model has no `parentTicketId` or `splitFromId` field in the current spec. Splitting is modeled as creating new tickets and cancelling the original. The original's activity feed is orphaned.

**Prevention:**
- Add `splitFromId String? (FK → MaintenanceTicket)` to the model
- When creating split children, copy the original's submitter, location, and first photo to each child
- Add a `SPLIT` activity entry to each child's feed: "Split from MT-XXXX"
- Add a `SPLIT_INTO` activity entry to the parent's feed: "Split into MT-YYYY and MT-ZZZZ"
- The ticket detail panel should show a "Split from" badge if `splitFromId` is present

**Phase:** Phase 1

---

### Pitfall 9: AI Diagnostic Cache Never Invalidates on New Photos

**What goes wrong:** The `aiAnalysis` field on `MaintenanceTicket` caches the AI response as JSON. If a technician uploads additional photos after the initial analysis (e.g., "here's what it looks like up close"), the cached analysis is stale but still displayed with the same "AI Suggestion" badge. The technician may follow outdated advice.

**Why it happens:** Caching was implemented for cost reduction (Claude API calls cost money). The cache invalidation trigger is not defined.

**Prevention:**
- Store `aiAnalysisGeneratedAt DateTime?` and `aiAnalysisPhotoCount Int?` alongside the cached analysis
- When a new photo is uploaded: if `photos.length > aiAnalysisPhotoCount`, show a "Re-analyze with new photos" button instead of silently serving stale data
- Alternatively, auto-regenerate on each new photo upload if cost allows (the spec says analysis is cached "per ticket" — clarify whether per-session or per-photo-set)
- Always display the analysis timestamp: "Analysis generated 3 hours ago based on 2 photos"

**Phase:** Phase 1

---

### Pitfall 10: Compliance Deadline Arithmetic Is Timezone-Naive

**What goes wrong:** AHERA requires re-inspections every 3 years, 6-month periodic surveillance, and annual notifications. NFPA, playground, boiler, and elevator inspections each have their own calendar anchors. When the system stores `scheduledDate` as UTC and the school's timezone is America/Los_Angeles (UTC-8), a deadline of "December 1" stored as `2024-12-01T00:00:00Z` is actually November 30 at 4pm local time — the school sees a one-day-early alert.

**Why it happens:** JavaScript `new Date()` and Prisma `DateTime` fields are UTC. Date arithmetic like "add 3 years" or "subtract 30 days for reminder" performed in UTC produces wrong results for institutions in non-UTC timezones when displayed locally.

**Consequences:**
- Compliance deadlines appear one day early or late depending on timezone
- Reminder emails fire at 4pm the day before instead of midnight
- If a school misses an AHERA filing deadline because the system showed the wrong date, the liability exposure is significant

**Prevention:**
- Store all compliance deadlines as UTC midnight of the deadline date in the school's timezone (not UTC midnight globally)
- Use `date-fns-tz` or `luxon` for all deadline arithmetic — never use raw JS `Date` arithmetic for compliance dates
- Store `Organization.timezone` (e.g., `"America/Los_Angeles"`) and always perform date calculations relative to that timezone
- When generating 30-day and 7-day reminder events, calculate "30 days before due date" in the org's local timezone, then store the UTC equivalent
- Display all compliance dates in the org's timezone with explicit timezone label ("Dec 1, 2026 — Pacific Time")

**Phase:** Phase 3 (compliance calendar), but `Organization.timezone` field needed by Phase 1 for scheduling

---

### Pitfall 11: FCI Score Includes Costs Without Inflation Adjustment

**What goes wrong:** The FCI formula (deferred maintenance ÷ current replacement value) requires the `replacementCostUSD` field on each asset to be current. Assets entered in Phase 2 will have replacement costs set at time of entry. By Phase 3 board reporting, those costs may be 1–3 years stale. A board report showing "FCI = 4% (Good)" when the actual inflation-adjusted FCI is 7% (Fair) misleads school board members making capital budget decisions.

**Why it happens:** Asset records are created once and rarely updated. `replacementCostUSD` is a static decimal field with no audit trail or last-updated timestamp.

**Prevention:**
- Add `replacementCostUpdatedAt DateTime?` to the Asset model
- In the FCI report, flag assets whose `replacementCostUpdatedAt` is more than 12 months old with a warning: "Replacement costs may be outdated — last updated [date]"
- The board report should show a confidence range: "FCI 4–7% depending on current material costs"
- Consider adding an annual prompt to the Head of Maintenance to review and update asset replacement costs before generating board reports

**Phase:** Phase 3 (FCI reporting), but field needed in Phase 2 Asset model

---

### Pitfall 12: PM Schedule `nextDueDate` Calculated from Completion Date Creates Drift

**What goes wrong:** The spec says: "On completion, nextDueDate recalculated from completion date." For a quarterly filter change, if the tech completes it 2 weeks late, the next due date shifts 2 weeks later than intended. Over 2–3 years, a quarterly PM drifts from its original calendar anchor by months.

**Why it happens:** "Calculate from completion" is simpler to implement than "calculate from original due date," and it handles edge cases (what if it was never completed?). But it's wrong for calendar-anchored regulatory PMs.

**Consequences:**
- AHERA periodic surveillance (6-month) drifts off the mandated schedule
- Fire extinguisher inspection (annual) drifts past the anniversary
- Compliance reports show "on schedule" when the actual inspection cadence violates regulations

**Prevention:**
- Add a `schedulingMode` field to `PmSchedule`: `FROM_COMPLETION` (correct for HVAC filters, lubricating schedules) vs `FROM_ORIGINAL_DUE` (correct for regulatory compliance PMs)
- For `FROM_ORIGINAL_DUE`: `nextDueDate = lastScheduledDate + interval`, regardless of when the task was actually completed
- Default new PMs to `FROM_COMPLETION`; compliance-domain PMs default to `FROM_ORIGINAL_DUE`
- In the compliance calendar, all 10 regulatory domains must use `FROM_ORIGINAL_DUE`

**Phase:** Phase 2 (PM Schedule model), Phase 3 (compliance calendar relies on this)

---

### Pitfall 13: Kanban Board Polling Causes Expensive Full-Board Refetches

**What goes wrong:** The board API (`GET /api/maintenance/board`) returns all tickets for all columns. If the board is polled every 30 seconds and a campus has 200 active tickets, every polling cycle serializes 200 ticket records across the network. With 10 simultaneous technicians, this is 2,000 records/minute from a single endpoint.

**Why it happens:** The simplest implementation fetches the whole board. Incremental updates (only changed tickets since last poll) require `updatedAt` cursor tracking.

**Consequences:**
- Supabase connection pool saturation on busy school days
- Perceived lag on the board (large response parse time in JS main thread)
- Database read load spikes every 30 seconds across all tenants

**Prevention:**
- Add `?since=<ISO timestamp>` parameter to `GET /api/maintenance/board`; return only tickets where `updatedAt > since`
- Client tracks last successful fetch timestamp and passes it on each poll
- Initial board load fetches all; subsequent polls are delta-only
- Column ticket counts can be returned in a separate lightweight endpoint for the header badges

**Phase:** Phase 1 (architecture decision affects the API contract from the start)

---

### Pitfall 14: `TechnicianProfile` Self-Claim Race Condition

**What goes wrong:** Two technicians view the backlog simultaneously. Both see ticket MT-0055 as unassigned with matching specialty. Both click "Claim." Both API calls hit `POST /api/tickets/:id/claim` within milliseconds. Both succeed, and the ticket ends up with the last write's `assignedToId`, but both technicians' boards show it as assigned to them.

**Why it happens:** The claim operation is read-then-write without locking: "if `assignedToId` is null, set it to this technician." This is a classic TOCTOU (time-of-check/time-of-use) race.

**Prevention:**
- Use a PostgreSQL atomic conditional update: `UPDATE "MaintenanceTicket" SET "assignedToId" = $techId, "status" = 'TODO' WHERE id = $ticketId AND "assignedToId" IS NULL`
- If the update returns 0 rows affected, the ticket was already claimed — return `409 Conflict` with "This ticket was just claimed by another technician"
- The UI should handle 409 by removing the ticket from the claimable list and showing the toast
- Prisma raw query: `rawPrisma.$executeRaw` for the conditional update, or use `prisma.maintenanceTicket.updateMany` with a `where: { assignedToId: null }` guard (returns `count`)

**Phase:** Phase 1

---

### Pitfall 15: Offline Sync Conflicts When Ticket Is Updated on Both Device and Server

**What goes wrong:** Phase 3 delivers true offline PWA. A technician goes offline and marks ticket MT-0077 as `IN_PROGRESS` and writes a labor entry. Meanwhile, the Head of Maintenance puts MT-0077 `ON_HOLD` with a hold reason from the web app. When the technician comes back online, the background sync fires `PATCH /status` with `IN_PROGRESS`. Last write wins — the hold reason is silently overwritten.

**Why it happens:** Background sync replays queued mutations in order. Without version tracking or conflict detection, the offline mutation overwrites server state.

**Consequences:**
- ON_HOLD tickets (waiting on parts) show as IN_PROGRESS
- Hold reasons disappear, losing the context for why work was paused
- Labor entries may be logged against tickets in states that don't allow them (e.g., DONE)

**Prevention:**
- Each `MaintenanceTicket` needs a `version Int @default(1)` field (optimistic locking)
- Offline mutations store the `version` at time of capture; background sync sends `{ expectedVersion: N }` with every mutation
- Server rejects mutation if `currentVersion != expectedVersion` with `409 Conflict`
- Client's conflict resolution UI: "This ticket was updated while you were offline — here are the conflicting changes. Which do you want to keep?"
- For labor entries specifically: they are additive (not conflicting), so always append them regardless of version conflict on the ticket itself

**Phase:** Phase 3 (offline PWA), but `version` field should be added to the model in Phase 1 to avoid a migration later

---

## Minor Pitfalls

### Pitfall 16: Ticket Number Gaps Create Confusion

**What goes wrong:** The spec defines MT-0001 sequential numbering. PostgreSQL sequences skip numbers when transactions are rolled back (e.g., a user starts submitting a ticket, then abandons it). Users notice "MT-0023 is missing — was something deleted?"

**Prevention:**
- Document in the UI that numbers may have gaps (this is expected, not a sign of deletion)
- Or use a gapless sequence via an advisory lock + singleton counter table (higher complexity, only warranted if auditors require gapless numbering for compliance)
- Simpler: accept gaps — MT-XXXX is a reference number, not an audit sequence

**Phase:** Phase 1

---

### Pitfall 17: PPE Prompt Fatigue for Custodial Category

**What goes wrong:** The spec requires the AI to surface PPE requirements for Custodial/Biohazard tickets. If every custodial ticket — including routine floor mopping — fires a full PPE safety modal, technicians learn to click through it without reading, defeating the purpose for genuinely hazardous situations.

**Prevention:**
- Only trigger the PPE/safety panel when the AI analysis returns a confidence level above a threshold for actual biohazard content, OR the submitter explicitly tags the ticket as "biohazard"
- For routine custodial tickets, skip the safety modal
- When the modal fires, it should be non-blocking (a panel, not a dialog that requires dismissal) so it doesn't interrupt the workflow

**Phase:** Phase 1

---

### Pitfall 18: Asset QR Codes Are Publicly Accessible Without Auth

**What goes wrong:** `GET /api/assets/qr/:code` resolves a QR scan to an asset record. If this endpoint is public (no auth required), anyone who photographs a QR sticker on school equipment can enumerate all assets, see replacement costs, and access maintenance history — a security exposure for a K-12 institution.

**Prevention:**
- The QR scan endpoint must require authentication (JWT)
- For submitters (Staff/Teachers) who scan a QR to pre-populate a ticket, they must be logged in first
- The PWA should prompt login before attempting a QR scan
- If unauthenticated deep-link is needed, return only enough info to populate the ticket submission form (building + room name), not the full asset record

**Phase:** Phase 2

---

### Pitfall 19: Supabase Storage RLS and Service Role Upload Conflicts

**What goes wrong:** The `service_role` key bypasses Supabase RLS for database queries, but Supabase Storage has a known bug where presigned upload URLs generated with `service_role` fail RLS checks because the `owner` field is null. The `new row violates row-level security policy` error appears unexpectedly for server-side uploads.

**Prevention:**
- Use the signed URL pattern: client-side upload using the user's session token, not server-side service_role upload
- If server-side upload is required (e.g., AI analysis result storage), simplify the bucket RLS policy to `auth.role() = 'service_role'` for INSERT only
- Never set the maintenance photos bucket to public — photos of school facilities and biohazard situations should be authenticated-access only

**Phase:** Phase 1 (photo upload is core)

---

### Pitfall 20: `avoidSchoolYear` Flag Has No Calendar Data

**What goes wrong:** The `PmSchedule.avoidSchoolYear` boolean (Phase 2) is supposed to shift PM scheduling to school breaks. But the system has no school calendar data model. Without knowing when summer break and winter break are, the flag does nothing useful.

**Prevention:**
- Either: add a `SchoolCalendar` model with break periods (proper solution, links to existing `School` model)
- Or: treat `avoidSchoolYear` as a soft flag — surface it to the Head of Maintenance as a scheduling note ("This PM is marked as school-break preferred") but do not attempt automated scheduling shift without calendar data
- Do not ship the field if the calendar model is out of scope — misleading UI is worse than a missing feature

**Phase:** Phase 2

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: New Prisma models | Missing from org-scope extension whitelist | Runtime assertion check; code review checklist |
| Phase 1: Kanban drag-drop | No server-side state machine validation | `validateTransition()` function called in every PATCH handler |
| Phase 1: Photo upload | Next.js 1MB body limit on Server Actions | Signed URL pattern; client-direct-to-Supabase upload |
| Phase 1: Self-claim | Race condition on concurrent claims | Atomic conditional UPDATE with `assignedToId IS NULL` guard |
| Phase 1: Soft delete | Nested `include` bypasses soft-delete filter | Explicit `deletedAt: null` in every `include` clause |
| Phase 1: AI diagnosis | Stale cache after new photos uploaded | Invalidate/flag cache when photo count changes |
| Phase 2: PM generation | Cron duplicate generation | `@@unique([pmScheduleId, scheduledDueDate])` constraint |
| Phase 2: QR scan | iOS PWA camera permission not persistent | jsQR library + manual fallback; test on physical iOS device |
| Phase 2: Asset costs | Replacement cost goes stale for FCI | `replacementCostUpdatedAt` field + annual refresh prompt |
| Phase 2: PM scheduling | `nextDueDate` drift on regulatory PMs | `schedulingMode: FROM_ORIGINAL_DUE` for compliance PMs |
| Phase 3: Compliance dates | Timezone-naive date arithmetic | `date-fns-tz`; store org timezone; all calcs in local tz |
| Phase 3: Offline sync | Ticket updated on device and server simultaneously | `version` field for optimistic locking; conflict UI |
| Phase 3: FCI report | Decommissioned assets included in denominator | Filter `status != DECOMMISSIONED` in FCI query |
| Phase 3: Board reports | FCI inflated by stale replacement costs | Age warning on costs older than 12 months |
| All phases: Board polling | Full board refetch every 30s under load | `?since=<timestamp>` delta-only polling from Phase 1 |

---

## Sources

- [Soft Delete: Implementation Issues in Prisma and Solution in ZenStack](https://zenstack.dev/blog/soft-delete) — HIGH confidence (official ZenStack documentation)
- [Prisma Soft Delete Middleware — cascade and include limitations](https://github.com/olivierwilkinson/prisma-extension-soft-delete/issues/14) — HIGH confidence (GitHub issue with confirmed behavior)
- [Top 5 CMMS Implementation Mistakes to Avoid — Clickmaint](https://www.clickmaint.com/blog/cmms-implementation-mistakes) — MEDIUM confidence (practitioner article)
- [Preventing Duplicate Cron Job Execution in Scaled Environments](https://medium.com/@WMRayan/preventing-duplicate-cron-job-execution-in-scaled-environments-52ab0a13f258) — MEDIUM confidence (engineering blog)
- [Standard Uploads — Supabase Docs](https://supabase.com/docs/guides/storage/uploads/standard-uploads) — HIGH confidence (official docs; 1MB limit and TUS pattern confirmed)
- [Camera Access Issues in iOS PWA/Home Screen Apps — STRICH Knowledge Base](https://kb.strich.io/article/29-camera-access-issues-in-ios-pwa) — HIGH confidence (QR vendor documentation with active iOS PWA testing)
- [iOS Camera Access when used as PWA — Apple Developer Forums](https://developer.apple.com/forums/thread/118527) — HIGH confidence (Apple forums with confirmed iOS behavior)
- [Data Isolation in Multi-Tenant SaaS — Redis](https://redis.io/blog/data-isolation-multi-tenant-saas/) — HIGH confidence (authoritative engineering reference)
- [RLS Error Uploading to Supabase Storage Bucket Using Service Role Key](https://github.com/orgs/supabase/discussions/37611) — HIGH confidence (active Supabase GitHub discussion with confirmed bug)
- [Gaps in sequences in PostgreSQL — CYBERTEC](https://www.cybertec-postgresql.com/en/gaps-in-sequences-postgresql/) — HIGH confidence (PostgreSQL specialist blog)
- [No-gap sequence in PostgreSQL — DEV Community](https://dev.to/yugabyte/no-gap-sequence-in-postgresql-and-yugabytedb-3feo) — MEDIUM confidence
- [AHERA Asbestos Compliance for Schools — US EPA](https://www.epa.gov/asbestos/asbestos-and-school-buildings) — HIGH confidence (official US EPA guidance)
- [The Downside of Facility Condition Index (FCI) — Roth IAMS](https://rothiams.com/the-downside-of-facility-condition-index-fci/) — MEDIUM confidence (facilities management practitioner)
- [Offline-first frontend apps in 2025: IndexedDB and SQLite — LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) — MEDIUM confidence (engineering blog, recent)
- [CMMS UI UX Design — AufaitUX](https://www.aufaitux.com/blog/cmms-ui-ux-design) — MEDIUM confidence (design practitioner)
- [Build a Kanban board with dnd kit and React — LogRocket](https://blog.logrocket.com/build-kanban-board-dnd-kit-react/) — MEDIUM confidence (engineering reference for dnd-kit patterns)
