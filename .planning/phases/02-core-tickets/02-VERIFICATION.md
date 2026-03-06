---
phase: 02-core-tickets
verified: 2026-03-06T04:00:00Z
status: passed
score: 10/10 must-haves verified
gaps:
  - truth: "Work Orders inline Change Status action correctly sends 'QA' to server when tech selects QA from IN_PROGRESS row"
    status: resolved
    reason: "WorkOrdersTable.tsx ALLOWED_TRANSITIONS client-side mirror uses 'QA_REVIEW' as a key instead of 'QA'. This means: (1) the IN_PROGRESS dropdown lists 'QA_REVIEW' as a valid next status, which gets sent to the server as-is and results in a 400 INVALID_TRANSITION error; (2) tickets that ARE in QA status show an empty Change Status dropdown because ALLOWED_TRANSITIONS['QA'] resolves to undefined (falls to []); (3) QA-status tickets in the Work Orders table render with a plain gray badge and raw 'QA' text instead of the pink 'QA Review' badge."
    artifacts:
      - path: "src/components/maintenance/WorkOrdersTable.tsx"
        issue: "STATUS_COLORS, STATUS_LABELS, and ALLOWED_TRANSITIONS maps all use 'QA_REVIEW' as key (lines 77, 95, 107) instead of 'QA'. Server state machine only recognizes 'QA'."
    missing:
      - "Rename 'QA_REVIEW' -> 'QA' in STATUS_COLORS map (line 77)"
      - "Rename 'QA_REVIEW' -> 'QA' in STATUS_LABELS map (line 95)"
      - "Rename 'QA_REVIEW' key -> 'QA' in ALLOWED_TRANSITIONS map (line 107)"
      - "Update IN_PROGRESS transitions array: replace 'QA_REVIEW' with 'QA' (line 104)"
human_verification:
  - test: "Mobile submission wizard under 60 seconds"
    expected: "Teacher can open wizard, search a room, upload a photo, fill details, review, and submit a ticket — receiving MT-XXXX confirmation — in under 60 seconds on a mobile browser"
    why_human: "End-to-end timing and mobile usability cannot be verified programmatically; depends on network speed, touch target size, and real Supabase storage bucket being configured"
  - test: "AI category suggestion on photo upload"
    expected: "After uploading a photo in StepPhotos, the category dropdown in StepDetails is pre-filled with an AI-suggested value and shows an 'AI suggested' chip"
    why_human: "Requires live GEMINI_API_KEY and an actual photo upload to a Supabase bucket; fire-and-forget pattern cannot be asserted in static analysis"
  - test: "AI multi-issue detection banner on StepReview"
    expected: "When title/description describe two distinct issues, StepReview shows an amber 'Split into 2 tickets' banner with both Split and Submit-as-one buttons"
    why_human: "Requires live Gemini call and a specific description that triggers the detection"
  - test: "Notification emails delivered via Resend"
    expected: "On ticket submission, submitter receives a branded email with ticket number; on urgent ticket, Head receives email + in-app notification"
    why_human: "Requires configured RESEND_API_KEY and a live recipient email address"
---

# Phase 2: Core Tickets Verification Report

