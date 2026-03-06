# Phase 2: Core Tickets - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Teachers can submit a maintenance ticket in under 60 seconds on mobile, and the maintenance team receives routed tickets with full lifecycle transitions enforced server-side. This phase delivers: ticket submission wizard, 8-status lifecycle state machine, specialty routing with self-claim, ticket detail view with activity feed, and email + in-app notifications for all lifecycle events. Kanban board and AI diagnostics panel are Phase 3 — this phase includes only the AI category auto-suggest on submission and AI multi-issue detection.

</domain>

<decisions>
## Implementation Decisions

### Submission Form Flow
- Step-by-step wizard: Location → Photos → Details → Review
- Progress bar at top showing current step
- Search-first location picker with autocomplete (type room name/number → instant matches showing full Building → Area → Room hierarchy)
- Camera + gallery combined: single "Add Photo" button opens native file picker (on mobile, OS offers camera or gallery). Up to 5 photos. Thumbnails with remove button. Adapts existing ImageDropZone component
- AI auto-fills category after photos upload — pre-selects the category dropdown with subtle "AI suggested: [Category]" label. User can easily override
- AI multi-issue detection runs on the Review step (after all fields complete). If detected: banner with "Split into 2 tickets" button. First ticket keeps original data, AI pre-fills second ticket with detected second issue (same location, suggested title). User edits and submits second ticket. Two MT- numbers generated
- Multi-issue suggestion is dismissable — "Submit as one ticket anyway" option alongside "Split into 2 tickets"
- Anyone can schedule tickets for a future date via optional "Schedule for later" date picker in the wizard

### Ticket List Views — My Requests
- Compact card grid (NOT full-width cards) — 2 columns on tablet, 3 on desktop, stacked single column on mobile
- Each card: ticket number, title, status badge, priority badge, category tag, submitted date, assigned tech (if any)
- Tap card to open full-page detail

### Ticket List Views — Work Orders
- Filtered sortable table for the maintenance team
- Columns: ticket #, title, status, priority, category, location, assigned tech, age
- Filter bar at top: status, priority, category, campus, technician, keyword search, unassigned toggle
- Default sort: priority (Urgent first → Low last), then age (oldest first within same priority)
- Inline quick actions per row: … menu with Claim, Assign, Change Status
- SCHEDULED tickets in a separate collapsible section below the main table, sorted by scheduled date

### Ticket Detail Page
- Full page at `/maintenance/tickets/[id]` (not drawer or modal)
- Two-column layout: info left, activity right. Stacks vertically on mobile
- Left column: submitter info, location hierarchy, photos (full-size on click), category/priority, assignment
- Right column: status progress bar at top (horizontal tracker showing all 8 statuses, current one highlighted), then chronological activity feed + comment box + action buttons
- Same page for all roles — submitters see fewer actions (can view status, their photos, public activity, add comments; cannot see internal notes or perform status changes/assignments)
- Internal comments (isInternal flag on TicketActivity) visible only to technicians and Head

### Hold & QA Gate Behaviors
- ON_HOLD gate: inline form expansion — clicking "On Hold" action expands an inline form with hold reason dropdown (PARTS/VENDOR/ACCESS/OTHER) + optional note field + confirm button. No modal
- QA gate: modal with photo upload + completion note — when tech moves to QA, modal opens requiring completion photo(s) and completion note. Required fields before submit
- QA→DONE sign-off: review panel on detail page — Head sees a QA review section with labor hours summary, cost summary, completion photos, completion note. Two buttons: "Approve & Close" (→DONE) or "Send Back" (→IN_PROGRESS with rejection note required)

### Technician Self-Claim
- Work Orders view defaults to showing tickets matching the tech's specialties (from TechnicianProfile.specialties[])
- "Show all" toggle reveals all tickets; non-matching rows grayed out
- "Claim" button appears only on unclaimed tickets matching the tech's specialty
- Instant claim — no confirmation dialog. Click "Claim" and it's assigned. Optimistic UI update
- Claiming auto-moves ticket from BACKLOG → TODO (one step: claim + status transition)
- Head assignment also auto-moves to TODO

### Scheduled Tickets
- SCHEDULED tickets displayed in a separate collapsible section below the main Work Orders table
- Sorted by scheduled date (soonest first)
- SCHEDULED → BACKLOG auto-transition triggered by hourly cron job (same cron as 48h stale ticket alerts)
- Any authenticated user can schedule tickets during submission via optional date picker

