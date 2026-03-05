# Architecture Patterns — Lionheart Maintenance & Facilities Module

**Domain:** K-12 CMMS / Facilities Management, added to existing multi-tenant SaaS
**Researched:** 2026-03-05
**Overall confidence:** HIGH (based on direct codebase inspection + established CMMS patterns)

---

## Context: What Already Exists

The platform provides all infrastructure this module needs:

| Infrastructure | Location | How Maintenance Uses It |
|---|---|---|
| Org-scoped Prisma client | `src/lib/db/index.ts` | All new models register in `orgScopedModels` Set |
| AsyncLocalStorage org context | `src/lib/org-context.ts` | `runWithOrgContext` wraps all route handlers — unchanged |
| JWT auth + permission check | `src/lib/auth/permissions.ts` | `assertCan(userId, PERMISSIONS.MAINTENANCE_*)` |
| Campus → Building → Area → Room hierarchy | `prisma/schema.prisma` | `MaintenanceTicket` FKs to `buildingId`, `areaId`, `roomId` directly |
| In-app notification system | `src/lib/services/notificationService.ts` | Ticket lifecycle emits both in-app + email notifications |
| Email service (Resend + SMTP fallback) | `src/lib/services/emailService.ts` | New email templates for all 10 ticket lifecycle events |
| Module feature gating | `TenantModule` model + `useModuleEnabled` hook | `moduleId: 'maintenance'` in `TenantModule` |
| Supabase Storage | `src/lib/services/storageService.ts` | Photos, receipts, compliance documents |
| Existing `Ticket` model | `prisma/schema.prisma` | Kept untouched; new `MaintenanceTicket` model is separate |

The existing `Ticket` model (OPEN/IN_PROGRESS/RESOLVED, simple 3-status) is **not extended**. The spec explicitly calls for a separate `MaintenanceTicket` model. The existing model serves OperationsEngine auto-generated tickets from calendar events — a different concern.

---

## Recommended Architecture

### Module Namespace

All new code lives under a dedicated namespace, following the Athletics module pattern:

```
src/
  app/
    api/
      maintenance/
        tickets/
          route.ts                  GET list, POST create
          [id]/
            route.ts                GET detail
            status/route.ts         PATCH status transition
            assign/route.ts         PATCH assign
            claim/route.ts          POST self-claim
            comments/route.ts       GET/POST activity feed
            photos/route.ts         POST photo upload
            ai-analysis/route.ts    POST trigger AI diagnosis
            split/route.ts          POST split ticket
            labor/route.ts          POST log labor (Phase 2)
            costs/route.ts          POST log cost entry (Phase 2)
        board/
          route.ts                  GET kanban board data
        assets/
          route.ts                  GET/POST asset register (Phase 2)
          [id]/route.ts             GET/PATCH/DELETE asset (Phase 2)
          qr/[code]/route.ts        GET resolve QR (Phase 2)
        pm-schedules/
          route.ts                  GET/POST PM schedules (Phase 2)
          [id]/route.ts             GET/PATCH/DELETE (Phase 2)
          [id]/trigger/route.ts     POST manual PM generation (Phase 2)
        analytics/
          route.ts                  GET operational metrics (Phase 2)
        compliance/
          route.ts                  GET/POST compliance records (Phase 3)
          [id]/route.ts             GET/PATCH compliance record (Phase 3)
        reports/
          board/route.ts            GET board-ready report (Phase 3)
          fci/route.ts              GET FCI score (Phase 3)
        knowledge/
          route.ts                  GET/POST articles (Phase 3)
          [id]/route.ts             GET/PATCH article (Phase 3)
    [tenant]/
      maintenance/
        page.tsx                    Module shell (ModuleGate wrapper)
  lib/
    services/
      maintenance/
        ticketService.ts            Core ticket CRUD + state machine
        boardService.ts             Kanban board queries
        aiDiagnosticService.ts      Claude Sonnet integration
        pmEngine.ts                 PM schedule runner (Phase 2)
        assetService.ts             Asset register (Phase 2)
        laborService.ts             Labor + cost tracking (Phase 2)
        analyticsService.ts         Metrics aggregation (Phase 2)
        complianceService.ts        Compliance calendar (Phase 3)
        reportingService.ts         FCI + board reports (Phase 3)
        knowledgeService.ts         Knowledge base (Phase 3)
        maintenanceEmailService.ts  Maintenance-specific email templates
        maintenanceNotificationService.ts  Ticket lifecycle notifications
  components/
    maintenance/
      TicketSubmissionForm.tsx      Mobile-first multi-step form
      KanbanBoard.tsx               Drag-and-drop board
      TicketCard.tsx                Board card component
      TicketDetailDrawer.tsx        Full ticket detail panel
      AiDiagnosticPanel.tsx         Claude analysis display
      ActivityFeed.tsx              Status history + comments
      TechnicianProfileSetup.tsx    Specialty configuration
      HeadDashboard.tsx             HoM overview
      AssetRegister.tsx             Asset list/detail (Phase 2)
      PmCalendar.tsx                PM schedule calendar (Phase 2)
      ComplianceCalendar.tsx        Compliance domains (Phase 3)
      BoardReport.tsx               Board-ready report (Phase 3)
```

