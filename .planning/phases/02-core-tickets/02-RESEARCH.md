# Phase 2: Core Tickets - Research

**Researched:** 2026-03-05
**Domain:** Ticket submission wizard, lifecycle state machine, routing, detail view, notifications, cron job
**Confidence:** HIGH — all findings based on existing codebase analysis + established patterns

## Summary

Phase 2 is the first feature-complete phase for the maintenance module. The infrastructure from Phase 1 is entirely in place: all 9 Prisma models (MaintenanceTicket, TechnicianProfile, MaintenanceTicketActivity, MaintenanceCounter, etc.), 13 permission constants, 2 new roles (maintenance-head, maintenance-technician), and the navigation shell. Phase 2 builds the full ticket engine on top of this foundation — no schema changes needed.

The primary technical challenge is the **8-status lifecycle state machine with server-side enforcement**. Every status transition must be validated: who can make it, what data is required (hold reason, completion photo, QA sign-off), and what side effects follow (activity log entry, notifications). This logic must live in a service layer, not scattered across route handlers.

The second major challenge is **photo upload**. The CONTEXT.md specifies a signed URL direct-to-Supabase pattern to bypass Next.js's 1MB body limit. The existing storageService.ts uses a base64-to-Buffer approach (which goes through the Next.js route) for logos and campus images. Phase 2 must implement a different pattern for maintenance photos: client requests a signed upload URL from the API, then uploads directly to Supabase Storage from the browser, then stores the resulting public URL.

The AI category suggestion (SUBMIT-08) and multi-issue detection (SUBMIT-09) use Gemini (`@google/genai` v1.40 is already installed). The `geminiService` in `src/lib/services/ai/gemini.service.ts` handles text parsing; Phase 2 adds image-based category suggestion. Note: REQUIREMENTS.md AI-08 specifies Anthropic Claude for the Phase 3 diagnostic panel, but Phase 2 AI features (category auto-suggest, multi-issue detection) use Gemini since that SDK is already installed and the Anthropic SDK is not.

**Primary recommendation:** Build Phase 2 in 5 tightly sequenced plans: (1) Ticket CRUD API + service layer, (2) Submission wizard + My Requests UI, (3) Work Orders table + routing, (4) Ticket detail page + activity feed, (5) Notifications + cron job. Each plan is deployable independently.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Submission Form Flow**
- Step-by-step wizard: Location → Photos → Details → Review
- Progress bar at top showing current step
- Search-first location picker with autocomplete (type room name/number → instant matches showing full Building → Area → Room hierarchy)
- Camera + gallery combined: single "Add Photo" button opens native file picker (on mobile, OS offers camera or gallery). Up to 5 photos. Thumbnails with remove button. Adapts existing ImageDropZone component
- AI auto-fills category after photos upload — pre-selects the category dropdown with subtle "AI suggested: [Category]" label. User can easily override
- AI multi-issue detection runs on the Review step (after all fields complete). If detected: banner with "Split into 2 tickets" button. First ticket keeps original data, AI pre-fills second ticket with detected second issue (same location, suggested title). User edits and submits second ticket. Two MT- numbers generated
- Multi-issue suggestion is dismissable — "Submit as one ticket anyway" option alongside "Split into 2 tickets"
- Anyone can schedule tickets for a future date via optional "Schedule for later" date picker in the wizard

**Ticket List Views — My Requests**
- Compact card grid (NOT full-width cards) — 2 columns on tablet, 3 on desktop, stacked single column on mobile
- Each card: ticket number, title, status badge, priority badge, category tag, submitted date, assigned tech (if any)
- Tap card to open full-page detail

**Ticket List Views — Work Orders**
- Filtered sortable table for the maintenance team
- Columns: ticket #, title, status, priority, category, location, assigned tech, age
- Filter bar at top: status, priority, category, campus, technician, keyword search, unassigned toggle
- Default sort: priority (Urgent first → Low last), then age (oldest first within same priority)
- Inline quick actions per row: … menu with Claim, Assign, Change Status
- SCHEDULED tickets in a separate collapsible section below the main table, sorted by scheduled date

**Ticket Detail Page**
- Full page at `/maintenance/tickets/[id]` (not drawer or modal)
- Two-column layout: info left, activity right. Stacks vertically on mobile
- Left column: submitter info, location hierarchy, photos (full-size on click), category/priority, assignment
- Right column: status progress bar at top (horizontal tracker showing all 8 statuses, current one highlighted), then chronological activity feed + comment box + action buttons
- Same page for all roles — submitters see fewer actions (can view status, their photos, public activity, add comments; cannot see internal notes or perform status changes/assignments)
- Internal comments (isInternal flag on TicketActivity) visible only to technicians and Head

**Hold & QA Gate Behaviors**
- ON_HOLD gate: inline form expansion — clicking "On Hold" action expands an inline form with hold reason dropdown (PARTS/VENDOR/ACCESS/OTHER) + optional note field + confirm button. No modal
- QA gate: modal with photo upload + completion note — when tech moves to QA, modal opens requiring completion photo(s) and completion note. Required fields before submit
- QA→DONE sign-off: review panel on detail page — Head sees a QA review section with labor hours summary, cost summary, completion photos, completion note. Two buttons: "Approve & Close" (→DONE) or "Send Back" (→IN_PROGRESS with rejection note required)

**Technician Self-Claim**
- Work Orders view defaults to showing tickets matching the tech's specialties (from TechnicianProfile.specialties[])
- "Show all" toggle reveals all tickets; non-matching rows grayed out
- "Claim" button appears only on unclaimed tickets matching the tech's specialty
- Instant claim — no confirmation dialog. Click "Claim" and it's assigned. Optimistic UI update
- Claiming auto-moves ticket from BACKLOG → TODO (one step: claim + status transition)
- Head assignment also auto-moves to TODO

**Scheduled Tickets**
- SCHEDULED tickets displayed in a separate collapsible section below the main Work Orders table
- Sorted by scheduled date (soonest first)
- SCHEDULED → BACKLOG auto-transition triggered by hourly cron job (same cron as 48h stale ticket alerts)
- Any authenticated user can schedule tickets during submission via optional date picker