### Notification Strategy
- All 11 notification triggers fire instantly (no batching/digest)
- Every email trigger also creates an in-app notification (mirror all 11)
- Email tone: professional but warm — "Your maintenance request MT-0042 has been assigned to Mike. We'll keep you updated."
- 48h stale ticket alert (NOTIF-09): hourly cron job queries BACKLOG tickets older than 48h with no assignment, sends one alert per ticket, marks as alerted to prevent duplicates
- Cron job handles both: 48h stale alerts AND scheduled ticket auto-transitions

### Claude's Discretion
- Exact wizard step transitions and animations
- Photo upload progress indicator design
- Search autocomplete debounce timing and result display
- Status progress bar visual design (colors, spacing, active/completed states)
- Table column widths and responsive breakpoints
- Inline quick action menu design
- Email template HTML/MJML layout details
- Cron job implementation (Vercel cron vs API route with external trigger)
- Activity feed entry design (icons, timestamps, formatting)
- Scheduled section collapse/expand behavior

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ImageDropZone.tsx`: drag-and-drop, base64 encode, POST to API. Handles file type validation, 5MB limit, upload spinner, drag-over state, remove button. Adapt for mobile camera capture
- `useCampusLocations()` hook: returns flat list of buildings/areas. Extend for room-level selection using raw `/api/campus/lookup` API which returns full Building → Area → Room tree
- `notificationService.ts`: `createNotification()` and `createBulkNotifications()` — fire-and-forget. Extend `NotificationType` union with maintenance types (DB field is plain String, no migration needed)
- `emailService.ts`: `sendBrandedEmail()` with MJML templates via Resend. Add maintenance templates following existing `sendEventApprovedEmail` pattern
- `storageService.ts`: base64-to-Buffer upload pattern to Supabase Storage. Add `uploadMaintenancePhoto()` function for new `maintenance-photos` bucket
- `ConfirmDialog` component: for QA completion modal
- Glassmorphism classes: `ui-glass`, `ui-glass-hover`, `ui-glass-table`, `ui-glass-overlay`
- Framer Motion variants in `src/lib/animations.ts`

### Established Patterns
- Forms use plain controlled state with `useState` (no React Hook Form). Zod validation server-side only
- API routes follow: `getOrgIdFromRequest` → `getUserContext` → `assertCan` → `runWithOrgContext` → `prisma` operations
- Ticket number generation via `rawPrisma.$transaction` incrementing `MaintenanceCounter.lastTicketNumber` (counter excluded from org-scoped models)
- Tab switching uses `className={activeTab === 'x' ? 'animate-[fadeIn]' : 'hidden'}` — no unmount
- Input classes: `w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white`

### Integration Points
- `/src/app/api/maintenance/tickets/` — greenfield, no existing routes
- `MyRequestsView.tsx` — replace empty state with submission form + card grid
- Work Orders tab placeholder — replace with filtered table
- `MaintenanceDashboard.tsx` — wire hardcoded zeros to new `/api/maintenance/dashboard` aggregate route
- `notificationService.ts` — extend `NotificationType` union
- `emailService.ts` + `templates.ts` — add 7+ maintenance email templates
- `Sidebar.tsx` — badge count for unclaimed matching-specialty tickets (future enhancement)
- New Supabase Storage bucket: `maintenance-photos`
- Cron endpoint for 48h alerts + scheduled ticket transitions

</code_context>

<specifics>
## Specific Ideas

- Cards in My Requests must NOT be full-width — use a constrained card grid (2-col tablet, 3-col desktop, single-col mobile)
- The submission wizard should feel fast and focused — one thing per screen, clear progress indicator
- AI category suggestion should be helpful but not presumptuous — auto-fill with easy override, subtle "AI suggested" label
- Multi-issue detection is a suggestion, not a blocker — users can always submit as-is
- Instant claim with no confirmation dialog — maintenance teams move fast, clicking "Claim" should just work
- Hold reason uses inline expansion (no modal) — quick and contextual
- QA completion uses a modal — more prominent because it's a significant action requiring evidence (photo + note)
- Head QA sign-off uses a review panel on the detail page — they need to see labor/cost summaries alongside completion evidence before approving

</specifics>

<deferred>
## Deferred Ideas

- IT Help Desk as second module under "Support" section — future milestone (carried from Phase 1)
- Kanban board with drag-and-drop — Phase 3
- AI diagnostic panel (likely diagnosis, tools, parts, step-by-step fix) — Phase 3
- PPE/safety panel for Custodial/Biohazard — Phase 3
- Ask AI free-form troubleshooting — Phase 3
- Sidebar badge count for unclaimed matching-specialty tickets — nice-to-have, defer to Phase 3 or later

</deferred>

---

*Phase: 02-core-tickets*
*Context gathered: 2026-03-05*