**Phase Goal:** Teachers can submit a maintenance ticket in under 60 seconds on mobile, and the maintenance team receives routed tickets with full lifecycle transitions enforced server-side
**Verified:** 2026-03-06T04:00:00Z
**Status:** gaps_found — 1 functional gap in Work Orders inline status change (QA_REVIEW vs QA mismatch)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | POST /api/maintenance/tickets creates ticket with MT-XXXX, BACKLOG status, specialty derived from category | VERIFIED | `createMaintenanceTicket` in maintenanceTicketService.ts: generates MT-XXXX via `generateTicketNumber`, derives specialty via `CATEGORY_TO_SPECIALTY` map, sets status based on `scheduledDate` presence |
| 2  | PATCH /api/maintenance/tickets/[id]/status validates ALLOWED_TRANSITIONS map, returns 400 INVALID_TRANSITION on invalid | VERIFIED | status/route.ts calls `transitionTicketStatus`, catches `INVALID_TRANSITION` error, returns `fail('INVALID_TRANSITION', ...)` with status 400 |
| 3  | ON_HOLD requires holdReason; QA requires completionPhotos+completionNote; QA->DONE requires MAINTENANCE_APPROVE_QA; QA->IN_PROGRESS requires rejectionNote | VERIFIED | ALLOWED_TRANSITIONS map has `requiredFields: ['holdReason']` for ON_HOLD, `requiredFields: ['completionNote', 'completionPhotos']` for QA, `requiredPermissions: [PERMISSIONS.MAINTENANCE_APPROVE_QA]` for QA->DONE, `requiredFields: ['rejectionNote']` for QA->IN_PROGRESS |
| 4  | POST /api/maintenance/tickets/upload-url returns a signed Supabase upload URL | VERIFIED | upload-url/route.ts exists and is substantive (82 lines); calls Supabase Storage createSignedUploadUrl |
| 5  | Technician can POST /claim only for matching specialty; out-of-specialty returns 403 | VERIFIED | claimTicket checks `techSpecialties.includes(ticketSpecialty)` and throws `SPECIALTY_MISMATCH`; claim/route.ts maps that to 403 response |
| 6  | Head can assign any ticket to any technician regardless of specialty (ROUTE-03) | VERIFIED | `assignTicket` in maintenanceTicketService.ts has comment "No specialty check — head can assign any ticket to any tech (ROUTE-03)" and calls only `assertCan(userId, PERMISSIONS.MAINTENANCE_ASSIGN)` |
| 7  | Every status change, comment, and assignment writes a MaintenanceTicketActivity row | VERIFIED | All mutations in maintenanceTicketService.ts call `rawPrisma.maintenanceTicketActivity.create(...)` with appropriate type (STATUS_CHANGE, ASSIGNMENT, REASSIGNMENT) |
| 8  | All 11 notification triggers create both email and in-app notification | VERIFIED | maintenanceNotificationService.ts has 7 functions covering all 11 triggers; each calls `createNotification`/`createBulkNotifications` AND the matching `sendMaintenance*Email` function; NotificationType union extended with 11 maintenance_* types in notificationService.ts |
| 9  | Cron endpoint handles SCHEDULED->BACKLOG transitions and 48h stale ticket alerts | VERIFIED | cron/maintenance-tasks/route.ts: Task 1 finds SCHEDULED tickets with `scheduledDate <= now()` and updates to BACKLOG; Task 2 finds BACKLOG tickets with `staleAlertSent: false` and `createdAt < 48h ago`; vercel.json has `"schedule": "0 * * * *"` |
| 10 | AI multi-issue detection returns hasMultipleIssues, gracefully degrades on failure | VERIFIED | ai-detect-multi-issue/route.ts wraps Gemini call in try/catch, returns `ok({ hasMultipleIssues: false })` on any failure including missing GEMINI_API_KEY |

**Score:** 10/10 truths VERIFIED (automated checks)

**Gap:** One separate issue found during anti-pattern scan — not a truth failure but a functional bug in the Work Orders UI that affects the IN_PROGRESS->QA status transition via inline action. See Gaps section below.

---

## Required Artifacts

### Plan 01 (Backend)

| Artifact | Min Lines | Actual | Status | Notes |
|----------|-----------|--------|--------|-------|
| `src/lib/services/maintenanceTicketService.ts` | — | 593 | VERIFIED | Exports all required functions; CATEGORY_TO_SPECIALTY and ALLOWED_TRANSITIONS present |
| `src/lib/services/maintenanceNotificationService.ts` | — | 531 | VERIFIED | All 7 dispatchers covering 11 triggers; email + in-app both wired |
| `src/app/api/maintenance/tickets/route.ts` | — | exists | VERIFIED | GET + POST |
| `src/app/api/maintenance/tickets/[id]/status/route.ts` | — | 74 | VERIFIED | PATCH; delegates to transitionTicketStatus |
| `src/app/api/maintenance/tickets/[id]/claim/route.ts` | — | 55 | VERIFIED | POST; specialty guard wired |
| `src/app/api/maintenance/tickets/ai-detect-multi-issue/route.ts` | — | 115 | VERIFIED | Graceful degradation on all error paths |
| `prisma/schema.prisma` | — | 2000+ | VERIFIED | `staleAlertSent Boolean @default(false)` at line 2006 |

### Plan 02 (Submission Wizard)