**Notification Strategy**
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

### Deferred Ideas (OUT OF SCOPE)
- IT Help Desk as second module under "Support" section — future milestone
- Kanban board with drag-and-drop — Phase 3
- AI diagnostic panel (likely diagnosis, tools, parts, step-by-step fix) — Phase 3
- PPE/safety panel for Custodial/Biohazard — Phase 3
- Ask AI free-form troubleshooting — Phase 3
- Sidebar badge count for unclaimed matching-specialty tickets — nice-to-have, defer to Phase 3 or later
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SUBMIT-01 | User can select location via Building → Area → Room picker pre-populated from campus | `/api/campus/lookup` already returns full Building → Area → Room tree with rooms under areas. `useCampusLocations` hook needs extension to include rooms. Location search is client-side text matching on the flattened list. |
| SUBMIT-02 | User can enter short title (required) and optional description | Zod schema on POST `/api/maintenance/tickets`. Title max 200 chars (consistent with existing Ticket model). |
| SUBMIT-03 | User can upload 1–5 photos via signed URL direct-to-Supabase pattern | New pattern for this project: `POST /api/maintenance/tickets/upload-url` returns signed upload URL; client uploads directly; public URL stored in `MaintenanceTicket.photos[]`. See Photo Upload section. |
| SUBMIT-04 | User can select category from 8 options | `MaintenanceCategory` enum already exists in schema: ELECTRICAL, PLUMBING, HVAC, STRUCTURAL, CUSTODIAL_BIOHAZARD, IT_AV, GROUNDS, OTHER. |
| SUBMIT-05 | User can set priority (Low / Medium / High / Urgent) | `MaintenancePriority` enum already exists: LOW, MEDIUM, HIGH, URGENT. |
| SUBMIT-06 | User can add optional availability note for room access | `availabilityNote String?` field already exists on MaintenanceTicket. |
| SUBMIT-07 | Submitted ticket enters BACKLOG status with auto-assigned specialty tag | Default status is BACKLOG (schema default). Specialty auto-maps from category (1:1 mapping: ELECTRICAL→ELECTRICAL, etc.). See Route-01. |
| SUBMIT-08 | AI auto-suggests category when photos are uploaded | Gemini `gemini-2.0-flash` model (already installed), send image bytes + prompt. Returns one of 8 categories. Wrap in try/catch — fail gracefully, never block submission. |
| SUBMIT-09 | AI detects multi-issue submissions and suggests splitting before final submit | Gemini prompt on Review step: send title + description + category. Returns `{ hasMultipleIssues: boolean, secondIssue?: { title, category } }`. Non-blocking suggestion only. |
| SUBMIT-10 | Confirmation email sent to submitter with ticket number (MT-XXXX) | New email template `maintenance_submitted` in `src/lib/email/templates.ts`. Call in ticket creation service. Fire-and-forget. |
| SUBMIT-11 | Urgent tickets immediately alert Head of Maintenance via email + in-app notification | After ticket creation: if priority === URGENT, find users with MAINTENANCE_READ_ALL permission in the org, send `maintenance_urgent_alert` email + in-app notification. |
| LIFE-01 | Status transitions enforced server-side with role validation | State machine in `maintenanceTicketService.ts`: `ALLOWED_TRANSITIONS` map + `canTransition(fromStatus, toStatus, userPermissions)` function. Called from PATCH `/api/maintenance/tickets/[id]/status`. |
| LIFE-02 | ON_HOLD requires hold reason (PARTS / VENDOR / ACCESS / OTHER) and optional note | `HoldReason` enum already exists. Validate in status transition: if toStatus === ON_HOLD and no holdReason → 400 VALIDATION_ERROR. |
| LIFE-03 | Moving to QA requires completion photo and completion note | Validate in status transition: if toStatus === QA and no completionPhotos or no completionNote → 400 VALIDATION_ERROR. |
| LIFE-04 | QA→DONE requires Head/Admin sign-off with labor hours and cost confirmed | Permission check: assertCan(MAINTENANCE_APPROVE_QA). The "confirm" step is UI-only — QA review panel shows labor/cost; clicking "Approve & Close" calls PATCH status to DONE. |
| LIFE-05 | QA→IN_PROGRESS (rejection) requires reason note, sent back to tech | Validate: if fromStatus === QA and toStatus === IN_PROGRESS and no rejectionNote → 400. Log activity with rejectionNote as content. |
| LIFE-06 | Any→CANCELLED requires cancellation reason, restricted to Head/Admin | assertCan(MAINTENANCE_CANCEL). Validate cancellationReason present. |
| LIFE-07 | SCHEDULED→BACKLOG transitions automatically on scheduled date | Cron job: hourly `/api/cron/maintenance-tasks`. Queries SCHEDULED tickets where scheduledDate <= now(). Calls status transition to BACKLOG. Records activity. |
| LIFE-08 | Full activity feed showing all status changes, comments, assignments with timestamps and actors | `MaintenanceTicketActivity` model already has all required fields. Service writes activity on every status change, comment, and assignment. |
| DETAIL-01 | Submitter section: name, role, contact info, submitted timestamp, availability note | Include user with role in ticket GET. `submittedBy { id, name, email, role { name } }` |
| DETAIL-02 | Location section: full hierarchy (Campus → Building → Area → Room), room photo, Google Maps link | Join building/area/room on ticket GET. Google Maps link: `https://maps.google.com/?q=Building+Name+Address` using building address if available. |
| DETAIL-03 | Issue section: title, description, category, priority, photos (full-size on click) | Photos array stored as public URLs. Click-to-full-size via CSS/lightbox. |
| DETAIL-04 | Activity feed with internal comments (tech/head only, not visible to submitter) | `isInternal` field on MaintenanceTicketActivity. API filters isInternal activities: only return if user has MAINTENANCE_READ_ALL or MAINTENANCE_CLAIM. |
| DETAIL-05 | Assignment and reassignment history logged in activity feed | On every PATCH that changes `assignedToId`, write a REASSIGNMENT activity entry. |
| ROUTE-01 | Category auto-maps to specialty tag on ticket creation | `CATEGORY_TO_SPECIALTY` constant: `{ ELECTRICAL: 'ELECTRICAL', PLUMBING: 'PLUMBING', ... }`. Applied in service at ticket creation. |
| ROUTE-02 | Technicians can self-claim tickets matching their specialty or GENERAL | Claim guard: load TechnicianProfile.specialties for current user. Ticket specialty must be in user's specialties OR specialty === 'OTHER' (general). assertCan(MAINTENANCE_CLAIM). |
| ROUTE-03 | Head of Maintenance can assign any ticket to any technician regardless of specialty | assertCan(MAINTENANCE_ASSIGN). No specialty check for assignment (only for self-claim). |
| ROUTE-04 | Self-claim guard enforced: techs cannot claim tickets outside their specialty | Server-side: load TechnicianProfile, verify ticket.specialty is in profile.specialties. Return 403 with clear message if mismatch. |
| ROUTE-05 | Matching-specialty tickets highlighted in technician's backlog view | API returns `matchesSpecialty: boolean` on each ticket when requested by a technician. UI uses this to gray out non-matching rows. |
| NOTIF-01 | Email on ticket submission (to submitter) | `sendMaintenanceSubmittedEmail()` in emailService. Template: `maintenance_submitted`. |
| NOTIF-02 | Email on ticket assignment (to assigned technician) | `sendMaintenanceAssignedEmail()`. Template: `maintenance_assigned`. |
| NOTIF-03 | Email when tech self-claims (to Head of Maintenance) | `sendMaintenanceClaimedEmail()`. Find users with MAINTENANCE_ASSIGN permission. Template: `maintenance_claimed`. |
| NOTIF-04 | Email on status → IN_PROGRESS (to submitter) | Status change hook in service. Template: `maintenance_in_progress`. |
| NOTIF-05 | Email on status → ON_HOLD with hold reason (to submitter + Head) | Template: `maintenance_on_hold`. Include holdReason and holdNote in template vars. Send to both submitter and Head. |
| NOTIF-06 | Email on status → QA (to Head of Maintenance) | Template: `maintenance_qa_ready`. Find users with MAINTENANCE_APPROVE_QA. |
| NOTIF-07 | Email on status → DONE (to submitter) | Template: `maintenance_done`. |
| NOTIF-08 | Email on urgent ticket submission (to Head of Maintenance) | Sent alongside NOTIF-01. Find users with MAINTENANCE_READ_ALL. Template: `maintenance_urgent`. |
| NOTIF-09 | Email when ticket unactioned > 48h (to Head of Maintenance) | Cron job: find BACKLOG tickets with no assignedToId and createdAt < 48h ago where `stalertAlertSent` is false. Send email, set `staleAlertSent = true`. NOTE: `staleAlertSent` field does not currently exist on MaintenanceTicket — must be added to schema. |
| NOTIF-10 | Email on QA → IN_PROGRESS rejection (to assigned technician) | Triggered by QA rejection status transition. Template: `maintenance_qa_rejected`. |
| NOTIF-11 | In-app notifications for all email triggers using existing Notification model | `createNotification()` / `createBulkNotifications()` from notificationService.ts. Extend `NotificationType` union with 11 maintenance types. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | ^15.1.0 (installed) | API routes + page routing | Project foundation |
| Prisma | v5.22 (installed) | ORM for all DB operations | Project foundation |
| Zod | ^4.3.6 (installed) | Server-side input validation | Established pattern in all routes |
| TanStack Query | ^5.90.21 (installed) | Client-side data fetching + caching | Established pattern throughout app |
| Framer Motion | ^12.34.3 (installed) | Wizard step transitions + animations | Established animation system |
| `@google/genai` | ^1.40.0 (installed) | AI category suggestion + multi-issue detection | Already installed, Gemini for text/image |
| `@supabase/supabase-js` | ^2.49.1 (installed) | Signed upload URLs for photos | Already installed, used for storage |
| mjml | ^4.18.0 (installed) | Email template rendering | Used for all existing email templates |
| Resend | (via nodemailer adapter, installed) | Email delivery | Established email provider |
| Lucide React | ^0.564.0 (installed) | Icons throughout UI | Established icon library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `rawPrisma` (internal) | — | Atomic counter increment, unscoped queries | Ticket number generation via MaintenanceCounter |
| `notificationService.ts` (internal) | — | In-app notification creation | All 11 NOTIF triggers |
| `emailService.ts` (internal) | — | Email delivery with MJML templates | All 11 email triggers |
| `storageService.ts` (internal) | — | Supabase Storage upload functions | Photo upload API endpoint |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@google/genai` Gemini | Anthropic Claude SDK | Claude is pinned for Phase 3 AI diagnostics; Gemini is already installed for Phase 2 category/multi-issue features. Do NOT add Anthropic SDK in Phase 2. |
| Signed URL upload | Base64-through-Next.js | Base64 approach is used for logos but hits Next.js 1MB body limit. Photos can be 5MB each (5 photos = 25MB). Must use signed URL. |
| Vercel cron (`vercel.json`) | External cron trigger | vercel.json does not exist in this project. Use Vercel cron via `vercel.json` creation or an API route called by an external service (Upstash QStash, GitHub Actions, etc.). Cron implementation is Claude's discretion. |

**Installation:** No new packages needed. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    api/
      maintenance/
        tickets/
          route.ts                    # GET (list) + POST (create)
          [id]/
            route.ts                  # GET (detail) + PATCH (update metadata)
            status/
              route.ts                # PATCH (status transition, enforces state machine)
            activities/
              route.ts                # GET (activity feed) + POST (add comment)
            claim/
              route.ts                # POST (self-claim — sets assignedToId + TODO status)
        upload-url/
          route.ts                    # POST (returns signed Supabase upload URL)
        dashboard/
          route.ts                    # GET (aggregate stats for MaintenanceDashboard)
      cron/
        maintenance-tasks/
          route.ts                    # GET (hourly: stale alerts + scheduled transitions)
    maintenance/
      tickets/
        [id]/
          page.tsx                    # Ticket detail full page
  components/
    maintenance/
      SubmitRequestWizard.tsx         # 4-step wizard (Location→Photos→Details→Review)
      SubmitRequestWizard/
        StepLocation.tsx              # Step 1: location search + selector
        StepPhotos.tsx                # Step 2: photo upload (up to 5)
        StepDetails.tsx               # Step 3: title, category, priority, description, availability
        StepReview.tsx                # Step 4: review + AI multi-issue check + submit
      WorkOrdersTable.tsx             # Filtered sortable table with inline actions
      WorkOrdersFilters.tsx           # Filter bar component
      TicketDetailPage.tsx            # Two-column detail page
      TicketActivityFeed.tsx          # Activity entries + comment box
      TicketStatusTracker.tsx         # Horizontal 8-status progress bar
      TicketCard.tsx                  # Card for My Requests grid
      MyRequestsGrid.tsx              # Card grid container (replaces MyRequestsView.tsx)
      QACompletionModal.tsx           # Modal for moving ticket to QA
      QAReviewPanel.tsx               # Head sign-off panel on detail page
      HoldReasonInlineForm.tsx        # Inline expansion for ON_HOLD
  lib/
    services/
      maintenanceTicketService.ts     # All business logic: create, update, transition, notify
      maintenanceNotificationService.ts # Thin wrapper: fires email + in-app for each trigger
```

