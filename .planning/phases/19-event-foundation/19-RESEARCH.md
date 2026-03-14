# Phase 19: Event Foundation - Research

**Researched:** 2026-03-14
**Domain:** Event management hub model — Prisma schema extension, Next.js 15 routing, sidebar nav refactor, CalendarEvent bridge, Gemini AI dashboard
**Confidence:** HIGH

---

## Summary

Phase 19 introduces the `EventProject` and `EventSeries` models as the hub for all v3.0 event work — a deliberately scoped staff-only foundation that establishes data models, three entry paths, an 8-tab project page, activity logging, calendar bridge, and an AI-prioritized action dashboard. No public-facing routes exist in this phase; the security surface opens in Phase 20.

The existing codebase already contains `PlanningSeason`, `PlanningSubmission`, the `bulkPublish` service that creates `CalendarEvent` records, the `Event`/`DraftEvent` legacy models, and the `CalendarEvent.sourceModule` + `CalendarEvent.sourceId` bridge pattern (proven by Athletics). The sidebar currently shows `Calendar` as a top-level nav item and renders Planning as a CTA card. Phase 19 must promote **Events** to the top-level item with Calendar and Planning nested under it, preserve all existing `/calendar` and `/planning` routes via 301 redirects, and create the new `/events` area with sub-routes for project detail.

The activity log follows the proven `MaintenanceTicketActivity` pattern: immutable append-only rows with `actorId`, `type` enum, and `metadata: Json`. The AI dashboard calls Gemini (`gemini-2.0-flash` via `@google/genai`) to prioritize action items, consistent with every other AI feature in the platform.

**Primary recommendation:** Build `EventProject` as a first-class org-scoped model with `EventActivityLog` following the `MaintenanceTicketActivity` pattern, create a `CalendarEvent` bridge record on EventProject publish/confirm, refactor the Sidebar to nest Calendar and Planning under an Events top item (matching the Athletics collapsible pattern), and use Gemini to score/rank action items for the dashboard.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EVNT-01 | Staff can create an EventProject from an approved planning season submission | `bulkPublish` already creates CalendarEvent from PlanningSubmission — extend to also create EventProject; sourceModule bridge pattern proven |
| EVNT-02 | Staff can create a recurring EventSeries with default schedule, location, and resource needs | New `EventSeries` model with recurrence config (mirrors `rrule` pattern from CalendarEvent); EventProject links back to series |
| EVNT-03 | Staff can submit a direct event request (mid-year) for admin approval that becomes an EventProject | Reuse `DraftEvent`/`Event` approval pattern; on admin approval create EventProject; new permission `events:project:manage` needed |
| EVNT-04 | Staff can view an EventProject page with 8 tabbed sections | New `/events/[id]` route with tabbed layout; empty section states serve as built-in checklist per "Show Everything" decision |
| EVNT-05 | Staff can build a multi-day event schedule with time blocks | New `EventScheduleBlock` child model (types: SESSION, ACTIVITY, MEAL, FREE_TIME, TRAVEL, SETUP); changes auto-append activity log |
| EVNT-06 | Staff can create and manage tasks within an event | New `EventTask` child model with assignee, due date, priority, status, category; changes auto-append activity log |
| EVNT-07 | System automatically logs all changes to event activity log | New `EventActivityLog` model; service middleware writes immutable rows on any mutation — mirrors MaintenanceTicketActivity pattern |
| EVNT-08 | Calendar view reads from EventProject data via CalendarEvent bridge | `CalendarEvent.sourceModule = 'event-project'` + `sourceId = eventProjectId`; bridge record created when EventProject confirmed |
| EVNT-09 | Sidebar shows Events as primary item with Calendar and Planning nested | Sidebar refactor: add Events collapsible (like Athletics); move Calendar and Planning into its secondary panel; 301 redirects for existing routes |
| EVNT-10 | Dashboard shows AI-prioritized action items across all active events | `/api/events/dashboard` endpoint; Gemini scores action items by urgency/date proximity; one-tap resolve writes activity log entry |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma v5.22 | 5.22 | ORM for new EventProject/EventSeries/EventActivityLog models | Project standard; org-scoped extension pattern already proven |
| Next.js 15 App Router | 15.x | New `/events` pages and `/api/events/projects/*` routes | Project standard; no framework changes allowed |
| Zod | 3.x | Input validation on all new API routes | Project standard; every route uses Zod schemas |
| TanStack Query | 5.x | Client-side data fetching for EventProject tabs | Project standard; all existing feature UIs use it |
| Framer Motion | 11.x | Tab switching animation, card entrance on dashboard | Project standard; `src/lib/animations.ts` variants reused |
| @google/genai | latest | Gemini `gemini-2.0-flash` for AI action prioritization | Platform AI standard (reverted from Anthropic); all AI services use this |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide React | latest | Icons for 8 tab sections, activity log types, status chips | All UI icons; already installed |
| date-fns / day-js | existing | Date arithmetic for time block scheduling | Already used in calendar service |
| cuid / @paralleldrive/cuid2 | existing | ID generation (Prisma `@default(cuid())`) | Consistent with all existing models |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| EventProject as new model | Extending CalendarEvent | Decision already locked: events need registration, groups, budget — too much for CalendarEvent |
| Gemini for AI dashboard | Rule-based sorting | Gemini provides richer context-aware prioritization; consistent with platform AI pattern |
| Nested sidebar (collapsible) | Separate events route with breadcrumb | Collapsible matches existing Athletics pattern; no new UI paradigm needed |