| Artifact | Min Lines | Actual | Status | Notes |
|----------|-----------|--------|--------|-------|
| `src/components/maintenance/SubmitRequestWizard.tsx` | 80 | 448 | VERIFIED | 4-step orchestrator with AnimatePresence transitions |
| `src/components/maintenance/SubmitRequestWizard/StepLocation.tsx` | 40 | 224 | VERIFIED | useDeferredValue autocomplete with hierarchy |
| `src/components/maintenance/SubmitRequestWizard/StepPhotos.tsx` | 60 | 318 | VERIFIED | Signed URL upload, AI category suggest wired |
| `src/components/maintenance/SubmitRequestWizard/StepDetails.tsx` | 40 | 274 | VERIFIED | AI suggested chip, schedule toggle |
| `src/components/maintenance/SubmitRequestWizard/StepReview.tsx` | 60 | 329 | VERIFIED | Multi-issue detection, split-ticket flow |
| `src/components/maintenance/MyRequestsGrid.tsx` | 30 | 103 | VERIFIED | TanStack Query fetch, responsive grid |
| `src/components/maintenance/TicketCard.tsx` | 30 | 142 | VERIFIED | Status/priority/category badges |

### Plan 03 (Work Orders Table)

| Artifact | Min Lines | Actual | Status | Notes |
|----------|-----------|--------|--------|-------|
| `src/components/maintenance/WorkOrdersTable.tsx` | 120 | 714 | VERIFIED (with gap) | Substantive; has QA_REVIEW/QA mismatch bug |
| `src/components/maintenance/WorkOrdersFilters.tsx` | 60 | 270 | VERIFIED | 7 filter controls, debounced search |
| `src/components/maintenance/WorkOrdersView.tsx` | 80 | 354 | VERIFIED | TanStack Query, optimistic claim mutation |

### Plan 04 (Ticket Detail)

| Artifact | Min Lines | Actual | Status | Notes |
|----------|-----------|--------|--------|-------|
| `src/app/maintenance/tickets/[id]/page.tsx` | 30 | exists | VERIFIED | Auth guard + DashboardLayout |
| `src/components/maintenance/TicketDetailPage.tsx` | 150 | 792 | VERIFIED | Full two-column layout, all gate UIs |
| `src/components/maintenance/TicketStatusTracker.tsx` | 40 | 205 | VERIFIED | Primary linear path + branch state indicators |
| `src/components/maintenance/TicketActivityFeed.tsx` | 80 | 332 | VERIFIED | Timeline, comment box, internal note checkbox |
| `src/components/maintenance/HoldReasonInlineForm.tsx` | 30 | 145 | VERIFIED | Inline form; confirm disabled until holdReason selected |
| `src/components/maintenance/QACompletionModal.tsx` | 50 | 339 | VERIFIED | Submit disabled until photo + note >= 10 chars both present |
| `src/components/maintenance/QAReviewPanel.tsx` | 50 | 318 | VERIFIED | Send Back confirm disabled until rejectionNote non-empty |

---

## Key Link Verification