### Pattern 1: Lifecycle State Machine
**What:** Server-enforced status transitions with per-transition validation and side effects.
**When to use:** Any status change on a MaintenanceTicket.

```typescript
// Source: Derived from project patterns + CONTEXT.md requirements
// src/lib/services/maintenanceTicketService.ts

type TransitionConfig = {
  allowedRoles: string[]  // permission constants
  requiredFields?: string[]
  sideEffects: (ticket: MaintenanceTicket, actor: User, data: TransitionData) => Promise<void>
}

const TRANSITIONS: Record<string, Record<string, TransitionConfig>> = {
  BACKLOG: {
    TODO:       { allowedRoles: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN], sideEffects: writeActivity },
    SCHEDULED:  { allowedRoles: [PERMISSIONS.MAINTENANCE_ASSIGN], sideEffects: writeActivity },
    CANCELLED:  { allowedRoles: [PERMISSIONS.MAINTENANCE_CANCEL], requiredFields: ['cancellationReason'], sideEffects: writeActivity },
  },
  TODO: {
    IN_PROGRESS: { allowedRoles: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN], sideEffects: [writeActivity, notifyInProgress] },
    ON_HOLD:     { allowedRoles: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN], requiredFields: ['holdReason'], sideEffects: [writeActivity, notifyOnHold] },
    CANCELLED:   { allowedRoles: [PERMISSIONS.MAINTENANCE_CANCEL], requiredFields: ['cancellationReason'], sideEffects: writeActivity },
  },
  IN_PROGRESS: {
    QA:       { allowedRoles: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN], requiredFields: ['completionNote', 'completionPhotos'], sideEffects: [writeActivity, notifyQA] },
    ON_HOLD:  { allowedRoles: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN], requiredFields: ['holdReason'], sideEffects: [writeActivity, notifyOnHold] },
    CANCELLED: { allowedRoles: [PERMISSIONS.MAINTENANCE_CANCEL], requiredFields: ['cancellationReason'], sideEffects: writeActivity },
  },
  ON_HOLD: {
    IN_PROGRESS: { allowedRoles: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN], sideEffects: writeActivity },
    CANCELLED:   { allowedRoles: [PERMISSIONS.MAINTENANCE_CANCEL], requiredFields: ['cancellationReason'], sideEffects: writeActivity },
  },
  QA: {
    DONE:        { allowedRoles: [PERMISSIONS.MAINTENANCE_APPROVE_QA], sideEffects: [writeActivity, notifyDone] },
    IN_PROGRESS: { allowedRoles: [PERMISSIONS.MAINTENANCE_APPROVE_QA], requiredFields: ['rejectionNote'], sideEffects: [writeActivity, notifyQARejected] },
    CANCELLED:   { allowedRoles: [PERMISSIONS.MAINTENANCE_CANCEL], requiredFields: ['cancellationReason'], sideEffects: writeActivity },
  },
  SCHEDULED: {
    BACKLOG:   { allowedRoles: ['SYSTEM'], sideEffects: writeActivity },  // cron job only
    CANCELLED: { allowedRoles: [PERMISSIONS.MAINTENANCE_CANCEL], requiredFields: ['cancellationReason'], sideEffects: writeActivity },
  },
  DONE: {},      // terminal state — no transitions out
  CANCELLED: {}, // terminal state — no transitions out
}
```