---

## Component Boundaries

### Who Talks to Whom

```
Browser (Client Components)
  ├── TicketSubmissionForm.tsx
  │     → POST /api/maintenance/tickets
  │     → POST /api/maintenance/tickets/[id]/photos (Supabase Storage upload)
  │     → POST /api/maintenance/tickets/[id]/ai-analysis (lazy, on first tech view)
  │
  ├── KanbanBoard.tsx
  │     → GET /api/maintenance/board?campusId=&view=my|campus|all
  │     → PATCH /api/maintenance/tickets/[id]/status (drag-and-drop)
  │     → Real-time: 30s poll (no websockets; consistent with notification bell pattern)
  │
  ├── TicketDetailDrawer.tsx
  │     → GET /api/maintenance/tickets/[id]
  │     → POST /api/maintenance/tickets/[id]/comments
  │     → PATCH /api/maintenance/tickets/[id]/assign
  │     → POST /api/maintenance/tickets/[id]/claim
  │     → POST /api/maintenance/tickets/[id]/split
  │
  └── AiDiagnosticPanel.tsx
        → POST /api/maintenance/tickets/[id]/ai-analysis
        → Reads cached aiAnalysis from ticket detail response

API Route Layer (Next.js App Router)
  ├── Validates JWT (getUserContext)
  ├── Validates permissions (assertCan)
  ├── Validates input (Zod schemas in service layer)
  └── Calls service functions inside runWithOrgContext

Service Layer
  ├── ticketService.ts         → prisma.maintenanceTicket (org-scoped)
  ├── boardService.ts          → prisma.maintenanceTicket (multi-filter query)
  ├── aiDiagnosticService.ts   → Anthropic API + prisma.maintenanceTicket (cache update)
  ├── pmEngine.ts              → prisma.pmSchedule + prisma.maintenanceTicket (create)
  └── maintenanceEmailService  → emailService.sendBrandedEmail (new templates)

Side Effects (fired after state transitions)
  ├── maintenanceNotificationService  → createNotification / createBulkNotifications
  └── maintenanceEmailService         → sendBrandedEmail (non-blocking, fire-and-forget)
```

### Component Isolation Rules

- Service functions **never call each other directly** across domain boundaries. `ticketService.ts` does not import `pmEngine.ts`. The PM engine calls `ticketService.createMaintenanceTicket` as its only cross-service dependency.
- AI analysis is **always lazy**: called only when a technician first opens a ticket with photos. Results are cached in `MaintenanceTicket.aiAnalysis` (JSON field). Subsequent opens read from cache, not from Anthropic API.
- Notifications and emails are **always fire-and-forget**: they cannot fail a status transition. Use the same pattern as `notificationService.ts` — wrapped in try/catch, logged on error.
- The Kanban board endpoint is a **read-only projection**: it never mutates state. Status changes go through the dedicated `/status` endpoint with its state machine validation.

---

## Data Flow: Ticket Lifecycle

### Submission Flow