**Installation:** No new dependencies required for this phase.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
  app/
    api/
      events/
        projects/
          route.ts               # GET list, POST create (direct request path)
          [id]/
            route.ts             # GET, PATCH, DELETE EventProject
            activity/
              route.ts           # GET activity log for project
            schedule/
              route.ts           # GET/POST EventScheduleBlock
              [blockId]/
                route.ts         # PATCH/DELETE schedule block
            tasks/
              route.ts           # GET/POST EventTask
              [taskId]/
                route.ts         # PATCH/DELETE task
        series/
          route.ts               # GET/POST EventSeries
          [id]/
            route.ts             # GET/PATCH/DELETE EventSeries
        dashboard/
          route.ts               # GET AI-prioritized action items
        from-submission/
          route.ts               # POST create EventProject from PlanningSubmission
  events/
    page.tsx                     # EventProject list / redirect to first active
    [id]/
      page.tsx                   # EventProject workspace (8 tabs)
  lib/
    services/
      eventProjectService.ts     # EventProject CRUD + activity log writes
      eventSeriesService.ts      # EventSeries CRUD
      eventDashboardService.ts   # AI action item aggregation + Gemini scoring
    hooks/
      useEventProject.ts         # TanStack Query hooks for EventProject tabs
      useEventDashboard.ts       # TanStack Query hook for action items
  components/
    events/
      EventProjectTabs.tsx       # 8-tab layout with tab indicator (aurora gradient)
      EventOverviewTab.tsx       # Overview tab content
      EventScheduleTab.tsx       # Multi-day schedule with time blocks
      EventPeopleTab.tsx         # People tab (empty state for Phase 20)
      EventDocumentsTab.tsx      # Documents tab (empty state for Phase 21)
      EventLogisticsTab.tsx      # Logistics tab (empty state for Phase 21)
      EventBudgetTab.tsx         # Budget tab (empty state for Phase 22)
      EventTasksTab.tsx          # Tasks management
      EventCommsTab.tsx          # Communications tab (empty state for Phase 21)
      EventActivityLog.tsx       # Activity feed component
      EventDashboard.tsx         # AI-prioritized action items dashboard
      CreateEventProjectModal.tsx # Direct request creation form
      EventSeriesDrawer.tsx      # Recurring series setup drawer
```

### Pattern 1: EventProject Hub Model (with CalendarEvent Bridge)

**What:** EventProject is the primary record. When confirmed, it creates a CalendarEvent with `sourceModule='event-project'` and `sourceId=eventProjectId`. The CalendarEvent is the calendar's view of the event; EventProject is the operational workspace.

**When to use:** Whenever displaying event data in the calendar or navigating from calendar back to EventProject page.

**Example:**
```typescript
// src/lib/services/eventProjectService.ts
// Source: established CalendarEvent bridge pattern in athleticsService.ts:226