### Pattern 2: Ticket Number Generation
**What:** Atomic increment of MaintenanceCounter using rawPrisma transaction.
**When to use:** Every new ticket creation.

```typescript
// Source: CONTEXT.md code_context + existing discountService.ts pattern
async function generateTicketNumber(organizationId: string): Promise<string> {
  const result = await rawPrisma.$transaction(async (tx) => {
    const counter = await tx.maintenanceCounter.upsert({
      where: { organizationId },
      create: { organizationId, lastTicketNumber: 1 },
      update: { lastTicketNumber: { increment: 1 } },
    })
    return counter.lastTicketNumber
  })
  return `MT-${String(result).padStart(4, '0')}`
}
```

### Pattern 3: Signed URL Photo Upload
**What:** Client requests a signed upload URL, uploads directly to Supabase Storage (bypasses Next.js body limit), stores the resulting public URL.
**When to use:** All maintenance photo uploads in the wizard.

```typescript
// Source: Supabase Storage docs + storageService.ts existing pattern
// Step 1: API route generates signed URL
// POST /api/maintenance/tickets/upload-url
const { data, error } = await supabaseClient.storage
  .from('maintenance-photos')
  .createSignedUploadUrl(`${orgId}/${ticketId}/${Date.now()}-${fileName}`)

// Step 2: Client uploads directly to Supabase
await fetch(data.signedUrl, {
  method: 'PUT',
  headers: { 'Content-Type': file.type },
  body: file,
})

// Step 3: Client stores the public URL in ticket form state
const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/maintenance-photos/${path}`
```

### Pattern 4: API Route Standard
**What:** The project's established route handler boilerplate.
**When to use:** Every new API route.

```typescript
// Source: CLAUDE.md — API Route Pattern
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_READ_OWN)

    return await runWithOrgContext(orgId, async () => {
      const data = await prisma.maintenanceTicket.findMany({ ... })
      return NextResponse.json(ok(data))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
```

### Pattern 5: Gemini Image Analysis for Category Suggestion
**What:** Send uploaded photo URLs to Gemini vision API to suggest maintenance category.
**When to use:** SUBMIT-08 — after photos upload in wizard Step 2.

```typescript
// Source: existing gemini.service.ts + @google/genai docs
// POST /api/maintenance/tickets/ai-suggest-category
import { GoogleGenAI } from '@google/genai'

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const result = await client.models.generateContent({
  model: 'gemini-2.0-flash',
  contents: [
    {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64ImageData } },
        { text: 'This is a photo of a facility maintenance issue. Classify it as exactly one of: ELECTRICAL, PLUMBING, HVAC, STRUCTURAL, CUSTODIAL_BIOHAZARD, IT_AV, GROUNDS, OTHER. Reply with only the category name.' }
      ]
    }
  ]
})