```
Staff submits form (mobile)
  → TicketSubmissionForm validates client-side (Zod)
  → POST /api/maintenance/tickets
      → getUserContext (JWT decode)
      → assertCan(userId, PERMISSIONS.MAINTENANCE_SUBMIT)
      → runWithOrgContext(orgId, async () => {
          → ticketService.createMaintenanceTicket(input, userId)
              → prisma.maintenanceTicket.create({ status: BACKLOG })
              → Assign ticketNumber (MT-XXXX, sequential per org)
          → maintenanceNotificationService.onTicketCreated(ticket)
              → createNotification for HoM if URGENT
          → maintenanceEmailService.sendTicketConfirmation(submitter)
          → if photos: initiate background AI pre-analysis
        })
  → 201 { ok: true, data: { id, ticketNumber, status: 'BACKLOG' } }
```

### Status Transition Flow

```
Technician drags card on Kanban (or updates via detail drawer)
  → PATCH /api/maintenance/tickets/[id]/status
      → getUserContext
      → assertCan(userId, PERMISSIONS.MAINTENANCE_UPDATE_STATUS)
      → runWithOrgContext(orgId, async () => {
          → ticketService.transitionStatus(id, newStatus, userId, metadata)
              → validateTransition(currentStatus, newStatus, userId, role)
                  → THROWS if transition invalid per state machine
              → validateTransitionRequirements(newStatus, metadata)
                  → ON_HOLD: requires holdReason
                  → QA: requires completionPhoto + completionNote
                  → DONE: Head/Admin only
                  → CANCELLED: requires cancellationReason, Head/Admin only
              → prisma.maintenanceTicket.update({ status, ...timestamps })
              → prisma.ticketActivity.create({ type: STATUS_CHANGE, fromStatus, toStatus, actorId })
          → [fire-and-forget]:
              → maintenanceNotificationService.onStatusChange(ticket, newStatus)
              → maintenanceEmailService.sendStatusChangeEmail(ticket, newStatus)
        })
  → 200 { ok: true, data: updatedTicket }
```

### PM Auto-Generation Flow (Phase 2)

```
Cron job / API trigger → POST /api/maintenance/pm-schedules/[id]/trigger (internal or scheduled)
  OR
App startup check: pmEngine.checkAndGenerateDueTickets()
  → pmEngine.getSchedulesDue(today + advanceNoticeDays)
  → For each due schedule:
      → ticketService.createMaintenanceTicket({
            isPmGenerated: true,
            pmScheduleId: schedule.id,
            title: schedule.title,
            status: TODO,                     ← PM tickets skip BACKLOG
            assignedToId: schedule.assignedToId,
          })
      → pmSchedule.update({ nextDueDate: calculateNext(completionDate, recurrenceType) })
      → maintenanceEmailService.sendPmGeneratedEmail(assignedTech)
```

---

## State Machine: Ticket Lifecycle

### Valid States

```
BACKLOG     — Submitted, unassigned
TODO        — Assigned or self-claimed, not yet started
IN_PROGRESS — Actively being worked
ON_HOLD     — Paused (requires holdReason)
QA          — Work complete, pending Head/Admin sign-off (requires completionPhoto)
DONE        — Fully resolved
SCHEDULED   — Future-dated; invisible to backlog until scheduledDate
CANCELLED   — Terminal; requires cancellationReason
```

### Valid Transitions

```typescript
// Implemented as a lookup map in ticketService.ts

const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  BACKLOG:     ['TODO', 'SCHEDULED', 'CANCELLED'],
  TODO:        ['IN_PROGRESS', 'BACKLOG', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'QA', 'CANCELLED'],
  ON_HOLD:     ['IN_PROGRESS', 'CANCELLED'],
  QA:          ['DONE', 'IN_PROGRESS', 'CANCELLED'],   // IN_PROGRESS = failed inspection
  DONE:        [],                                       // Terminal (can reopen via new ticket)
  SCHEDULED:   ['BACKLOG', 'CANCELLED'],                 // System auto-transitions on scheduledDate
  CANCELLED:   [],                                       // Terminal
}
```

### Role-Gated Transitions

```typescript
// Some transitions require specific roles regardless of permission string

const TRANSITION_ROLE_GATES: Partial<Record<TicketStatus, { roles: string[] }>> = {
  DONE:      { roles: ['head-of-maintenance', 'admin', 'super-admin'] },
  CANCELLED: { roles: ['head-of-maintenance', 'admin', 'super-admin'] },
}

// Self-claim gate: BACKLOG → TODO via /claim
// Only allowed if user's TechnicianProfile.specialties includes ticket.specialtyTag
// OR ticket.specialtyTag === 'GENERAL'
// Head of Maintenance can always claim/assign
```

