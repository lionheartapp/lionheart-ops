# Phase 21: Documents, Groups, Communication, and Day-Of Tools - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff can track document completion, assign participants to groups, communicate with targeted audiences, and run day-of operations (QR check-in, incident logging, headcounts) from a PWA that works offline. Covers requirements DOC-01 through DOC-03, GRP-01 through GRP-06, QR-01 through QR-05, COM-01, COM-02, COM-04, COM-05. Budget (BUD-*), AI features (AI-*), notification orchestration (COM-03), and external integrations (INT-*) are Phase 22.

</domain>

<decisions>
## Implementation Decisions

### Document tracking & compliance

- **Hybrid document model** — Some documents (waivers, permission slips) are signed during registration (existing Phase 20 signature capture). Others are tracked as outstanding items post-registration (doctor's physical, insurance card upload, external forms). Staff sees a unified completion view across both types.
- **Matrix view dashboard** — Participants as rows, documents as columns, checkmarks/X marks in cells. One glance shows who's missing what. Filter by status (complete, incomplete, overdue). Click a cell to see detail or send individual reminder.
- **Automated deadline reminders** — Staff sets a due date per required document. System automatically sends reminders at intervals (e.g., 7 days before, 3 days before, 1 day before). Staff can also send manual ad-hoc reminders from the matrix view.
- **Compliance checklist** — Predefined checklist for off-campus events (liability insurance, vehicle inspection, driver background checks, vendor contracts, venue safety cert, emergency action plan). Staff can edit, delete, or add custom items. Each item has: status (not started, in progress, complete), assignee, due date, file upload slot.

### Group assignment & printable PDFs

- **Pool-to-groups drag interface** — Left side: unassigned participant pool (searchable, filterable by grade/gender). Right side: group cards with capacity bars. Drag participants from pool into groups. Each participant card shows name, grade, photo, medical flag icon. Uses existing @dnd-kit library and follows KanbanBoard pattern.
- **Auto-assign with manual adjustment** — "Auto-assign" button distributes remaining unassigned participants into groups (balanced by capacity, optionally by grade/gender). Staff then manually adjusts by dragging between groups. Best of both worlds.
- **Tabbed by group type** — Tabs across top: Buses | Cabins | Small Groups | Activities. Each tab has its own pool-to-groups drag interface. A participant's bus assignment is independent of their cabin assignment. Consistent with EventProjectTabs pattern.
- **School-branded professional PDFs** — All 6 printable formats (bus manifests, cabin rosters, medical summaries, emergency contacts, activity rosters, check-in sheets) include school logo, event name, date, and clean table layouts. Bus manifests include medical flag icons. Cabin rosters include participant photos. Uses jsPDF (already installed).
- **Activity selection during registration** — Parents pick elective activities (archery, kayaking, etc.) as a step in the registration wizard. Shows available activities with capacity remaining. Staff can override later. Locks in choices early.

### Day-of operations & offline

- **Full-screen scan mode for check-in** — Dedicated check-in screen: large camera viewfinder top half, participant info flash card bottom half (name, photo, medical flags, group assignments). Real-time counter in header (32/150 checked in). Audio/haptic feedback on successful scan. List view toggle to see all and manually check in.
- **Offline scope: check-in + rosters + incidents** — Full offline support for QR scanning/check-in (queue syncs when online), roster viewing (cached participant list with photos), and incident logging (saved locally, syncs later). Headcount derived from local check-in data. Uses Dexie (new event-specific tables) + Serwist cache rules.
- **Structured incident form** — Incident type (medical, behavioral, safety, other), severity (minor/moderate/serious), involved participants (multi-select from roster), description text, actions taken, follow-up needed (yes/no + notes). Timestamp auto-captured. Photo attachment optional. Works offline with sync.
- **Participant self-service QR** — Participants scan their own QR code to view personal schedule, group assignments, and event announcements without staff assistance (QR-03). Separate from staff check-in flow.

### Communication & real-time collaboration

- **Email + portal + in-app delivery** — Announcements send email to registration email address, appear on parent's magic-link portal in real time, AND create in-app notifications for tagged staff. Parents don't have in-app accounts — email + portal is their channel.
- **Avatar presence bar** — Top of event project page: row of avatar circles showing who's currently viewing/editing. Click to see name and what tab they're on. Similar to Google Docs/Figma presence. Uses Supabase Realtime (installed but not yet wired up). First WebSocket/real-time feature in the platform.
- **Feedback surveys reuse form builder** — Staff creates post-event feedback survey using the same registration form builder (sections, fields, required toggles). Survey becomes available at the same registration URL after event ends. Parents access via existing magic link. Responses tracked per-registration.

### Claude's Discretion
- Exact auto-assign algorithm for group distribution (balance by grade, gender, capacity)
- Reminder interval configuration (7/3/1 day defaults vs. custom)
- PDF layout details (font sizes, column widths, photo sizes)
- Offline sync conflict resolution strategy
- Supabase Realtime channel structure for presence
- Check-in audio/haptic feedback implementation
- Safari Background Sync fallback UX (noted in STATE.md as pending TODO)
- Headcount derivation logic from check-in data

</decisions>

<specifics>
## Specific Ideas

- Pool-to-groups drag interface should feel like the existing Kanban board but for people, not tickets
- PDFs should feel professional — the kind of thing a school would hand to a bus driver or camp counselor
- Check-in scan mode should be optimized for speed — scanning 40 kids off a bus back-to-back
- Compliance checklist items are per-event, not global — a field trip has different requirements than an overnight camp
- Activity signup happens during registration, not as a separate post-registration step

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `qrcode` (v1.5.4) + `html5-qrcode` (v2.3.8): Server-side QR generation and client-side camera scanning — both production-ready
- `@dnd-kit/core` + `@dnd-kit/sortable`: Drag-and-drop with KanbanBoard.tsx as reference pattern
- `jsPDF` (v4.2.0): PDF generation with label-utils.ts as reference pattern
- `Serwist` + `Dexie`: PWA/offline infrastructure with maintenance-specific tables — needs new event tables
- `@supabase/supabase-js` (v2.49.1): Supabase Realtime available but not yet wired up
- `notificationService.ts`: Bulk notification creation with type preferences and pause support
- `emailService.ts` + `registrationEmailService.ts`: Resend-backed email with QR embedding
- `RegistrationForm` + `FormBuilder`: Complete form builder with sections, fields, signatures
- `PortalView.tsx`: Parent portal with QR display, payment status, schedule view
- `storageService.ts`: Supabase Storage with signed URLs for student photos

### Established Patterns
- EventProject tabbed sections (Overview, Schedule, People, Documents, Logistics, Budget, Tasks, Comms) — Documents, Logistics, Comms are placeholder stubs ready to fill
- Registration wizard multi-step flow with COPPA consent, Turnstile CAPTCHA
- Magic link auth for parents (SHA-256 hashed tokens, 4-hour portal JWTs)
- FERPA/COPPA sensitive data in separate table with distinct permission (events:medical:read)
- TanStack Query polling for real-time updates (30s notification bell, 15s activity feed)
- Org-scoped models with runWithOrgContext pattern
- Public API routes resolve orgId from shareSlug lookup, not URL params

### Integration Points
- Check-in route `/events/check-in/{registrationId}` — URL already encoded in confirmation email QR codes but route doesn't exist yet
- EventProject.registrations relation — group assignments link to EventRegistration records
- Dexie offline db at `src/lib/offline/db.ts` — new tables for check-in queue, cached rosters, incident queue
- Service worker at `src/app/sw.ts` — new cache rules for event/check-in endpoints
- `manifest.json` — currently maintenance-only, needs event shortcuts or separate manifest scope

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-documents-groups-communication-and-day-of-tools*
*Context gathered: 2026-03-15*