const category = result.text?.trim() as MaintenanceCategory | undefined
```

### Pattern 6: Notification Side Effect Pattern
**What:** Fire-and-forget notification after every significant ticket event.
**When to use:** All 11 NOTIF triggers.

```typescript
// Source: notificationService.ts existing pattern
// Never await notifications — they must never block ticket operations
async function notifyTicketSubmitted(ticket: MaintenanceTicket, submitter: User): Promise<void> {
  // Email (fire-and-forget)
  sendMaintenanceSubmittedEmail({ to: submitter.email, ticketNumber: ticket.ticketNumber, ... })
    .catch(err => console.error('Email failed:', err))

  // In-app (fire-and-forget)
  createNotification({
    userId: submitter.id,
    type: 'maintenance_submitted',
    title: `Ticket ${ticket.ticketNumber} submitted`,
    body: ticket.title,
    linkUrl: `/maintenance/tickets/${ticket.id}`,
  }).catch(err => console.error('Notification failed:', err))
}
```

### Pattern 7: Location Picker with Room Support
**What:** Extend `useCampusLocations` hook and flattenCampusLocations to include rooms.
**When to use:** SUBMIT-01 — wizard Step 1 location search.

The `/api/campus/lookup` route already returns rooms nested under areas (and directly under buildings). The existing `useCampusLocations.ts` flattens to building/area level only. For the maintenance wizard, extend the flattening to include rooms:

```typescript
// Extend CampusLocationOption interface
export interface CampusLocationOption {
  label: string         // "Main Building — 2nd Floor — Room 201"
  buildingId: string | null
  areaId: string | null
  roomId: string | null // NEW
  type: 'building' | 'area' | 'room'
}
```

The search autocomplete filters this flat list client-side. Debounce at 200ms (useDeferredValue pattern or a 200ms setTimeout).

### Pattern 8: Work Orders Table Permission Scoping
**What:** API returns different data subsets based on caller's role.
**When to use:** GET /api/maintenance/tickets (list endpoint).

```typescript
// Source: existing ticketService.ts scope pattern
const isHead = await can(ctx.userId, PERMISSIONS.MAINTENANCE_READ_ALL)
const isTech = await can(ctx.userId, PERMISSIONS.MAINTENANCE_CLAIM)