### Transition Metadata Requirements

```typescript
interface TransitionMetadata {
  holdReason?: HoldReasonType       // Required: IN_PROGRESS → ON_HOLD
  holdReasonNote?: string           // Optional: free text
  completionPhoto?: string          // Required: IN_PROGRESS → QA (Supabase Storage URL)
  completionNote?: string           // Required: IN_PROGRESS → QA
  cancellationReason?: string       // Required: any → CANCELLED
  failedInspectionReason?: string   // Optional: QA → IN_PROGRESS
  scheduledDate?: Date              // Required: any → SCHEDULED
}
```

### State Machine Implementation Pattern

```typescript
// src/lib/services/maintenance/ticketService.ts

export async function transitionStatus(
  ticketId: string,
  newStatus: TicketStatus,
  actorId: string,
  actorRole: string,
  metadata: TransitionMetadata
): Promise<MaintenanceTicket> {
  const ticket = await prisma.maintenanceTicket.findUnique({ where: { id: ticketId } })
  if (!ticket) throw new Error('Ticket not found')

  // 1. Validate transition is allowed from current status
  const allowed = ALLOWED_TRANSITIONS[ticket.status] ?? []
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from ${ticket.status} to ${newStatus}`)
  }

  // 2. Validate role gates
  const roleGate = TRANSITION_ROLE_GATES[newStatus]
  if (roleGate && !roleGate.roles.includes(actorRole)) {
    throw new Error(`Role ${actorRole} cannot set status to ${newStatus}`)
  }

  // 3. Validate metadata requirements
  validateTransitionMetadata(newStatus, metadata)  // throws on missing required fields

  // 4. Build update payload
  const updateData = buildUpdatePayload(newStatus, metadata)

  // 5. Atomic update + activity log
  const [updated] = await rawPrisma.$transaction([
    rawPrisma.maintenanceTicket.update({ where: { id: ticketId }, data: updateData }),
    rawPrisma.ticketActivity.create({
      data: {
        ticketId,
        organizationId: ticket.organizationId,
        actorId,
        type: 'STATUS_CHANGE',
        fromStatus: ticket.status,
        toStatus: newStatus,
        metadata: metadata as any,
      }
    }),
  ])

  return updated
}
```

Note: Use `rawPrisma.$transaction` here (not the org-scoped `prisma.$transaction`) per the existing CLAUDE.md warning about interactive transactions on extended clients.

---

## PM Scheduling Engine Integration

### Design: Pull-Based, Not Push-Based

The PM engine uses a **pull pattern**: it queries for schedules whose `nextDueDate` is within `advanceNoticeDays` of today. It does not register event listeners or use a message queue. This matches the platform's existing style (no background job infrastructure, no BullMQ, no cron server).

### Trigger Mechanism Options

The platform has no dedicated cron infrastructure. Two viable options:

**Option A (recommended for Phase 2 MVP):** API-triggered on app load.
- `pmEngine.checkAndGenerateDueTickets()` is called from an internal cron route `POST /api/maintenance/pm-schedules/run-due` protected by a shared secret. Run via Vercel Cron or external scheduler (cron-job.org).
- Simple, observable, zero infrastructure.

**Option B (Phase 3 enhancement):** Trigger on Kanban board load.
- When Head loads the board, silently call PM check in background.
- No external dependency, but only triggers when someone opens the board.

The PM engine must run **inside a `runWithOrgContext`** wrapper. Since it processes multiple orgs, it iterates `Organization.id` list (via `rawPrisma`) and calls `runWithOrgContext(orgId, ...)` for each.

### PM Engine Architecture

```typescript
// src/lib/services/maintenance/pmEngine.ts