export async function confirmEventProject(id: string, actorId: string) {
  const project = await prisma.eventProject.findUniqueOrThrow({ where: { id } })

  // Create CalendarEvent bridge record (sourceModule pattern)
  await prisma.calendarEvent.create({
    data: {
      calendarId: project.calendarId,           // org default calendar
      organizationId: project.organizationId,
      title: project.title,
      startTime: project.startsAt,
      endTime: project.endsAt,
      calendarStatus: 'CONFIRMED',
      sourceModule: 'event-project',            // bridge key
      sourceId: project.id,                     // deep-link back
      createdById: actorId,
    },
  })

  // Update project status
  const updated = await prisma.eventProject.update({
    where: { id },
    data: { status: 'CONFIRMED' },
  })

  // Append activity log entry (IMMUTABLE — never update/delete)
  await appendActivityLog(id, actorId, 'STATUS_CHANGE', {
    fromStatus: project.status,
    toStatus: 'CONFIRMED',
  })

  return updated
}
```

### Pattern 2: Activity Log (Append-Only)

**What:** Every mutation on an EventProject, EventScheduleBlock, or EventTask writes an immutable row to `EventActivityLog`. Follows the exact `MaintenanceTicketActivity` pattern.

**When to use:** In every service function that mutates event-related data. Never update or delete activity log rows.

**Example:**
```typescript
// Source: MaintenanceTicketActivity pattern from prisma/schema.prisma:2292

export async function appendActivityLog(
  eventProjectId: string,
  actorId: string,
  type: EventActivityType,
  metadata?: Record<string, unknown>
) {
  return prisma.eventActivityLog.create({
    data: {
      eventProjectId,
      actorId,
      type,
      metadata: metadata ?? {},
    },
  })
}
```

### Pattern 3: Sidebar Refactor (Collapsible Events, Nested Calendar + Planning)

**What:** Events becomes a top-level nav item that toggles a secondary sidebar panel. That panel contains Calendar and Planning links — matching the existing Athletics/Settings collapsible pattern exactly.

**When to use:** EVNT-09 requires this exact structure.

**Example:**
```typescript
// src/components/Sidebar.tsx — extend existing navItems and secondary panel pattern
// Source: existing Athletics/Settings pattern in Sidebar.tsx

// New type in Sidebar.tsx
export type EventsTab = 'calendar' | 'planning'

// Add Events to navItems (parallel to Athletics)
const navItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: CalendarClock, label: 'Events', href: '/events' }, // NEW primary item
  // Calendar removed from here — nested under Events
  ...(canReadInventory ? [{ icon: Package, label: 'AV Inventory', href: '/inventory' }] : []),
]

// eventsNavContent secondary panel:
// - Calendar link (/calendar)
// - Planning link (/planning)
// - Active EventProjects list (TanStack Query)
```

**301 Redirects** — required so bookmarked URLs continue working:
```typescript
// src/middleware.ts — add redirect rules before JWT check
// /calendar → /calendar (keep working, but sidebar highlights under Events)
// /planning → /planning (keep working)
// No URL changes needed — just sidebar active-state logic updated
// IMPORTANT: Existing URLs must NOT break per EVNT-09 success criterion
```

Note: Since `/calendar` and `/planning` are not moving (same URLs), no 301 redirects in `next.config.ts` are needed. The sidebar just needs to open the Events secondary panel when pathname starts with `/calendar` or `/planning`. This preserves all existing bookmarked URLs without any redirects.

### Pattern 4: CreateEventProject via Three Entry Paths

**What:** Three distinct flows all create an `EventProject` record, each with a different source marker.

| Path | Source | Trigger | Permission needed |
|------|--------|---------|------------------|
| Planning Season Publish | `source: 'planning-submission'` | Existing `bulkPublish` endpoint extended | `PLANNING_MANAGE` |
| Recurring EventSeries | `source: 'series'` | New series creation endpoint | `EVENTS_PROJECT_MANAGE` (new) |
| Direct Mid-Year Request | `source: 'direct-request'` | Staff submits, admin approves | `EVENTS_CREATE` → admin approves with `EVENTS_APPROVE` |

### Pattern 5: AI Action Dashboard

**What:** `GET /api/events/dashboard` fetches all active `EventProject` records, collects their tasks (overdue, due soon), schedule blocks (upcoming), and missing fields (no venue, no budget set). Passes list to Gemini for priority scoring. Returns sorted action items with `resolveAction` metadata for one-tap resolution.

**Example:**
```typescript
// src/lib/services/eventDashboardService.ts
// Source: platform AI pattern from gemini.service.ts, itBoardReportService.ts

import { GoogleGenerativeAI } from '@google/genai'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '')
const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' })