if (isHead) {
  // Return all tickets for org (with filters)
} else if (isTech) {
  // Return all unassigned + tickets assigned to this user
  // Include matchesSpecialty boolean on each ticket
} else {
  // Return only tickets submitted by this user
  where.submittedById = ctx.userId
}
```

### Anti-Patterns to Avoid
- **Awaiting notifications in route handlers:** Notifications must be fire-and-forget. If Resend is down, the ticket operation must still succeed.
- **Using orgScopedPrisma for MaintenanceCounter:** MaintenanceCounter is excluded from orgScopedModels intentionally (it's a singleton per org). Use `rawPrisma` for counter operations.
- **Status transitions in route handlers directly:** All state machine logic lives in `maintenanceTicketService.ts`. Routes call `transitionStatus(ticketId, newStatus, data, userId)` — never write transition logic in route handlers.
- **Calling `prisma.maintenanceTicket.delete()`:** This is a soft-delete model. Use `prisma.maintenanceTicket.update({ data: { deletedAt: new Date() } })` or the extension handles it transparently.
- **Putting AI calls in the synchronous ticket creation path:** AI category suggestion is pre-submission (wizard step 2). Multi-issue detection is pre-submission (review step). Neither blocks the actual POST. If AI fails, submission proceeds normally.
- **Returning internal activities to submitters:** Filter `isInternal: true` activities unless user has MAINTENANCE_READ_ALL or MAINTENANCE_CLAIM permission.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email template rendering | Custom HTML string builder | `renderEmail()` in `src/lib/email/templates.ts` + new templates in `getTemplateMjml()` switch | MJML system already established; just add cases to the switch |
| In-app notification creation | Direct Prisma calls | `createNotification()` / `createBulkNotifications()` from `notificationService.ts` | Fire-and-forget wrapper already handles errors |
| JWT verification + org ID extraction | Custom middleware | `getOrgIdFromRequest()` + `getUserContext()` + `runWithOrgContext()` | Established pattern — every route uses these 3 functions |
| Permission checks | Role string comparison | `assertCan()` / `can()` from `@/lib/auth/permissions` | Caches results 30s, handles all edge cases |
| File upload to Supabase | Custom fetch | `getSupabaseClient()` from `storageService.ts` + extend with `uploadMaintenancePhoto()` | Same Supabase client setup, same bucket pattern |
| Autocomplete search state | Debounced `useState` | `useDeferredValue(searchTerm)` (React 18 built-in) | Zero dependencies, handles concurrent mode correctly |
| Ticket card status badges | Custom CSS | Tailwind badge classes matching established patterns: green-100/700 (DONE), blue-100/700 (IN_PROGRESS), yellow-100/700 (ON_HOLD), etc. | Visual consistency with existing W/L/T badges pattern |
| Location hierarchy display | Custom fetch | Extend `useCampusLocations()` hook to include rooms | Hook already caches 5 minutes, handles the full tree |

**Key insight:** This phase is almost entirely gluing together existing services and extending existing hooks. The novel work is the state machine logic, the signed URL upload pattern, and the email templates. Everything else reuses established infrastructure.

---

## Common Pitfalls

### Pitfall 1: Schema Change for staleAlertSent
**What goes wrong:** NOTIF-09 requires deduplication of stale alerts (one alert per ticket, don't repeat daily). There is no `staleAlertSent` field on MaintenanceTicket in the current schema.
**Why it happens:** The field was not added in Phase 1 because notification logic was Phase 2 scope.
**How to avoid:** Add `staleAlertSent Boolean @default(false)` to MaintenanceTicket in Phase 2 Wave 0. Run `npm run db:push` before any API work. This is a non-breaking additive change.
**Warning signs:** Cron job sends duplicate alerts every hour for the same ticket.

### Pitfall 2: Signed URL Bucket Must Exist
**What goes wrong:** `supabaseClient.storage.createSignedUploadUrl('maintenance-photos', ...)` throws if the `maintenance-photos` bucket doesn't exist in Supabase.
**Why it happens:** Buckets are created manually in Supabase dashboard (or via migrations), not auto-created by code.
**How to avoid:** Wave 0 task: create `maintenance-photos` bucket in Supabase with public read access. Document this in the plan as a setup prerequisite. The storageService.ts pattern shows the bucket name must match exactly.
**Warning signs:** 404 error from Supabase when calling `createSignedUploadUrl`.

### Pitfall 3: useSearchParams in Ticket Detail Page
**What goes wrong:** Next.js static generation throws: "useSearchParams() should be wrapped in a suspense boundary."
**Why it happens:** Phase 1 already hit this exact issue with `/maintenance/page.tsx` (documented in 01-02-SUMMARY.md auto-fixed issues).
**How to avoid:** Wrap the page default export in `<Suspense>` with an inner component that uses `useSearchParams()`. Pattern established in `src/app/maintenance/page.tsx` (lines 266-278).
**Warning signs:** `next build` fails with useSearchParams error.

### Pitfall 4: NotificationType Union is a TypeScript Type, Not a DB Enum
**What goes wrong:** Adding `maintenance_*` notification types to the TypeScript `NotificationType` union in `notificationService.ts` but the DB `Notification.type` column is a plain `String` — no migration needed. However, `createNotification()` uses `type` with `as any` cast precisely because of this.
**Why it happens:** Notification types are string values, not a PostgreSQL enum. The DB column accepts any string.
**How to avoid:** Just extend the TypeScript union. No schema change, no migration. The `as any` cast already handles DB writes.
**Warning signs:** TypeScript error "is not assignable to type 'NotificationType'" when calling `createNotification()`.

### Pitfall 5: Head of Maintenance Lookup for Notifications
**What goes wrong:** Several notification triggers require finding the "Head of Maintenance" user(s) for an org (NOTIF-03, NOTIF-05, NOTIF-06, NOTIF-08, NOTIF-09). There's no `headOfMaintenance` field on Organization — the Head is identified by role.
**Why it happens:** Roles are dynamic (any user can be assigned maintenance-head role).
**How to avoid:** Query users by role: `rawPrisma.user.findMany({ where: { organizationId, role: { slug: 'maintenance-head' } } })`. Or query by permission: users who have `MAINTENANCE_APPROVE_QA` or `MAINTENANCE_READ_ALL` in the org. Use `rawPrisma` for this cross-org lookup (not orgScopedPrisma which auto-filters by orgId in the extension).
**Warning signs:** Notifications going to wrong users or to nobody.

### Pitfall 6: Work Orders Table — Technician Specialty Matching Requires TechnicianProfile
**What goes wrong:** `matchesSpecialty` calculation requires loading the calling user's TechnicianProfile. If the user doesn't have a TechnicianProfile record yet (i.e., they were assigned maintenance-technician role but profile was never created), the query fails silently.
**Why it happens:** TechnicianProfile is created separately from the user record — there's no auto-create trigger.
**How to avoid:** In the Work Orders list API, use `LEFT JOIN` semantics: `rawPrisma.technicianProfile.findUnique({ where: { userId: ctx.userId } })` and handle `null` gracefully (treat as empty specialties → no self-claim, all tickets grayed out). Consider adding a "Complete your technician profile" prompt in the Work Orders UI if profile is null.
**Warning signs:** Claim button never appears for any ticket even when specialty should match.

### Pitfall 7: Optimistic UI for Instant Claim
**What goes wrong:** The CONTEXT.md specifies "Optimistic UI update" for self-claim. Without proper TanStack Query invalidation, the table won't update after the optimistic update settles.
**Why it happens:** Optimistic updates require manual rollback on failure.
**How to avoid:** Use `useMutation` with `onMutate` (optimistic update), `onError` (rollback), `onSettled` (`queryClient.invalidateQueries(['maintenance-tickets'])`). The table refetches on settlement.
**Warning signs:** Claim button stays visible after claiming, or row doesn't move to "assigned" state.

### Pitfall 8: Cron Job Security
**What goes wrong:** The cron endpoint `/api/cron/maintenance-tasks` is called by an external scheduler. If it's not protected, anyone can trigger mass notifications.
**Why it happens:** Cron endpoints can't use JWT auth (no user session).
**How to avoid:** Protect with a `CRON_SECRET` environment variable. Check `Authorization: Bearer ${CRON_SECRET}` header. Vercel cron automatically sends this header if configured in `vercel.json`. For other triggers (GitHub Actions, Upstash), pass the secret in the request.
**Warning signs:** Cron endpoint returns 200 without any auth check.

---

## Code Examples

Verified patterns from existing codebase:

### Creating a Ticket (rawPrisma for counter + prisma for ticket)
```typescript
// Source: CONTEXT.md code_context + discountService.ts counter pattern
async function createMaintenanceTicket(input: CreateTicketInput, userId: string, orgId: string) {
  // 1. Generate ticket number atomically
  const ticketNumber = await generateTicketNumber(orgId)

  // 2. Derive specialty from category (1:1 mapping)
  const specialty = CATEGORY_TO_SPECIALTY[input.category]

  // 3. Create ticket (inside runWithOrgContext in route handler)
  const ticket = await prisma.maintenanceTicket.create({
    data: {
      ticketNumber,
      title: input.title,
      description: input.description,
      status: input.scheduledDate ? 'SCHEDULED' : 'BACKLOG',
      category: input.category,
      specialty,
      priority: input.priority ?? 'MEDIUM',
      photos: input.photos ?? [],
      availabilityNote: input.availabilityNote,
      scheduledDate: input.scheduledDate,
      buildingId: input.buildingId,
      areaId: input.areaId,
      roomId: input.roomId,
      submittedById: userId,
    },
  })

  // 4. Write initial activity entry
  await prisma.maintenanceTicketActivity.create({
    data: {
      ticketId: ticket.id,
      actorId: userId,
      type: 'STATUS_CHANGE',
      toStatus: ticket.status,
      content: 'Ticket submitted',
    },
  })

  // 5. Fire notifications (fire-and-forget)
  notifyTicketSubmitted(ticket, userId, orgId)

  return ticket
}
```

### Status Transition Endpoint
```typescript
// Source: CLAUDE.md API Route Pattern
// PATCH /api/maintenance/tickets/[id]/status
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const ticket = await prisma.maintenanceTicket.findUniqueOrThrow({
        where: { id: params.id }
      })

      // Delegate all logic to service
      const updated = await transitionTicketStatus(ticket, body.status, body, ctx)
      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_TRANSITION') {
      return NextResponse.json(fail('INVALID_TRANSITION', 'Status change not allowed'), { status: 422 })
    }
    // ... standard error handling
  }
}
```

### Activity Feed API with isInternal Filter
```typescript
// Source: CLAUDE.md + notificationService pattern
// GET /api/maintenance/tickets/[id]/activities
const isPrivileged = await can(ctx.userId, PERMISSIONS.MAINTENANCE_READ_ALL)
  || await can(ctx.userId, PERMISSIONS.MAINTENANCE_CLAIM)