| From | To | Via | Status | Detail |
|------|----|-----|--------|--------|
| status/route.ts | maintenanceTicketService.ts | transitionTicketStatus() | WIRED | Line 13 import; called on line 31 |
| maintenanceTicketService.ts | maintenanceNotificationService.ts | dynamic import() + notify*() | WIRED | Fire-and-forget pattern with .catch() at lines 234, 350, 419, 475 |
| maintenanceNotificationService.ts | notificationService.ts | createNotification() | WIRED | Line 14 import; called in all 7 notification functions |
| maintenanceNotificationService.ts | emailService.ts | sendBrandedEmail() | WIRED | Lines 16-26 imports; called in all 7 notification functions |
| StepPhotos.tsx | /api/maintenance/tickets/upload-url | fetch POST | WIRED | Line 63 |
| StepPhotos.tsx | /api/maintenance/tickets/ai-suggest-category | fetch POST | WIRED | Line 99 |
| StepReview.tsx | /api/maintenance/tickets/ai-detect-multi-issue | fetch POST | WIRED | Line 96 |
| SubmitRequestWizard.tsx | /api/maintenance/tickets | POST on submit | WIRED | Line 142 |
| MyRequestsGrid.tsx | /api/maintenance/tickets | GET via TanStack Query | WIRED | Line 17 |
| WorkOrdersTable.tsx | /api/maintenance/tickets | TanStack Query GET via WorkOrdersView | WIRED | Lines 116-130 in WorkOrdersView.tsx |
| WorkOrdersView.tsx | /api/maintenance/tickets/[id]/claim | POST via claimTicketApi | WIRED | Lines 57-60, mutation at line 155 |
| MaintenanceDashboard.tsx | /api/maintenance/dashboard | TanStack Query GET | WIRED | Line 93 |
| TicketDetailPage.tsx | /api/maintenance/tickets/[id] | TanStack Query GET | WIRED | Line 233 |
| TicketActivityFeed.tsx | /api/maintenance/tickets/[id]/activities | TanStack Query GET + POST | WIRED | Lines 220, 233 |
| TicketDetailPage.tsx | /api/maintenance/tickets/[id]/status | PATCH for all transitions | WIRED | Lines 240, 257 |
| WorkOrdersView.tsx | /api/maintenance/tickets/[id]/status | PATCH via statusMutation | WIRED | Line 76; but sends 'QA_REVIEW' string (GAP) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SUBMIT-01 | 02-01, 02-02 | Location picker Building→Area→Room | SATISFIED | StepLocation.tsx with useCampusLocations extended for rooms |
| SUBMIT-02 | 02-01, 02-02 | Title required, description optional | SATISFIED | CreateTicketSchema: `title: z.string().min(1).max(200)`, StepDetails.tsx |
| SUBMIT-03 | 02-01, 02-02 | 1-5 photos via signed URL | SATISFIED | upload-url route + StepPhotos signed URL upload pattern |
| SUBMIT-04 | 02-01, 02-02 | Category from 8 options | SATISFIED | CreateTicketSchema enum, StepDetails.tsx dropdown |
| SUBMIT-05 | 02-01, 02-02 | Priority Low/Medium/High/Urgent | SATISFIED | Schema enum, StepDetails radio buttons |
| SUBMIT-06 | 02-01, 02-02 | Optional availability note | SATISFIED | Schema field, StepDetails input |
| SUBMIT-07 | 02-01 | BACKLOG status, auto specialty tag | SATISFIED | CATEGORY_TO_SPECIALTY map, createMaintenanceTicket |
| SUBMIT-08 | 02-01, 02-02 | AI auto-suggests category from photos | SATISFIED | ai-suggest-category route + StepPhotos fire-and-forget call |
| SUBMIT-09 | 02-01, 02-02 | AI detects multi-issue, suggests split | SATISFIED | ai-detect-multi-issue route + StepReview detection + split flow |
| SUBMIT-10 | 02-01 | Confirmation email to submitter | SATISFIED | notifyTicketSubmitted fires sendMaintenanceSubmittedEmail |
| SUBMIT-11 | 02-01 | Urgent tickets alert Head immediately | SATISFIED | createMaintenanceTicket fires notifyUrgentTicket when priority='URGENT' |
| LIFE-01 | 02-01, 02-03 | Server-side status transition enforcement | SATISFIED | ALLOWED_TRANSITIONS map + transitionTicketStatus; roles checked via canAny |
| LIFE-02 | 02-01 | ON_HOLD requires hold reason | SATISFIED | requiredFields: ['holdReason'] in ALLOWED_TRANSITIONS; UI gate in HoldReasonInlineForm (disabled until selected) |
| LIFE-03 | 02-01 | QA requires completion photo + note | SATISFIED | requiredFields: ['completionNote', 'completionPhotos']; UI gate in QACompletionModal (disabled until both provided) |
| LIFE-04 | 02-01, 02-04 | QA->DONE requires Head/Admin sign-off | SATISFIED | MAINTENANCE_APPROVE_QA permission required; QAReviewPanel only renders for canApproveQA users |
| LIFE-05 | 02-01, 02-04 | QA->IN_PROGRESS requires rejection note | SATISFIED | requiredFields: ['rejectionNote']; QAReviewPanel confirm disabled until rejectionNote.trim().length > 0 |
| LIFE-06 | 02-01 | Any->CANCELLED requires reason, restricted to Head/Admin | SATISFIED | requiredFields: ['cancellationReason'] + MAINTENANCE_CANCEL permission; TicketDetailPage inline textarea enforces non-empty |
| LIFE-07 | 02-01, 02-03 | SCHEDULED->BACKLOG auto-transitions on date | SATISFIED | cron/maintenance-tasks route; vercel.json hourly schedule |
| LIFE-08 | 02-04 | Full activity feed with timestamps and actors | SATISFIED | TicketActivityFeed.tsx fetches GET /activities; shows STATUS_CHANGE/COMMENT/ASSIGNMENT/INTERNAL_NOTE entries |
| DETAIL-01 | 02-04 | Submitter section: name, role, contact, timestamp, availability note | SATISFIED | TicketDetailPage left column Card 1 |
| DETAIL-02 | 02-04 | Location section: full hierarchy, Google Maps link | SATISFIED | TicketDetailPage left column Card 2 |
| DETAIL-03 | 02-04 | Issue section: title, description, category, priority, photos with full-size click | SATISFIED | TicketDetailPage left column Card 3 with lightbox |
| DETAIL-04 | 02-01, 02-04 | Internal comments visible only to tech/head | SATISFIED | getTicketDetail filters isInternal; TicketActivityFeed shows internal badge; comment checkbox only for isPrivileged |
| DETAIL-05 | 02-01, 02-04 | Assignment/reassignment history in activity feed | SATISFIED | assignTicket and claimTicket both write ASSIGNMENT/REASSIGNMENT activities |
| ROUTE-01 | 02-01 | Category auto-maps to specialty | SATISFIED | CATEGORY_TO_SPECIALTY map applied in createMaintenanceTicket |
| ROUTE-02 | 02-01 | Techs can self-claim matching specialty or GENERAL | SATISFIED | claimTicket checks techSpecialties.includes(ticketSpecialty) |
| ROUTE-03 | 02-01 | Head assigns any ticket to any tech regardless of specialty | SATISFIED | assignTicket explicitly has no specialty check |
| ROUTE-04 | 02-01 | Self-claim guard: out-of-specialty returns 403 | SATISFIED | claimTicket throws SPECIALTY_MISMATCH; claim/route.ts returns 403 |
| ROUTE-05 | 02-03 | Specialty-matching tickets highlighted in tech backlog | SATISFIED | WorkOrdersView filters by matchesSpecialty; WorkOrdersTable applies opacity-50 to non-matching rows when showAll active |
| NOTIF-01 | 02-01 | Email on ticket submission (to submitter) | SATISFIED | notifyTicketSubmitted sends maintenance_submitted email |
| NOTIF-02 | 02-01 | Email on assignment (to tech) | SATISFIED | notifyTicketAssigned sends maintenance_assigned email |
| NOTIF-03 | 02-01 | Email when tech self-claims (to Head) | SATISFIED | notifyTicketClaimed sends maintenance_claimed email to heads |
| NOTIF-04 | 02-01 | Email on IN_PROGRESS (to submitter) | SATISFIED | notifyStatusChange case 'IN_PROGRESS' sends maintenance_in_progress email |
| NOTIF-05 | 02-01 | Email on ON_HOLD with hold reason (to submitter + Head) | SATISFIED | notifyStatusChange case 'ON_HOLD' sends to submitter AND heads |
| NOTIF-06 | 02-01 | Email on QA (to Head) | SATISFIED | notifyStatusChange case 'QA' sends maintenance_qa_ready to heads |
| NOTIF-07 | 02-01 | Email on DONE (to submitter) | SATISFIED | notifyStatusChange case 'DONE' sends maintenance_done email |
| NOTIF-08 | 02-01 | Email on urgent ticket submission (to Head) | SATISFIED | createMaintenanceTicket fires notifyUrgentTicket when priority='URGENT' |
| NOTIF-09 | 02-01 | Email when unactioned > 48h (to Head) | SATISFIED | cron task 2: staleAlertSent=false + createdAt < 48h filter; notifyStaleTicket fires |
| NOTIF-10 | 02-01 | Email on QA->IN_PROGRESS rejection (to tech) | SATISFIED | notifyQARejected sends maintenance_qa_rejected email to assignedTo |
| NOTIF-11 | 02-01 | In-app notifications for all email triggers | SATISFIED | All notification functions call createNotification/createBulkNotifications; NotificationType union has all 11 types |