export async function getAIPrioritizedActions(orgId: string) {
  const rawItems = await collectRawActionItems(orgId)   // tasks, gaps, deadlines

  const prompt = buildActionPriorityPrompt(rawItems)    // structured prompt with event context
  const result = await model.generateContent(prompt)
  const text = result.response.text()

  return parseActionItems(text, rawItems)               // merge AI scores with raw data
}
```

### Anti-Patterns to Avoid

- **Modifying CalendarEvent directly for event workspace data:** The CalendarEvent bridge is read-only from the EventProject side. Never store planning data (tasks, budget, groups) on CalendarEvent.
- **Extending the legacy `Event` model:** The `Event` model is the old simple event record; Phase 19 introduces `EventProject` as the new hub. Do not conflate them.
- **Deleting activity log rows:** EventActivityLog rows are immutable audit trail — never update or delete them.
- **Using `rawPrisma` inside route handlers:** Use org-scoped `prisma` inside `runWithOrgContext`. Only use `rawPrisma` for auth lookups.
- **Sidebar URL redirects instead of active-state tracking:** Existing `/calendar` and `/planning` routes stay the same URLs. Just update sidebar state detection to recognize them as "under Events."

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab indicator animation | Custom CSS tab bar | `useAnimatedTabIndicator` pattern + `useRef` (existing in Sidebar/Athletics) | Already implemented in multiple places; consistent aurora gradient |
| Activity log timestamp display | Custom relative-time logic | `date-fns/formatDistanceToNow` | Edge cases: DST, locales, pluralization |
| Org-scope injection on new models | Manual `organizationId` filters | Add model names to `orgScopedModels` in `src/lib/db/index.ts` | The Prisma extension handles it automatically |
| Permission checking in service layer | Inline `if (userId !== ownerId)` | `assertCan(userId, PERMISSIONS.xxx)` from `@/lib/auth/permissions` | Cached 30s, consistent, auditable |
| Gemini JSON parsing with schema | Manual JSON.parse on model output | Use Gemini's `responseSchema` parameter for structured output | Avoids JSON parsing errors; platform already uses Gemini function calling in assistant |
| Schedule time block collision detection | Custom overlap query | Mirror `checkRoomConflict` pattern from `eventService.ts` | Same temporal overlap SQL logic; proven pattern |

**Key insight:** The platform has deep, consistent patterns for org-scoping, activity logging, permissions, and AI calls. Phase 19 should extend these patterns, not invent new ones.

---

## Common Pitfalls

### Pitfall 1: orgScopedModels List Not Updated
**What goes wrong:** New `EventProject`, `EventSeries`, `EventActivityLog`, `EventScheduleBlock`, `EventTask` models are created but NOT added to `orgScopedModels` in `src/lib/db/index.ts`. All queries return cross-tenant data.
**Why it happens:** Easy to forget — the extension is in a non-obvious location.
**How to avoid:** Add every new model to `orgScopedModels` immediately when adding to schema. Check list in `src/lib/db/index.ts` lines 4-120.
**Warning signs:** Queries returning data from multiple orgs; missing `organizationId` filter in Prisma query logs.

### Pitfall 2: CalendarEvent Bridge Record Created Twice
**What goes wrong:** `bulkPublish` creates a CalendarEvent. If Phase 19 also creates an EventProject with its own CalendarEvent bridge, the same event appears twice in calendar.
**Why it happens:** `bulkPublish` currently creates `CalendarEvent` directly from `PlanningSubmission`. EVNT-08 requires EventProject to be the source.
**How to avoid:** Modify `bulkPublish` to create an `EventProject` first, then create the `CalendarEvent` bridge with `sourceModule='event-project'`. Remove the direct CalendarEvent creation from the old path.
**Warning signs:** Duplicate calendar entries after publishing a planning season.

### Pitfall 3: Sidebar Breaking Athletics or Settings State
**What goes wrong:** Adding Events collapsible logic breaks the existing `calendarOpen`, `athleticsOpen`, `settingsOpen` state machine in `Sidebar.tsx`.
**Why it happens:** The sidebar has complex mutual-exclusion logic (only one secondary panel open at a time). Adding `eventsOpen` without integrating it into the exclusion logic causes multiple panels to open simultaneously.
**How to avoid:** Follow the exact `handleAthleticsClick` / `handleSettingsClick` pattern: new `handleEventsClick` closes other panels before opening Events. Update `secondaryOpen = settingsOpen || calendarOpen || athleticsOpen || eventsOpen`.
**Warning signs:** Multiple secondary panels visible simultaneously; back button behavior broken.

### Pitfall 4: Activity Log Writes Missing in Service Functions
**What goes wrong:** Tasks and schedule block mutations don't call `appendActivityLog`. EVNT-07 requires ALL changes logged automatically.
**Why it happens:** Activity log call is easy to omit when focused on the primary mutation.
**How to avoid:** Write a service-layer wrapper that always calls `appendActivityLog` after any mutation. Pattern: `mutate → verify success → appendLog`. Test that every mutation produces a log entry.
**Warning signs:** Activity feed shows gaps; schedule changes not reflected in log.

### Pitfall 5: Direct Event Request Not Requiring Admin Approval
**What goes wrong:** EVNT-03 path creates an `EventProject` directly as `CONFIRMED` instead of requiring admin approval.
**Why it happens:** Entry path 1 (from planning season) creates confirmed projects; entry path 3 should be different.
**How to avoid:** Direct requests create `EventProject` with `status: 'PENDING_APPROVAL'`. Separate admin endpoint `POST /api/events/projects/[id]/approve` transitions to `CONFIRMED` and creates CalendarEvent bridge. Permission check: `EVENTS_APPROVE` required to approve.
**Warning signs:** Staff can self-approve events; admin approval step skipped.

### Pitfall 6: Gemini AI Call Blocking Dashboard Load
**What goes wrong:** Dashboard waits for full Gemini response (potentially 2-5s) before rendering.
**Why it happens:** Sequential fetch: load action items → call Gemini → render.
**How to avoid:** Load raw action items immediately (fast DB query). Stream or lazy-load Gemini scoring in background. Render dashboard with unscored items (sorted by due date) while AI scores load. Framer Motion skeleton matching final layout during AI load.
**Warning signs:** Dashboard takes >3 seconds to first meaningful paint.

---

## Code Examples

Verified patterns from existing codebase:

### Prisma Schema: EventProject Hub Model
```prisma
// Follows existing org-scoped soft-delete pattern (MaintenanceTicket, CalendarEvent)
// Source: prisma/schema.prisma patterns