const activities = await prisma.maintenanceTicketActivity.findMany({
  where: {
    ticketId: params.id,
    ...(isPrivileged ? {} : { isInternal: false }),
  },
  orderBy: { createdAt: 'asc' },
  include: {
    actor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    assignedTo: { select: { id: true, firstName: true, lastName: true } },
  },
})
```

### Extending notificationService NotificationType
```typescript
// Source: src/lib/services/notificationService.ts (extend existing)
export type NotificationType =
  | 'event_updated'
  | 'event_deleted'
  | 'event_invite'
  | 'event_approved'
  | 'event_rejected'
  // Maintenance (Phase 2 additions)
  | 'maintenance_submitted'
  | 'maintenance_assigned'
  | 'maintenance_claimed'
  | 'maintenance_in_progress'
  | 'maintenance_on_hold'
  | 'maintenance_qa_ready'
  | 'maintenance_done'
  | 'maintenance_urgent'
  | 'maintenance_stale'
  | 'maintenance_qa_rejected'
  | 'maintenance_scheduled_released'
```

### Cron Job Pattern (Vercel-compatible)
```typescript
// Source: Vercel cron docs + CLAUDE.md API Route Pattern
// GET /api/cron/maintenance-tasks
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Task 1: Release scheduled tickets whose scheduledDate has passed
  // Task 2: Send stale alerts for BACKLOG tickets > 48h unassigned
  // Both tasks iterate across ALL orgs (rawPrisma, no org context)
  // ...
  return NextResponse.json({ ok: true, processed: { released, alerted } })
}
```

### Vercel Cron Configuration
```json
// vercel.json (create at project root)
{
  "crons": [
    {
      "path": "/api/cron/maintenance-tasks",
      "schedule": "0 * * * *"
    }
  ]
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Base64-through-Next.js for all uploads | Signed URL direct-to-Supabase for large files | This phase (SUBMIT-03) | Bypasses Next.js 1MB body limit; required for 5MB photo uploads |
| Gemini text-only prompts | Gemini multimodal (text + image) for category suggestion | This phase (SUBMIT-08) | `gemini-2.0-flash` supports vision; use `inlineData` part type |
| Hard-coded ticket statuses | 8-status state machine with enforced transitions | Phase 1 established enum, Phase 2 enforces transitions | All status changes validated server-side |

**Deprecated/outdated:**
- `MyRequestsView.tsx` empty state — Phase 2 replaces this with `MyRequestsGrid.tsx` + `SubmitRequestWizard.tsx`. The disabled "Submit Request" button and "Coming in Phase 2" tooltip should be removed.
- Work Orders placeholder in `maintenance/page.tsx` (lines 243-248) — Phase 2 replaces with `WorkOrdersTable.tsx`.
- MaintenanceDashboard stat zeros — Phase 2 wires `/api/maintenance/dashboard` aggregate route.

---

## Open Questions

1. **CRON_SECRET environment variable**
   - What we know: The cron endpoint needs protection
   - What's unclear: Whether `CRON_SECRET` already exists in the project's `.env` files (`.env.example` doesn't show it)
   - Recommendation: Wave 0 task — add `CRON_SECRET` to `.env.example` with a note. The planner should include setup instructions.

2. **Supabase `maintenance-photos` bucket setup**
   - What we know: Bucket must exist before uploads work
   - What's unclear: Whether to create bucket via Supabase MCP tool or manually via dashboard
   - Recommendation: Wave 0 task — add bucket creation as a prerequisite. Note in the plan that this requires either Supabase MCP or manual dashboard action before ticket submission can be tested.

3. **Google Maps link for DETAIL-02**
   - What we know: Google Maps link is in scope
   - What's unclear: Building records may not have a street address field (only `name`, `code`, `schoolDivision`)
   - Recommendation: Use building name as the search query: `https://maps.google.com/?q=${encodeURIComponent(building.name)}`. If address field doesn't exist, this gives a reasonable Maps search. Do not add address field to Building model in Phase 2.

4. **Gemini API key availability**
   - What we know: `GEMINI_API_KEY` is optional in `.env.example`; the Gemini service gracefully degrades when not configured
   - What's unclear: Whether the production environment has a key set
   - Recommendation: AI features (SUBMIT-08, SUBMIT-09) should degrade gracefully — if Gemini is not configured, skip AI suggestion and proceed without it. Never block submission on AI failure.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected (no jest.config, no vitest.config, no pytest.ini, no test/ directory) |
| Config file | Wave 0 — none exists |
| Quick run command | `npm run smoke:tickets` (to be created) |
| Full suite command | `npm run smoke:all` (existing) |

### Phase Requirements → Test Map

Phase 2 has no automated unit/integration tests in the codebase. All testing is via smoke test scripts that hit the live API (established pattern: `scripts/smoke-*.mjs`). The following smoke tests should be created:

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUBMIT-01 through SUBMIT-07 | Ticket creation end-to-end | smoke | `node scripts/smoke-maintenance-submit.mjs` | ❌ Wave 0 |
| LIFE-01 through LIFE-08 | Status lifecycle transitions | smoke | `node scripts/smoke-maintenance-lifecycle.mjs` | ❌ Wave 0 |
| ROUTE-01 through ROUTE-05 | Specialty routing + self-claim | smoke | `node scripts/smoke-maintenance-routing.mjs` | ❌ Wave 0 |
| NOTIF-01 through NOTIF-11 | Notifications (logged, not email-verified) | smoke | included in above scripts | ❌ Wave 0 |
| SUBMIT-08, SUBMIT-09 | AI features | manual | N/A — requires API key + visual verification | manual-only |
| DETAIL-01 through DETAIL-05 | Ticket detail page rendering | manual | N/A — requires visual inspection | manual-only |
| LIFE-07, NOTIF-09 | Cron job behavior | manual | N/A — requires time to pass or manual trigger | manual-only |

### Sampling Rate
- **Per task commit:** `npx next build --no-lint` (build must pass)
- **Per wave merge:** `node scripts/smoke-maintenance-submit.mjs` + `node scripts/smoke-maintenance-lifecycle.mjs`
- **Phase gate:** All non-manual smoke tests green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/smoke-maintenance-submit.mjs` — covers SUBMIT-01 through SUBMIT-11 (minus AI features)
- [ ] `scripts/smoke-maintenance-lifecycle.mjs` — covers LIFE-01 through LIFE-08
- [ ] `scripts/smoke-maintenance-routing.mjs` — covers ROUTE-01 through ROUTE-05
- [ ] `prisma/schema.prisma` — add `staleAlertSent Boolean @default(false)` to MaintenanceTicket
- [ ] Supabase `maintenance-photos` bucket — create with public read access
- [ ] `vercel.json` — create with cron schedule for `/api/cron/maintenance-tasks`
- [ ] `.env.example` — add `CRON_SECRET` entry

---

## Sources

### Primary (HIGH confidence)
- Codebase — `prisma/schema.prisma` (lines 1929-2130): all 9 maintenance models, 6 enums confirmed
- Codebase — `src/lib/db/index.ts`: org-scope and soft-delete registrations confirmed
- Codebase — `src/lib/permissions.ts` (lines 116-403): all 13 MAINTENANCE_* constants and 2 roles confirmed
- Codebase — `src/lib/services/notificationService.ts`: NotificationType union, createNotification, createBulkNotifications
- Codebase — `src/lib/services/emailService.ts`: sendBrandedEmail pattern, renderEmail integration
- Codebase — `src/lib/email/templates.ts`: getTemplateMjml switch, wrapLayout, SUBJECTS, TEXT_BODIES
- Codebase — `src/lib/services/storageService.ts`: Supabase client pattern, bucket structure
- Codebase — `src/lib/hooks/useCampusLocations.ts`: campus location hook, flattenCampusLocations
- Codebase — `src/components/settings/ImageDropZone.tsx`: base64 upload pattern
- Codebase — `src/app/api/campus/lookup/route.ts`: full Building→Area→Room tree in response
- Codebase — `src/lib/services/ai/gemini.service.ts`: GoogleGenAI usage, model name, text generation
- Codebase — `.planning/phases/01-foundation/01-VERIFICATION.md`: Phase 1 complete, all models confirmed

### Secondary (MEDIUM confidence)
- Supabase Storage docs pattern: `createSignedUploadUrl` for client-side direct upload (bypasses server)
- Vercel cron docs: `vercel.json` format for hourly cron with CRON_SECRET header
- Gemini `gemini-2.0-flash` multimodal: `inlineData` parts for image analysis (consistent with `@google/genai` v1.40 API)

### Tertiary (LOW confidence)
- None — all critical claims are verified against codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified as installed in package.json
- Architecture: HIGH — patterns extracted directly from existing codebase
- State machine: HIGH — enum values confirmed in schema, transition logic is new but straightforward
- Photo upload: HIGH — storageService.ts pattern clear, signed URL is standard Supabase pattern
- AI integration: MEDIUM — Gemini image analysis confirmed supported in v1, but exact API call syntax may need minor adjustment
- Cron: MEDIUM — Vercel cron well-documented but vercel.json doesn't exist yet

**Research date:** 2026-03-05
**Valid until:** 2026-06-05 (stable stack, 90 days)