export async function checkAndGenerateDueTickets(orgId?: string): Promise<void> {
  // If orgId provided, run for one org (API-triggered for specific tenant)
  // If not provided, run for all orgs (cron-triggered global sweep)

  const orgs = orgId
    ? [{ id: orgId }]
    : await rawPrisma.organization.findMany({ select: { id: true } })

  for (const org of orgs) {
    await runWithOrgContext(org.id, async () => {
      const dueSchedules = await prisma.pmSchedule.findMany({
        where: {
          isActive: true,
          nextDueDate: { lte: addDays(new Date(), MAX_ADVANCE_DAYS) },
          // Prevent duplicate generation: no open ticket already linked
          maintenanceTickets: { none: { status: { notIn: ['DONE', 'CANCELLED'] } } },
        },
      })

      for (const schedule of dueSchedules) {
        await createMaintenanceTicket({
          organizationId: org.id,
          title: schedule.title,
          specialtyTag: schedule.specialtyTag,
          assignedToId: schedule.assignedToId,
          status: 'TODO',
          isPmGenerated: true,
          pmScheduleId: schedule.id,
          checklistItems: schedule.checklistItems,
        })
      }
    })
  }
}
```

### PM Completion and Recurrence Calculation

```typescript
// When a PM-generated ticket transitions to DONE:
// → pmEngine.onPmTicketCompleted(ticket) is called (fire-and-forget from ticketService)

async function onPmTicketCompleted(ticket: MaintenanceTicket): Promise<void> {
  if (!ticket.pmScheduleId) return
  const schedule = await prisma.pmSchedule.findUnique({ where: { id: ticket.pmScheduleId } })
  if (!schedule) return

  const completionDate = ticket.resolvedAt ?? new Date()
  const nextDueDate = calculateNextDueDate(
    completionDate,
    schedule.recurrenceType,
    schedule.recurrenceInterval,
    schedule.avoidSchoolYear
  )

  await prisma.pmSchedule.update({
    where: { id: schedule.id },
    data: { nextDueDate },
  })
}
```

---

## Asset-Ticket Relationship

### Phase 2 Data Structure

```
Asset (1) ──── (many) MaintenanceTicket    -- via MaintenanceTicket.assetId FK
Asset (1) ──── (many) PmSchedule           -- via PmSchedule.assetId FK
```

Assets are a **reference table** that tickets optionally link to. The asset record does not hold tickets — tickets hold the asset reference. This preserves the ticket as the unit of work.

### Repeat Repair Detection

```typescript
// In analyticsService.ts — runs as part of Phase 2 analytics

async function detectRepeatRepairs(assetId: string): Promise<RepeatRepairFlag | null> {
  const twelveMonthsAgo = subMonths(new Date(), 12)
  const tickets = await prisma.maintenanceTicket.findMany({
    where: {
      assetId,
      status: 'DONE',
      resolvedAt: { gte: twelveMonthsAgo },
    },
    include: { costEntries: true, laborEntries: true },
  })

  if (tickets.length >= 3) {
    const totalCost = sumCosts(tickets)      // labor + materials
    const asset = await prisma.asset.findUnique({ where: { id: assetId } })
    const threshold = (asset?.replacementCostUSD ?? 0) * (asset?.repairThresholdPct ?? 0.5)

    return {
      ticketCount: tickets.length,
      totalRepairCost: totalCost,
      replacementCost: asset?.replacementCostUSD,
      exceedsThreshold: totalCost > threshold,
      recommendation: totalCost > threshold ? 'REPLACE' : 'CONTINUE_REPAIR',
    }
  }
  return null
}
```

---

## How New Models Register in the Org-Scoped Extension

Every new Prisma model must be added to the two Sets in `src/lib/db/index.ts`:

```typescript
// Models that get auto-injected organizationId and auto-filtered on reads
const orgScopedModels = new Set([
  // ... existing models ...
  // Maintenance module — Phase 1
  'MaintenanceTicket',
  'TicketActivity',
  'TechnicianProfile',
  // Maintenance module — Phase 2
  'Asset',
  'PmSchedule',
  'TicketLaborEntry',
  'TicketCostEntry',
  // Maintenance module — Phase 3
  'ComplianceRecord',
  'KnowledgeArticle',
])