enum EventProjectStatus {
  DRAFT
  PENDING_APPROVAL
  CONFIRMED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum EventProjectSource {
  PLANNING_SUBMISSION  // Created from PlanningSubmission via bulkPublish
  SERIES               // Created from EventSeries recurring schedule
  DIRECT_REQUEST       // Submitted directly by staff, requires approval
}

enum EventScheduleBlockType {
  SESSION
  ACTIVITY
  MEAL
  FREE_TIME
  TRAVEL
  SETUP
}

enum EventTaskStatus {
  TODO
  IN_PROGRESS
  BLOCKED
  DONE
}

enum EventTaskPriority {
  LOW
  NORMAL
  HIGH
  CRITICAL
}

enum EventActivityType {
  CREATED
  STATUS_CHANGE
  TASK_CREATED
  TASK_UPDATED
  TASK_COMPLETED
  SCHEDULE_BLOCK_ADDED
  SCHEDULE_BLOCK_UPDATED
  SCHEDULE_BLOCK_REMOVED
  FIELD_UPDATED
  APPROVAL_REQUESTED
  APPROVAL_GRANTED
  APPROVAL_REJECTED
}

model EventProject {
  id               String              @id @default(cuid())
  organizationId   String
  campusId         String?
  schoolId         String?
  title            String
  description      String?
  coverImageUrl    String?
  startsAt         DateTime
  endsAt           DateTime
  isMultiDay       Boolean             @default(false)
  expectedAttendance Int?
  locationText     String?
  buildingId       String?
  areaId           String?
  roomId           String?
  status           EventProjectStatus  @default(DRAFT)
  source           EventProjectSource  @default(DIRECT_REQUEST)
  sourceId         String?             // planningSubmissionId or eventSeriesId
  calendarId       String?             // Target calendar for bridge record
  createdById      String
  approvedById     String?
  approvedAt       DateTime?
  completedAt      DateTime?
  metadata         Json?               // Extensible data bag
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
  deletedAt        DateTime?

  organization     Organization        @relation(...)
  campus           Campus?             @relation(...)
  school           School?             @relation(...)
  building         Building?           @relation(...)
  area             Area?               @relation(...)
  room             Room?               @relation(...)
  createdBy        User                @relation("EventProjectCreator", ...)
  approvedBy       User?               @relation("EventProjectApprover", ...)
  scheduleBlocks   EventScheduleBlock[]
  tasks            EventTask[]
  activityLog      EventActivityLog[]

  @@index([organizationId, status])
  @@index([organizationId, startsAt])
  @@index([organizationId, deletedAt])
  @@index([createdById])
  @@index([source, sourceId])
}

model EventSeries {
  id               String    @id @default(cuid())
  organizationId   String
  campusId         String?
  title            String
  description      String?
  rrule            String?             // RFC 5545 recurrence rule (mirrors CalendarEvent)
  defaultStartTime String?             // HH:mm
  defaultDuration  Int?                // minutes
  defaultLocationText String?
  defaultBuildingId String?
  defaultRoomId    String?
  resourceNeeds    Json?               // Default resource needs JSON
  isActive         Boolean             @default(true)
  createdById      String
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  organization     Organization        @relation(...)
  createdBy        User                @relation("EventSeriesCreator", ...)
  projects         EventProject[]

  @@index([organizationId, isActive])
}

model EventScheduleBlock {
  id              String                  @id @default(cuid())
  organizationId  String
  eventProjectId  String
  type            EventScheduleBlockType  @default(SESSION)
  title           String
  description     String?
  startsAt        DateTime
  endsAt          DateTime
  locationText    String?
  leadId          String?                 // User responsible for this block
  sortOrder       Int                     @default(0)
  metadata        Json?
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  organization Organization   @relation(...)
  eventProject EventProject   @relation(...)
  lead         User?          @relation("ScheduleBlockLead", ...)

  @@index([eventProjectId, startsAt])
  @@index([organizationId])
}

model EventTask {
  id             String            @id @default(cuid())
  organizationId String
  eventProjectId String
  title          String
  description    String?
  status         EventTaskStatus   @default(TODO)
  priority       EventTaskPriority @default(NORMAL)
  category       String?           // "Logistics", "Communications", "Venue", "Volunteers", etc.
  assigneeId     String?
  dueDate        DateTime?
  completedAt    DateTime?
  createdById    String
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  organization   Organization      @relation(...)
  eventProject   EventProject      @relation(...)
  assignee       User?             @relation("EventTaskAssignee", ...)
  createdBy      User              @relation("EventTaskCreator", ...)

  @@index([eventProjectId, status])
  @@index([eventProjectId, dueDate])
  @@index([organizationId, assigneeId])
}

model EventActivityLog {
  id             String            @id @default(cuid())
  organizationId String
  eventProjectId String
  actorId        String
  type           EventActivityType
  metadata       Json?             // { fromStatus, toStatus, field, oldValue, newValue, etc. }
  createdAt      DateTime          @default(now())

  organization   Organization      @relation(...)
  eventProject   EventProject      @relation(...)
  actor          User              @relation("EventActivityActor", ...)

  // NOTE: No updatedAt — these rows are IMMUTABLE
  @@index([eventProjectId, createdAt])
  @@index([organizationId])
}
```

### API Route Pattern: EventProject CRUD
```typescript
// src/app/api/events/projects/route.ts
// Source: CLAUDE.md API Route Pattern

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_CREATE)
    const body = await req.json()
    const validated = CreateEventProjectSchema.parse(body)

    return await runWithOrgContext(orgId, async () => {
      const project = await eventProjectService.createEventProject({
        ...validated,
        createdById: ctx.userId,
        source: 'DIRECT_REQUEST',
        status: 'PENDING_APPROVAL',
      })
      return NextResponse.json(ok(project), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
```

### Sidebar: Detecting Events Sub-Routes for Active State
```typescript
// src/components/Sidebar.tsx addition — mirrors calendar detection
// Source: Sidebar.tsx lines 317-319

useIsomorphicLayoutEffect(() => {
  if (pathname.startsWith('/events') || pathname.startsWith('/calendar') || pathname.startsWith('/planning')) {
    setEventsOpen(true)
    setSettingsOpen(false)
    setAthleticsOpen(false)
  }
}, [pathname])
```

### Gemini Action Prioritization
```typescript
// src/lib/services/eventDashboardService.ts
// Source: platform pattern from itBoardReportService.ts, boardReportService.ts

const PRIORITY_PROMPT = `
You are an event coordinator assistant. Given the following list of action items
across active school events, rank them by urgency (1=most urgent).

Action items:
{{ITEMS_JSON}}

Today: {{TODAY}}

Return JSON array: [{ "id": "...", "urgencyScore": 1-10, "reason": "..." }]
Sorted highest urgency first. Respond ONLY with valid JSON.
`

export async function scoreActionItems(items: RawActionItem[]): Promise<ScoredActionItem[]> {
  if (items.length === 0) return []

  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = PRIORITY_PROMPT
    .replace('{{ITEMS_JSON}}', JSON.stringify(items))
    .replace('{{TODAY}}', new Date().toISOString())

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  // Parse and merge scores back with original items
  const scores: { id: string; urgencyScore: number; reason: string }[] = JSON.parse(text)
  return items.map(item => ({
    ...item,
    urgencyScore: scores.find(s => s.id === item.id)?.urgencyScore ?? 5,
    aiReason: scores.find(s => s.id === item.id)?.reason ?? '',
  })).sort((a, b) => b.urgencyScore - a.urgencyScore)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Event` model (simple AV booking) | `EventProject` hub model (planning workspace) | Phase 19 | Event becomes a first-class project with 8 sections |
| `bulkPublish` creates CalendarEvent directly from PlanningSubmission | `bulkPublish` creates EventProject first, then CalendarEvent bridge | Phase 19 | Consistent data model; submission → EventProject → CalendarEvent |
| Calendar as top-level nav item | Events as top-level; Calendar + Planning nested under it | Phase 19 | Navigation reflects "events are the product" positioning |
| No event activity logging | Immutable `EventActivityLog` on every mutation | Phase 19 | Full audit trail matching maintenance ticket history |
| No event task management | `EventTask` CRUD with assignee, priority, due date | Phase 19 | Task tracking built into event workspace |

**Deprecated/outdated:**
- `DraftEvent` model: Was used for the old "new event" flow. Still exists for backward compatibility. Phase 19 does not remove it, but new event creation (direct request path) uses `EventProject` with `status: PENDING_APPROVAL` instead.
- `Event` model: The simple AV event booking model. Preserved for backward compat. All new event management goes through `EventProject`.
- Calendar nav CTA card (the "Start planning your calendar" animated card in `calendarNavContent`): This moves or is repurposed when Planning is nested under Events secondary panel.

---

## Key Schema Extension Points

### db/index.ts — orgScopedModels additions required

Add to the `orgScopedModels` Set in `src/lib/db/index.ts`:
```typescript
'EventProject',
'EventSeries',
'EventScheduleBlock',
'EventTask',
'EventActivityLog',
```

Also add to soft-delete models if desired (recommended for EventProject):
```typescript
// EventProject should be soft-deleted like Event, DraftEvent, CalendarEvent
'EventProject',
```

### permissions.ts — New permissions required

```typescript
// src/lib/permissions.ts — add to PERMISSIONS object
EVENT_PROJECT_CREATE: 'events:project:create',
EVENT_PROJECT_READ: 'events:project:read',
EVENT_PROJECT_UPDATE_OWN: 'events:project:update:own',
EVENT_PROJECT_UPDATE_ALL: 'events:project:update:all',
EVENT_PROJECT_DELETE: 'events:project:delete',
EVENT_PROJECT_APPROVE: 'events:project:approve',
EVENT_SERIES_MANAGE: 'events:series:manage',
```

These should be seeded via `seedOrgDefaults` and assigned to `admin` and `super-admin` roles.

---

## Open Questions

1. **EventProject ↔ CalendarEvent deep-link routing**
   - What we know: CalendarEvent has `sourceModule` and `sourceId` fields. Athletics uses `sourceModule: 'athletics'`. The bridge pattern works.
   - What's unclear: When a user clicks a bridged CalendarEvent in the CalendarView, what URL do they navigate to? Needs `EventProjectDetail` route format: `/events/[id]`.
   - Recommendation: In `EventDetailPanel.tsx` (or `CalendarView.tsx`), check `sourceModule === 'event-project'` and render a "View Event Project" deep-link button rather than the standard event editor.

2. **Planning CTA Card in Sidebar**
   - What we know: The `calendarNavContent` bottom section has an animated "Start planning your calendar" CTA card linking to `/planning`.
   - What's unclear: Does this card move to the new Events secondary panel, or is it removed?
   - Recommendation: Move it to the Events secondary panel's bottom section (same position, same design). The planning season is now "under" Events, not a standalone entity.

3. **`bulkPublish` migration: CalendarEvent vs EventProject**
   - What we know: `bulkPublish` creates `CalendarEvent` records directly. EVNT-01 requires EventProject to be created from approved submissions.
   - What's unclear: Does Phase 19 change `bulkPublish` to create EventProject (and EventProject creates CalendarEvent bridge), or does Phase 19 add a separate "convert to EventProject" action per submission?
   - Recommendation: Change `bulkPublish` to create EventProject first with `source: 'PLANNING_SUBMISSION'`, then EventProject creation triggers CalendarEvent bridge creation. This makes EventProject the single source of truth going forward.

4. **AI Dashboard Caching**
   - What we know: Gemini calls can take 1-3 seconds. Dashboard needs to feel fast.
   - What's unclear: Should action item scores be cached in DB (event-scoped) or always recomputed?
   - Recommendation: Cache scores in a `metadata` field on EventProject (e.g., `{ aiActionScore: 7.5, aiScoreComputedAt: '...' }`). Recompute when project data changes or score is >1 hour old. Render stale scores immediately while recomputing in background.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.mts` (project root) |
| Quick run command | `npm run test -- --testPathPattern=events` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVNT-01 | bulkPublish creates EventProject from approved PlanningSubmission | unit | `npm run test -- --testPathPattern=eventProjectService` | ❌ Wave 0 |
| EVNT-02 | EventSeries create with recurrence config | unit | `npm run test -- --testPathPattern=eventSeriesService` | ❌ Wave 0 |
| EVNT-03 | Direct request creates EventProject with PENDING_APPROVAL status | unit | `npm run test -- --testPathPattern=eventProjectService` | ❌ Wave 0 |
| EVNT-04 | EventProject API GET returns 8-tab data structure | unit | `npm run test -- --testPathPattern=events-project-api` | ❌ Wave 0 |
| EVNT-05 | Schedule block CRUD + activity log entry created | unit | `npm run test -- --testPathPattern=eventSchedule` | ❌ Wave 0 |
| EVNT-06 | Task CRUD with status/priority/assignee + activity log entry | unit | `npm run test -- --testPathPattern=eventTask` | ❌ Wave 0 |
| EVNT-07 | Every mutation produces exactly one activity log entry | unit | `npm run test -- --testPathPattern=eventActivityLog` | ❌ Wave 0 |
| EVNT-08 | CalendarEvent bridge record created with sourceModule='event-project' | unit | `npm run test -- --testPathPattern=eventProjectService` | ❌ Wave 0 |
| EVNT-09 | Sidebar nav structure: Events top-level, Calendar+Planning nested | manual | Visual verification in browser | N/A |
| EVNT-10 | Dashboard action items sorted by AI urgency score | unit | `npm run test -- --testPathPattern=eventDashboard` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- --testPathPattern=event`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/lib/eventProjectService.test.ts` — covers EVNT-01, EVNT-03, EVNT-07, EVNT-08
- [ ] `__tests__/lib/eventSeriesService.test.ts` — covers EVNT-02
- [ ] `__tests__/lib/eventScheduleService.test.ts` — covers EVNT-05, EVNT-07
- [ ] `__tests__/lib/eventTaskService.test.ts` — covers EVNT-06, EVNT-07
- [ ] `__tests__/lib/eventDashboardService.test.ts` — covers EVNT-10 (mock Gemini call)
- [ ] `__tests__/api/events-project-api.test.ts` — covers EVNT-04 API contract

---

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` — All existing models inspected directly; EventProject does not yet exist; CalendarEvent.sourceModule pattern confirmed at line 1218; MaintenanceTicketActivity pattern confirmed at lines 2292-2313
- `src/lib/db/index.ts` — orgScopedModels set inspected; all new models must be added here
- `src/lib/permissions.ts` — All existing permissions inspected; no EventProject permissions exist yet
- `src/components/Sidebar.tsx` — Full nav structure inspected; Calendar is currently top-level navItem; calendarNavContent secondary panel at line 1564; Athletics collapsible pattern at lines 803-968
- `src/lib/services/planningSeasonService.ts` — `bulkPublish` function at line 297; currently creates CalendarEvent directly
- `src/app/api/planning-seasons/[id]/publish/route.ts` — Existing publish endpoint confirmed
- `CLAUDE.md` — Tech stack, multi-tenancy pattern, API route boilerplate, permissions pattern
- `.planning/STATE.md` — Key decisions: EventProject as hub, Phase 19 is staff-only, Show Everything design
- `vitest.config.mts` — Test infrastructure confirmed; `npm run test` = `vitest run`

### Secondary (MEDIUM confidence)
- `src/lib/services/athleticsService.ts:226` — `sourceModule: 'athletics'` bridge pattern verified; confirms CalendarEvent bridge approach for event-project
- `__tests__/api/ai-routes.test.ts`, `__tests__/api/tickets.test.ts` — Existing test structure inspected; vitest with mocked Prisma pattern established
- `.planning/REQUIREMENTS.md` — All 10 EVNT requirements confirmed as Phase 19 scope

### Tertiary (LOW confidence)
- None — all findings are based on direct codebase inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries required; all tools present in codebase
- Architecture: HIGH — all patterns exist (MaintenanceTicketActivity, CalendarEvent bridge, Athletics sidebar, Gemini AI); research confirms how to extend them
- Pitfalls: HIGH — identified from direct code inspection of existing patterns and migration risks
- Data model: HIGH — designed to match existing conventions exactly; all referenced models verified in schema

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable platform, no external dependencies)