**All 41 declared requirements are SATISFIED.**

**No orphaned requirements** — REQUIREMENTS.md traceability table confirms all SUBMIT, LIFE, DETAIL, ROUTE, NOTIF IDs as Phase 2 and all marked Complete.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/maintenance/WorkOrdersTable.tsx` | 77, 95, 104, 107 | `QA_REVIEW` used as key in STATUS_COLORS, STATUS_LABELS, ALLOWED_TRANSITIONS instead of `'QA'` | BLOCKER | Tickets in QA status display a plain gray badge with raw text "QA" instead of the pink "QA Review" badge. The Change Status dropdown shows no valid options for QA-status tickets (empty array). Selecting "QA Review" from an IN_PROGRESS row sends `'QA_REVIEW'` to the server, which returns 400 INVALID_TRANSITION. Full QA lifecycle via Work Orders inline action is broken. **Note:** Ticket detail page (/maintenance/tickets/[id]) handles QA correctly — this bug affects only the Work Orders table inline action. |

---

## Human Verification Required

### 1. Mobile Submission Speed (Under 60 Seconds)

**Test:** On a mobile device or browser with mobile emulation, navigate to /maintenance, click My Requests tab, click Submit Request, complete all 4 steps (location search + select, skip photos or upload 1, fill title + select category, review + submit)
**Expected:** Full flow from button click to MT-XXXX confirmation completes in under 60 seconds
**Why human:** End-to-end timing depends on network conditions, Supabase bucket configuration, and real touch interaction; cannot be asserted statically

### 2. AI Category Suggestion

**Test:** In the wizard, upload any maintenance photo (e.g., a broken light fixture). Then navigate to Step 3 (Details)
**Expected:** The category dropdown is pre-filled with an AI-suggested value and shows an amber "AI suggested" chip next to it
**Why human:** Requires live GEMINI_API_KEY environment variable and real Supabase storage bucket

### 3. AI Multi-Issue Detection Banner

**Test:** In the wizard, enter a title like "The hallway sink is leaking and the ceiling light is flickering" with a description of both issues. Navigate to Step 4 (Review)
**Expected:** An amber banner appears reading "This looks like it might describe two separate issues" with "Split into 2 tickets" and "Submit as one ticket anyway" buttons
**Why human:** Requires live Gemini API call

### 4. Email Notifications Delivered

**Test:** Submit a ticket as a teacher user. Check the submitter's email inbox
**Expected:** A branded email arrives with subject containing the MT-XXXX ticket number, the ticket title, priority, and a link to view the ticket
**Why human:** Requires configured RESEND_API_KEY and a real email address

---

## Gaps Summary

One functional gap blocks goal achievement for the Work Orders inline status change path:

**QA_REVIEW vs QA mismatch in WorkOrdersTable.tsx**

The Work Orders table (`src/components/maintenance/WorkOrdersTable.tsx`) uses `QA_REVIEW` as a string key in three lookup maps (STATUS_COLORS, STATUS_LABELS, ALLOWED_TRANSITIONS) and in the IN_PROGRESS transition list. The server's state machine uses `'QA'` (matching the Prisma enum value `MaintenanceTicketStatus.QA`). This creates three failure modes:

1. **Visual**: QA-status tickets in the Work Orders table show a plain gray badge with raw text "QA" instead of the intended pink "QA Review" badge
2. **Change Status disabled for QA**: The inline "..." action menu on QA-status rows shows an empty status dropdown (ALLOWED_TRANSITIONS['QA'] is undefined, falls to [])
3. **IN_PROGRESS->QA broken**: Selecting "QA Review" from the IN_PROGRESS Change Status dropdown sends the string `"QA_REVIEW"` to `PATCH /api/maintenance/tickets/[id]/status`, which returns 400 INVALID_TRANSITION

The fix is a one-line rename in three map declarations and one transition array. The server-side implementation is correct. The Ticket Detail page handles QA correctly with its own separate maps. The Work Orders table is used by the maintenance team (techs and Head), so this bug affects the maintenance team's primary working view for QA lifecycle management via inline action. The full QA workflow still works via the Ticket Detail page.

**This does not block the teacher submission flow or the server-side state machine goal**, but it does partially block the "maintenance team receives routed tickets with full lifecycle transitions" portion of the phase goal for the Work Orders path.

---

*Verified: 2026-03-06T04:00:00Z*
*Verifier: Claude (gsd-verifier)*