// Models that use soft-delete (deletedAt stamps instead of hard delete)
const softDeleteModels = new Set([
  // ... existing models ...
  'MaintenanceTicket',   // Soft-delete tickets (never hard-delete work history)
  'Asset',               // Soft-delete assets (preserve history)
])
```

`TicketActivity`, `TechnicianProfile`, `TicketLaborEntry`, `TicketCostEntry` are **org-scoped but NOT soft-deleted** — they are child records of soft-deletable parents and do not need independent soft-delete behavior.

`ComplianceRecord` and `KnowledgeArticle` are org-scoped. Add soft-delete only to `KnowledgeArticle` (compliance records should be archived/closed, not deleted, per audit requirements).

---

## Compliance Calendar Architecture (Phase 3)

### Design: Config-Driven Compliance Domains

The compliance calendar is a **configuration table** that drives automatic deadline generation. Admins enable/disable domains per org, then the system populates the compliance calendar.

```
ComplianceDomainConfig (per org, per domain)
  ├── domain: AHERA | FIRE_SAFETY | PLAYGROUND | LEAD_WATER | BOILER | ...
  ├── isEnabled: boolean
  ├── lastInspectionDate: DateTime?
  └── nextDueDate: DateTime? (computed from domain's regulatory interval)

ComplianceRecord (one per inspection event)
  ├── domain: ComplianceDomain enum
  ├── scheduledDate: DateTime
  ├── completedDate: DateTime?
  ├── status: UPCOMING | IN_PROGRESS | PASSED | FAILED | OVERDUE
  ├── inspector: String?
  ├── findings: String?
  ├── documents: String[]        -- Supabase Storage URLs
  └── remediationTicketId: String?  -- auto-generated on FAILED
```

**Failed inspection flow:**
```
ComplianceRecord.status → FAILED
  → complianceService.onInspectionFailed(record)
      → ticketService.createMaintenanceTicket({
            title: `Compliance Remediation: ${domain} — ${finding}`,
            priority: 'HIGH',
            status: 'BACKLOG',
          })
      → complianceRecord.update({ remediationTicketId: newTicket.id })
      → email to Head of Maintenance + Admin
```

---

## Board Report and FCI Architecture (Phase 3)

### FCI Calculation

```
FCI = Σ(deferred maintenance costs) / Σ(current replacement value of all assets)
```

**Deferred maintenance** = sum of `TicketCostEntry.amountUSD` + `TicketLaborEntry.loadedCostUSD` for all DONE tickets in the reporting period.

**Replacement value** = sum of `Asset.replacementCostUSD` for all ACTIVE assets.

FCI is computed on-demand (not cached) because replacement values change as assets are added/updated. For board reports (monthly cadence), acceptable latency. Add database-level caching if query becomes slow.

### Report Generation Pattern

```typescript
// src/lib/services/maintenance/reportingService.ts

export async function generateBoardReport(orgId: string, period: ReportPeriod) {
  // All queries inside runWithOrgContext called by the route handler
  const [fci, pmCompliance, responseMetrics, topCostAssets, complianceStatus] =
    await Promise.all([
      calculateFCI(),
      calculatePmComplianceRate(period),
      calculateResponseMetrics(period),
      getTopCostAssets(period, 10),
      getComplianceSnapshot(),
    ])

  // AI narrative — Claude Sonnet, fire only on explicit request
  // Never block report generation on AI availability
  const narrative = await aiDiagnosticService.generateExecutiveSummary({
    fci, pmCompliance, responseMetrics,
  }).catch(() => null)  // graceful degradation

  return { fci, pmCompliance, responseMetrics, topCostAssets, complianceStatus, narrative }
}
```

---

## Offline PWA Architecture (Phase 3)

Phase 3 requires true offline capability. This is the most architecturally significant addition in the entire module and is the **only place where the existing Next.js App Router architecture needs extension**.

### Required additions:

| Addition | Why |
|---|---|
| Service Worker (via `next-pwa` or manual) | Cache-first strategy for ticket data |
| IndexedDB (via `idb` library) | Local mutation queue for offline creates/updates |
| Background Sync API | Flush IndexedDB queue when connection restores |
| Conflict resolution strategy | Server wins on status (most authoritative), client wins on comments/labor entries |

### PWA is Phase 3 only. Do not over-design for it in Phase 1 or 2.

The key architectural decision: **all Phase 1 and 2 API routes must be idempotent** so that retried requests from the offline queue do not create duplicate records. Use client-generated `idempotencyKey` (UUID) on create operations, stored in `MaintenanceTicket` as an optional unique field.

---

## AI Diagnostic Service Architecture

### Claude API Integration

```typescript
// src/lib/services/maintenance/aiDiagnosticService.ts
// Uses Anthropic API, NOT Gemini (per PROJECT.md decision)

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function analyzeTicketPhotos(
  ticketId: string,
  photos: string[],          // Supabase Storage URLs
  category: MaintenanceCategory,
  description: string
): Promise<AiAnalysis> {
  // Check cache first
  const existing = await prisma.maintenanceTicket.findUnique({
    where: { id: ticketId },
    select: { aiAnalysis: true },
  })
  if (existing?.aiAnalysis) return existing.aiAnalysis as AiAnalysis

  // Fetch image bytes from Supabase Storage for Vision API
  const imageContents = await Promise.all(
    photos.map(url => fetchImageAsBase64(url))
  )

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        ...imageContents.map(img => ({ type: 'image', source: { type: 'base64', ...img } })),
        {
          type: 'text',
          text: buildDiagnosticPrompt(category, description),
        },
      ],
    }],
  })

  const analysis = parseAnalysisResponse(response)

  // Cache result on ticket
  await prisma.maintenanceTicket.update({
    where: { id: ticketId },
    data: { aiAnalysis: analysis as any },
  })

  return analysis
}
```

**Important**: `ANTHROPIC_API_KEY` is a new environment variable. It is not the same as `GEMINI_API_KEY`. Add to both `.env` and `.env.local`.

---

## Kanban Board Data Layer

### Query Design

The Kanban board is a **read-heavy, multi-filter query** that needs to be fast. Design the query to avoid N+1:

```typescript
// src/lib/services/maintenance/boardService.ts

export async function getBoardData(params: BoardQueryParams): Promise<BoardData> {
  const where = buildBoardWhere(params)  // role-based, campus-based, status-based

  const tickets = await prisma.maintenanceTicket.findMany({
    where,
    include: {
      submittedBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      building: { select: { id: true, name: true } },
      room: { select: { id: true, roomNumber: true, displayName: true } },
      _count: { select: { photos: true, comments: true } },
    },
    orderBy: [
      { priority: 'desc' },    // URGENT first
      { createdAt: 'asc' },    // Oldest first within priority
    ],
  })

  // Group by status for board columns
  return groupByStatus(tickets)
}
```

### Board Column Grouping

```typescript
function groupByStatus(tickets: TicketWithIncludes[]): BoardData {
  const columns: Record<TicketStatus, TicketWithIncludes[]> = {
    BACKLOG: [], TODO: [], IN_PROGRESS: [], ON_HOLD: [],
    QA: [], DONE: [], SCHEDULED: [], CANCELLED: [],
  }
  for (const ticket of tickets) {
    columns[ticket.status].push(ticket)
  }
  // CANCELLED is typically hidden from board; DONE is limited to recent (7 days)
  return columns
}
```

### SLA Age Calculation

SLA age is computed **client-side** from `ticket.createdAt` to avoid database-level timestamp math on every render. The ticket card component calculates the age and applies red styling if past SLA threshold. SLA thresholds are a future configurable setting; hardcode `72h URGENT, 48h HIGH, 7d MEDIUM, 14d LOW` for Phase 1.

---

## Suggested Build Order

Build order is driven by three constraints:
1. Downstream components depend on upstream ones (no orphaned FK references)
2. Permissions must exist before routes use them
3. The notification/email side-effect infrastructure is shared and built once

### Phase 1 Build Sequence

```
1. Schema: Add MaintenanceTicket, TicketActivity, TechnicianProfile to schema.prisma
   Register new models in orgScopedModels / softDeleteModels in db/index.ts

2. Permissions: Add all maintenance:* permission strings to src/lib/permissions.ts
   Update DEFAULT_ROLES to seed maintenance permissions for relevant roles

3. Services (core): ticketService.ts — state machine + CRUD
   Services (side effects): maintenanceNotificationService.ts, maintenanceEmailService.ts

4. API routes: /tickets (CRUD), /tickets/[id]/status, /tickets/[id]/assign,
   /tickets/[id]/claim, /tickets/[id]/comments, /tickets/[id]/photos

5. Board API: boardService.ts + /api/maintenance/board route

6. AI service: aiDiagnosticService.ts + /api/maintenance/tickets/[id]/ai-analysis

7. Frontend: TicketSubmissionForm → KanbanBoard → TicketDetailDrawer → AiDiagnosticPanel

8. Module gate: Add 'maintenance' to TenantModule toggle in AddOnsTab
   Sidebar nav entry behind ModuleGate
```

### Phase 2 Build Sequence (depends on Phase 1 complete)

```
1. Schema: Asset, PmSchedule, TicketLaborEntry, TicketCostEntry
   Add assetId FK to MaintenanceTicket

2. Services: assetService.ts, pmEngine.ts, laborService.ts, analyticsService.ts

3. API routes: /assets, /pm-schedules, /tickets/[id]/labor, /tickets/[id]/costs,
   /assets/qr/[code], /analytics, /pm-schedules/run-due (cron endpoint)

4. Frontend: AssetRegister, PmCalendar, QR code generation/scanner, analytics dashboard
```

### Phase 3 Build Sequence (depends on Phase 2 complete)

```
1. Schema: ComplianceDomainConfig, ComplianceRecord, KnowledgeArticle
   Add idempotencyKey to MaintenanceTicket (for PWA offline queue)

2. Services: complianceService.ts, reportingService.ts, knowledgeService.ts
   PWA: service worker, IndexedDB queue, background sync

3. API routes: /compliance, /reports/board, /reports/fci, /knowledge

4. Frontend: ComplianceCalendar, BoardReport, FCI dashboard, KnowledgeBase
   next-pwa configuration
```

---

## Scalability Considerations

| Concern | At current scale (Linfield ~500 users) | At 100-org scale | At 1000-org scale |
|---|---|---|---|
| Board query | Single org, 50-200 tickets — fast | Add org index, already present | Paginate DONE column (7-day default) |
| AI analysis | Per-ticket cache prevents re-calls | Supabase Storage serves images — CDN | Rate limit Anthropic calls per org |
| PM engine | Single org sweep takes <100ms | Org-by-org loop — add batch size limit | Move to queued background job (BullMQ) |
| Photo storage | Supabase Storage — unlimited | Enforce 5-photo limit per ticket | Add per-org storage quota via TenantModule |
| FCI calculation | On-demand — fast with indexes | Cache in Redis or materialised view | Scheduled pre-computation job |
| Compliance calendar | 10 domains × ~40 deadlines/year per org | Efficient; ComplianceRecord is small | No change |

---

## Integration Points With Existing Platform

### Existing Ticket Model — Coexistence Strategy

The existing `Ticket` model (used by OperationsEngine for calendar event automation) and the new `MaintenanceTicket` model coexist without conflict. They serve different purposes:

- `Ticket`: auto-generated from calendar events, simple 3-status lifecycle, tracks facilities prep
- `MaintenanceTicket`: manually submitted or PM-generated, 8-status lifecycle, tracks repair work

**No migration or rename of the existing `Ticket` model is needed.**

The global search endpoint at `/api/search` currently searches `Ticket`. It should be extended in Phase 1 to also search `MaintenanceTicket` — a one-line addition to the parallel search in `searchRoute.ts`.

### Campus Hierarchy — Direct FK References

`MaintenanceTicket` references `buildingId`, `areaId`, `roomId` directly as optional FKs to existing `Building`, `Area`, `Room` models. The `InteractiveCampusMap` component's room photos are already stored on `Room.images` — these can be surfaced in ticket submission without any new data work.

### Notification Bell — No Changes Required

The existing notification bell polls `/api/notifications/unread-count` every 30 seconds and supports any notification `type` string. Maintenance notifications just use new type strings: `'maintenance_ticket_submitted'`, `'maintenance_status_changed'`, etc. The `Notification.type` column is a plain string — no schema change needed.

### Module Toggle — One Addition Required

```typescript
// src/components/settings/AddOnsTab.tsx
// Add to the module registry array:

{ id: 'maintenance', name: 'Maintenance & Facilities', description: '...' }
```

The `TenantModule` model and toggle API already handle this. No other changes to the add-ons system.

---

## Sources

- Direct codebase inspection: `src/lib/db/index.ts`, `src/lib/org-context.ts`, `src/lib/services/ticketService.ts`, `src/lib/permissions.ts`, `src/lib/services/notificationService.ts`, `src/lib/services/athleticsService.ts`, `prisma/schema.prisma`
- `.planning/PROJECT.md` — requirements, constraints, key decisions
- `.planning/maintenance-spec-v1.1.md` — full feature specification
- `CLAUDE.md` — platform conventions (confirmed: rawPrisma for transactions, org-scoped prisma for routes, fire-and-forget notifications)
- Established CMMS state machine patterns (HIGH confidence — industry standard for work order systems)
