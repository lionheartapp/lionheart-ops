# Architecture Research — Event Planning Integration (v3.0)

**Domain:** Comprehensive event planning system added to existing K-12 SaaS platform
**Researched:** 2026-03-14
**Confidence:** HIGH (based on direct codebase inspection, verified against current docs)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PUBLIC TIER (no auth)                                  │
│  ┌──────────────────────┐  ┌───────────────────┐  ┌───────────────────────┐ │
│  │ /events/[slug]/public│  │ /api/public/events │  │ /api/webhooks/stripe  │ │
│  │   School-branded     │  │ rate-limited, CAPTCHA│ │ Stripe signature verify│ │
│  └────────┬─────────────┘  └────────┬──────────┘  └────────────┬──────────┘ │
└───────────┼────────────────────────┼──────────────────────────┼────────────┘
            │                        │                          │
┌───────────┼────────────────────────┼──────────────────────────┼────────────┐
│                AUTHENTICATED APP TIER (JWT + org-scoped)                    │
│  ┌─────────────────────┐  ┌────────────────────┐  ┌──────────────────────┐ │
│  │  /events (primary   │  │ /events/[id]/project│  │ SSE endpoint         │ │
│  │   nav, list/create) │  │  Hub: 8 section tabs│  │ /api/events/[id]/sse │ │
│  └──────────┬──────────┘  └─────────┬──────────┘  └──────────────────────┘ │
│             │                        │                                        │
│  ┌──────────┴──────────────────────┐ │                                        │
│  │       EVENT PROJECT API LAYER   │ │                                        │
│  │  /api/event-projects/*          │◄┘                                        │
│  │  /api/event-registrations/*                                                │
│  │  /api/event-forms/*                                                        │
│  │  /api/event-groups/*                                                       │
│  │  /api/event-budget/*                                                       │
│  │  /api/event-documents/*                                                    │
│  │  /api/event-comms/*                                                        │
│  └──────────┬──────────────────────┘                                          │
└─────────────┼──────────────────────────────────────────────────────────────┘
              │
┌─────────────┼──────────────────────────────────────────────────────────────┐
│                       SERVICE + DATA TIER                                    │
│  ┌───────────────────┐  ┌──────────────────┐  ┌────────────────────────┐   │
│  │ eventProjectService│  │ stripeService.ts │  │ notificationOrch.ts    │   │
│  │ registrationService│  │ (event payments) │  │ (scheduled + triggers) │   │
│  │ formBuilderService │  └──────────────────┘  └────────────────────────┘   │
│  └─────────┬─────────┘                                                       │
│            │                                                                  │
│  ┌─────────┴──────────────────────────────────────────────────────────────┐  │
│  │                  org-scoped Prisma + PostgreSQL                          │  │
│  │  EventProject | EventRegistration | EventForm | EventGroup              │  │
│  │  EventDocument | EventBudgetLine | EventCommunication | EventIncident   │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     OFFLINE / SYNC TIER (extended)                           │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  Dexie (IndexedDB) extended:                                          │   │
│  │  offlineEvents | offlineRosters | offlineIncidents | mutationQueue    │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────┐  ┌───────────────────────────────────────────────┐   │
│  │  sw.js (enhanced)  │  │ Service Worker: QR scan + incident log cache  │   │
│  └────────────────────┘  └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation Location |
|-----------|---------------|------------------------|
| EventProject hub model | Central entity connecting all event data | `prisma/schema.prisma` (new model) |
| Event Project page | 8-section tabbed workspace for staff | `src/app/events/[id]/page.tsx` |
| Public event page | Branding + registration for parents (no auth) | `src/app/events/[slug]/public/page.tsx` |
| Form builder service | Dynamic JSON schema forms with multi-page | `src/lib/services/formBuilderService.ts` |
| Registration service | Registrant state machine, payment tracking | `src/lib/services/registrationService.ts` |
| Stripe event payments | PCI-compliant payment processing | `src/lib/services/stripeEventService.ts` |
| QR pipeline | Generate per-registration codes, scan check-in | `src/lib/services/qrService.ts` |
| Notification orchestrator | Scheduled + condition-based communication | `src/lib/services/notificationOrchestrator.ts` |
| PDF generation | Server-side printable manifests, rosters, etc. | `src/lib/services/pdfService.ts` |
| SSE endpoint | Real-time project updates / presence | `src/app/api/event-projects/[id]/sse/route.ts` |
| Offline event layer | Extend Dexie DB for day-of operations | `src/lib/offline/db.ts` (extended) |
| Nav reorientation | Events as primary item in Sidebar.tsx | `src/components/Sidebar.tsx` (modified) |
| Calendar bridge | CalendarEvent.sourceId → EventProject.id | CalendarEvent.sourceModule = 'event-project' |

---

## Integration Map: New vs Modified

### Existing Components That Must Be Modified

| Component | Required Change | Why |
|-----------|----------------|-----|
| `src/components/Sidebar.tsx` | Add Events as top-level nav item; nest Calendar + Planning under it | Navigation reorientation — Events become primary product |
| `src/middleware.ts` | Add `/api/public/events/*` and `/events/*/public` to public path list; add Stripe webhook path | Public-facing pages and payments bypass auth |
| `src/lib/db/index.ts` | Add 15+ new EventProject models to `orgScopedModels` and `softDeleteModels` sets | All new models must auto-inject organizationId |
| `src/lib/permissions.ts` | Add new permission strings: `events:project:read`, `events:register:manage`, `events:budget:manage`, `events:comms:send` | Granular permissions for the new event workspace |
| `src/lib/offline/db.ts` | Add new Dexie tables: `offlineEventRosters`, `offlineQRScans`, `offlineIncidents` | Day-of offline operations for event staff |
| `public/sw.js` | Extend cached routes to include event roster and check-in endpoints | QR scanning works offline |
| `src/app/api/webhooks/` | Add `stripe-events/` sub-directory for payment webhooks distinct from platform Stripe webhooks | Event payment webhooks are different from platform subscription webhooks |
| `src/lib/services/calendarService.ts` | Add EventProject-to-CalendarEvent bridge: when an EventProject is published, auto-create/link a CalendarEvent | CalendarEvent.sourceModule = 'event-project', CalendarEvent.sourceId = eventProject.id |
| `src/lib/services/ai/gemini.service.ts` | Extend with event creation assistance, form generation, group assignment, conflict detection | All new AI features use existing Gemini client |
| `src/app/api/cron/` | Add `event-notifications/` cron for scheduled communication delivery | Notification orchestration requires scheduled jobs |

### New Components Required

| Component | Path | Notes |
|-----------|------|-------|
| EventProject models | `prisma/schema.prisma` | 15+ new models (see Data Model section) |
| Event project API routes | `src/app/api/event-projects/` | Full CRUD + sub-resources |
| Registration API routes | `src/app/api/event-registrations/` | Public + authenticated variants |
| Form builder API | `src/app/api/event-forms/` | Schema CRUD + submission handling |
| Group management API | `src/app/api/event-groups/` | Bus/cabin/activity group assignment |
| Budget API | `src/app/api/event-budget/` | Line items + per-participant analysis |
| Documents API | `src/app/api/event-documents/` | Document tracking + signature capture |
| Communications API | `src/app/api/event-comms/` | Audience targeting + delivery |
| QR API | `src/app/api/event-qr/` | Generate + scan endpoints |
| Public events API | `src/app/api/public/events/` | No-auth registration + branding |
| Stripe events webhook | `src/app/api/webhooks/stripe-events/route.ts` | Separate from platform Stripe webhook |
| SSE endpoint | `src/app/api/event-projects/[id]/sse/route.ts` | ReadableStream, no WebSocket needed |
| External integrations API | `src/app/api/integrations/` | Planning Center, Google Calendar, Twilio |
| Events pages | `src/app/events/` | List, detail (project hub), public page |
| Event project page | `src/app/events/[id]/page.tsx` + sections/ | 8-tab workspace component tree |
| Public event page | `src/app/events/[slug]/public/page.tsx` | School-branded, no auth, mobile-first |
| Form builder components | `src/components/events/forms/` | Multi-page form UI |
| Group drag-and-drop UI | `src/components/events/groups/` | dnd-kit for bus/cabin assignment |
| PDF service | `src/lib/services/pdfService.ts` | @react-pdf/renderer server-side |
| QR service | `src/lib/services/qrService.ts` | qrcode library for generation |
| Registration service | `src/lib/services/registrationService.ts` | State machine: pending→paid→checked-in |
| Notification orchestrator | `src/lib/services/notificationOrchestrator.ts` | Timeline + condition evaluation |
| Form builder service | `src/lib/services/formBuilderService.ts` | JSON schema + validation |
| Stripe event service | `src/lib/services/stripeEventService.ts` | Payment intent creation, refunds |
| Integration services | `src/lib/services/integrations/` | Planning Center, GCal, Twilio adapters |
| Magic link auth | `src/lib/auth/magic-link.ts` | Code-based parent access (no account) |
| Event offline layer | Extend `src/lib/offline/db.ts` | New Dexie tables for event day-of |
| Event notification preferences | Extend existing notification prefs | Per-event opt-in/out for parents |

---

## Recommended Project Structure (New Files Only)

```
src/
  app/
    events/
      page.tsx                    # Events list / primary nav landing
      layout.tsx                  # Events section layout
      new/
        page.tsx                  # Create EventProject (3 entry paths)
      [id]/
        page.tsx                  # EventProject hub (8-tab workspace)
        sections/
          OverviewSection.tsx
          ScheduleSection.tsx
          PeopleSection.tsx
          DocumentsSection.tsx
          LogisticsSection.tsx
          BudgetSection.tsx
          TasksSection.tsx
          CommsSection.tsx
      [slug]/
        public/
          page.tsx                # Public-facing registration page (no auth)
          register/
            page.tsx              # Multi-page form flow
          confirm/
            [token]/
              page.tsx            # Post-registration confirmation
    api/
      event-projects/
        route.ts                  # GET (list) / POST (create)
        [id]/
          route.ts                # GET / PATCH / DELETE
          sse/
            route.ts              # SSE: ReadableStream for real-time updates
          publish/
            route.ts              # POST: publish → creates CalendarEvent bridge
          template/
            route.ts              # POST: save as template / create from template
      event-registrations/
        route.ts                  # POST (create, public + authenticated)
        [id]/
          route.ts                # GET / PATCH (status update, cancel)
          check-in/
            route.ts              # POST: QR scan check-in
      event-forms/
        route.ts                  # POST (create form schema)
        [id]/
          route.ts                # GET / PATCH / DELETE
          submit/
            route.ts              # POST (public, with CAPTCHA validation)
      event-groups/
        route.ts                  # GET (list for event) / POST (create group)
        [id]/
          route.ts                # PATCH / DELETE
          assignments/
            route.ts              # POST bulk assign / DELETE remove
      event-budget/
        [eventId]/
          route.ts                # GET summary / POST line item
          lines/
            [lineId]/
              route.ts            # PATCH / DELETE
      event-documents/
        route.ts                  # GET / POST
        [id]/
          route.ts                # PATCH / DELETE
          sign/
            route.ts              # POST: capture signature
      event-comms/
        route.ts                  # GET / POST (create communication)
        [id]/
          send/
            route.ts              # POST: send now or schedule
      event-qr/
        generate/
          route.ts                # POST: generate QR code for registration
        scan/
          route.ts                # POST: process QR scan (check-in / headcount)
      public/
        events/
          [slug]/
            route.ts              # GET: branding + event details (no auth)
            register/
              route.ts            # POST: submit registration (no auth)
      webhooks/
        stripe-events/
          route.ts                # POST: Stripe payment events (raw body required)
      integrations/
        planning-center/
          route.ts                # GET connection status / POST sync
          webhook/
            route.ts              # POST: PCO webhooks
        google-calendar/
          route.ts                # GET / POST sync
        twilio/
          route.ts                # POST: SMS delivery status callback
      cron/
        event-notifications/
          route.ts                # POST: process scheduled communications
  components/
    events/
      EventProjectCard.tsx        # Card for events list
      EventProjectHeader.tsx      # Hub page header (title, status, actions)
      EventStatusBadge.tsx        # Status pill
      forms/
        FormBuilder.tsx           # Drag-drop form field builder (staff)
        FormRenderer.tsx          # Public-facing form display
        FormPageNavigator.tsx     # Multi-page progress indicator
        FieldTypes/               # Input, Select, Signature, Photo, Payment
      groups/
        GroupBoard.tsx            # Drag-drop assignment board (dnd-kit)
        GroupCard.tsx             # Bus/cabin/activity group card
        AssigneeChip.tsx          # Participant chip for drag
      budget/
        BudgetSummaryCard.tsx     # Revenue vs. expense overview
        BudgetLineTable.tsx       # Line-item table with edit
      documents/
        DocumentTracker.tsx       # Per-participant completion grid
        SignatureCapture.tsx      # Mobile finger / desktop typed
      comms/
        CommsTimeline.tsx         # Chronological communication schedule
        AudienceSelector.tsx      # Target: all, registered, groups
      qr/
        QRCodeDisplay.tsx         # Show QR for printing / sharing
        QRScanner.tsx             # Camera-based check-in scanner (PWA)
      ai/
        SmartEventCreator.tsx     # Natural language → EventProject
        FormGeneratorModal.tsx    # AI-generated form from event type
      public/
        PublicEventPage.tsx       # School-branded event landing
        RegistrationFlow.tsx      # Multi-step registration wizard
        ParticipantDashboard.tsx  # Post-registration participant view
  lib/
    services/
      eventProjectService.ts      # EventProject CRUD + state management
      registrationService.ts      # Registration state machine
      formBuilderService.ts       # JSON schema validation + rendering
      stripeEventService.ts       # Payment intent, refund, payout logic
      qrService.ts                # qrcode library wrapper
      pdfService.ts               # @react-pdf/renderer server-side rendering
      notificationOrchestrator.ts # Timeline + condition trigger evaluation
      integrations/
        planningCenterService.ts  # PCO API client (OAuth + webhooks)
        googleCalendarSyncService.ts # GCal two-way sync
        twilioService.ts          # SMS via Twilio REST API
    auth/
      magic-link.ts               # Code-based magic link for parents
    offline/
      eventSync.ts                # Event-specific offline cache + sync logic
```

---

## Architectural Patterns

### Pattern 1: EventProject as Hub Model

**What:** A single `EventProject` record acts as the central entity connecting all event-related records. Related models (forms, registrations, groups, budget lines, documents, communications, incidents) all carry an `eventProjectId` foreign key. The `EventProject` itself holds status, metadata, and counts denormalized for performance.

**When to use:** Always. Every event planning action routes through the EventProject. The existing `CalendarEvent` and legacy `Event` models do NOT get extended — they remain separate and are linked via `CalendarEvent.sourceModule = 'event-project'` and `CalendarEvent.sourceId = eventProject.id`.

**Trade-offs:** Slightly more migration work upfront, but avoids the "one model bloated to 60 fields" anti-pattern that would make the existing CalendarEvent unusable. Clean separation means the calendar still works independently.

**Example:**
```typescript
// Bridge creation: when EventProject is published, auto-create linked CalendarEvent
async function publishEventProject(id: string, userId: string) {
  const project = await prisma.eventProject.update({
    where: { id },
    data: { status: 'PUBLISHED' }
  })
  // Create CalendarEvent bridge — links project to calendar display
  await prisma.calendarEvent.create({
    data: {
      calendarId: project.defaultCalendarId,
      title: project.title,
      startTime: project.startDate,
      endTime: project.endDate,
      sourceModule: 'event-project',
      sourceId: project.id,
      calendarStatus: 'CONFIRMED',
    }
  })
  return project
}
```

### Pattern 2: Public Routes with Org-Context via Slug

**What:** Public-facing pages (no JWT) resolve the org from the URL slug rather than the `x-org-id` header. `getOrgIdFromSlug(slug)` is called first, then `runWithOrgContext(orgId, ...)` wraps the handler — the same scoping mechanism, different resolution path.

**When to use:** All `/api/public/events/*` routes and the `app/events/[slug]/public/` pages. Rate limiting + CAPTCHA must wrap these endpoints (middleware or route-level).

**Trade-offs:** Requires that every public endpoint can resolve orgId without JWT. Magic links for returning parents store a signed token with both userId and orgId to bypass this lookup.

**Example:**
```typescript
// Public route: no assertCan(), but still org-scoped
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const org = await rawPrisma.organization.findUnique({ where: { slug: params.slug } })
  if (!org) return NextResponse.json(fail('NOT_FOUND', 'Event not found'), { status: 404 })

  return await runWithOrgContext(org.id, async () => {
    const event = await prisma.eventProject.findFirst({
      where: { publicSlug: params.slug, status: 'PUBLISHED' }
    })
    return NextResponse.json(ok(event))
  })
}
```

### Pattern 3: Form Builder as JSON Schema

**What:** EventForm records store their field definitions as JSON (following a `FormSchema` TypeScript type). The form builder UI writes this JSON; the public form renderer reads and renders it. Submissions are stored as JSON blobs in `EventFormSubmission`. No separate field tables — the schema lives in a single JSONB column.

**When to use:** All registration forms and custom forms attached to EventProjects.

**Trade-offs:** Simpler schema, but requires careful Zod validation of the JSON schema on both write (builder) and read (renderer). Cannot do relational queries on field values. Acceptable because form submissions are accessed by eventProjectId, not by individual field values.

**Example schema shape:**
```typescript
interface FormSchema {
  pages: FormPage[]
  settings: { allowPartialSave: boolean; requirePayment: boolean }
}
interface FormPage {
  id: string
  title: string
  fields: FormField[]
}
interface FormField {
  id: string
  type: 'text' | 'select' | 'checkbox' | 'signature' | 'photo' | 'payment'
  label: string
  required: boolean
  options?: string[]  // for select
  paymentAmount?: number  // for payment field (cents)
}
```

### Pattern 4: SSE for Real-Time (Not WebSocket)

**What:** Use Server-Sent Events via Next.js Route Handlers returning a `ReadableStream` with `Content-Type: text/event-stream`. No WebSocket upgrade, no separate WebSocket server. Client uses `EventSource` with reconnect.

**When to use:** Event project page presence indicators and live update feeds. SSE is sufficient because updates are server→client only. The client sends mutations via normal API calls; SSE broadcasts the results back.

**Trade-offs:** Unidirectional only (server→client). Works seamlessly on Vercel. Requires streaming-compatible deployment (Vercel Edge or Node.js runtime with `export const runtime = 'nodejs'`). Background Sync in Safari is unavailable — fall back to polling every 30s for Safari users.

**Example:**
```typescript
// Route: /api/event-projects/[id]/sse/route.ts
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
      }, 25000)
      // Subscribe to in-process event bus (Redis Pub/Sub in production)
      const unsub = eventBus.subscribe(params.id, (payload) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      })
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        unsub()
        controller.close()
      })
    }
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  })
}
```

### Pattern 5: Stripe Event Payments (Separate from Platform Billing)

**What:** Event registration payments use `Stripe Elements` on the client (card data never touches Lionheart servers). The server creates a `PaymentIntent` via a dedicated `stripeEventService.ts`. A separate webhook route at `/api/webhooks/stripe-events/` handles payment confirmation and updates `EventRegistration.paymentStatus`. This is entirely separate from the existing platform subscription billing (`/api/platform/webhooks/stripe`).

**When to use:** Any EventProject that has a payment-type form field. Payment collection is optional per event.

**Critical:** Webhook handler must use `req.text()` (not `req.json()`) to get the raw body for Stripe signature verification. The webhook signing secret for event payments is stored separately from the platform billing secret.

**Trade-offs:** Two Stripe webhook secrets to manage. The separation is intentional — mixing event revenue and platform subscriptions creates accounting and permission complexity.

### Pattern 6: Offline Layer Extension (Dexie)

**What:** Extend the existing `lionheart-offline-v1` Dexie database (used for maintenance tickets) with a new schema version that adds event-specific object stores. The existing `OfflineDatabase` class in `src/lib/offline/db.ts` is extended to version 2.

**When to use:** Day-of operations: QR check-in scanning, headcounts, incident logging. Staff need these to work without connectivity in gymnasiums and remote camp locations.

**Trade-offs:** Safari Background Sync is not supported. The fallback is a manual "sync when online" button. Conflict resolution strategy: server wins for roster data; client wins for incidents created offline (merge, not overwrite).

**Example:**
```typescript
// Extend existing Dexie class with event tables
class OfflineDatabase extends Dexie {
  // ... existing tables ...
  offlineEventRosters!: Table<OfflineEventRoster>    // new v2
  offlineQRScans!: Table<OfflineQRScan>              // new v2
  offlineIncidents!: Table<OfflineIncident>          // new v2

  constructor() {
    super('lionheart-offline-v1')
    this.version(1).stores({ /* existing */ })
    this.version(2).stores({
      offlineEventRosters: '++id, eventProjectId, cachedAt',
      offlineQRScans: '++id, eventProjectId, qrToken, status, scannedAt',
      offlineIncidents: '++id, eventProjectId, status, createdAt',
    })
  }
}
```

---

## Data Flow

### Staff Event Creation Flow

```
Staff clicks "New Event"
  → SmartEventCreator (AI NLP) OR manual form with 3 entry paths
  → POST /api/event-projects (creates EventProject, status=DRAFT)
  → Event project page loads with 8 empty section tabs
  → Staff fills sections: schedule, people, forms, groups, budget, docs, comms
  → POST /api/event-projects/[id]/publish
      → Creates CalendarEvent bridge (sourceModule='event-project', sourceId=id)
      → Updates PlanningSeason submission status if from planning season
      → Triggers notification orchestrator for communication timeline
  → CalendarView auto-shows event (reads CalendarEvents, sourceModule filter)
```

### Public Registration Flow

```
Parent receives link / scans QR
  → GET /api/public/events/[slug] (rate-limited, no auth, org resolved via slug)
  → Public event page renders (school branding, event details)
  → Parent fills multi-page registration form (FormRenderer)
  → POST /api/public/events/[slug]/register
      → Rate limiter + CAPTCHA validation
      → Stripe PaymentIntent created (if payment required)
      → EventRegistration created (status=PENDING_PAYMENT or CONFIRMED)
      → Confirmation email sent (Resend) with QR code PNG
  → Stripe Elements confirm payment client-side → /api/webhooks/stripe-events/
      → EventRegistration.paymentStatus → PAID
      → Registration QR code email delivered
```

### Day-Of Check-In Flow

```
Staff opens PWA (cached offline)
  → Event roster cached to IndexedDB (offlineEventRosters)
  → QRScanner component opens camera
  → Parent presents QR code (PNG in email / wristband)
  → POST /api/event-qr/scan (online) OR enqueue to offlineQRScans (offline)
      → EventRegistration status → CHECKED_IN, checkedInAt stamped
      → If offline: added to offlineQRScans with status=pending
      → Background: replayed on reconnect via sync.ts pattern
  → Real-time headcount updates via SSE to all staff on event page
```

### Calendar Bridge Data Flow

```
CalendarView reads CalendarEvent records
  → Existing: all events with calendarId in subscribed calendars
  → New bridge: CalendarEvents with sourceModule='event-project'
  → EventProject data (registration count, budget status) visible
    via CalendarEvent.metadata JSON field (denormalized summary)
  → Click EventProject CalendarEvent → deep link to /events/[id]
    (not the old event detail panel)
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-50 schools | Single Supabase instance, SSE on Vercel Node.js runtime, no Redis needed — in-process event bus for SSE via Map |
| 50-500 schools | Add Redis (Upstash) for SSE Pub/Sub so multiple Vercel instances share the same event stream; index EventProject by status + campusId |
| 500+ schools | Supabase connection pooler (PgBouncer) already in use via DATABASE_URL; consider read replicas for registration count queries during high-traffic events |

### First Bottleneck

Registration surges: when a large event (500+ expected) opens registration, concurrent form submissions overwhelm a single PostgreSQL write path. Mitigation: queue registrations via a lightweight pending table; background worker confirms them. This is not needed at current Linfield scale but should be noted for the architecture.

### Second Bottleneck

PDF generation: server-side @react-pdf/renderer is CPU-intensive for large manifests (200+ participants). Mitigation: generate PDFs on demand and cache in Supabase Storage with a TTL; invalidate when roster changes.

---

## Anti-Patterns

### Anti-Pattern 1: Extending CalendarEvent for Event Planning Data

**What people do:** Add `registrationFormId`, `groupIds`, `budgetTotal` fields to the existing `CalendarEvent` model to avoid creating a new model.

**Why it's wrong:** CalendarEvent already has 25+ fields and handles RRULE recurrence, attendees, approval workflows, and Google Calendar sync. Adding registration and planning data turns it into a god model with conflicting concerns. The existing codebase explicitly decided: "EventProject as hub model (not extending CalendarEvent) — events need fundamentally different data."

**Do this instead:** Create the `EventProject` model and link it back to `CalendarEvent` via `sourceModule`/`sourceId`. The CalendarEvent becomes a read-only calendar entry; all mutable event planning state lives in EventProject.

### Anti-Pattern 2: Putting Public Route Logic Inside Authenticated Route Handlers

**What people do:** Add `if (!token) return publicFallback()` branching inside existing authenticated API route handlers.

**Why it's wrong:** Authenticated routes carry `runWithOrgContext` driven by the JWT-injected `x-org-id` header. Public routes must resolve orgId via URL slug, which requires different middleware handling and rate limiting. Mixing the two creates security surface — a forgotten `assertCan` check in a branch means unauthenticated access to scoped data.

**Do this instead:** Create entirely separate routes under `/api/public/events/`. These routes call `rawPrisma.organization.findUnique({ where: { slug } })` first, then `runWithOrgContext`. Never share a handler function between authenticated and public callers.

### Anti-Pattern 3: Using rawPrisma Inside Event Planning Route Handlers

**What people do:** Use `rawPrisma.eventProject.findMany()` inside route handlers because it "seems simpler."

**Why it's wrong:** All 15+ new EventProject-related models must be in `orgScopedModels` in `src/lib/db/index.ts`. Using rawPrisma bypasses organizationId injection silently, allowing cross-tenant data leakage. This is the most dangerous footgun in the codebase per the existing CLAUDE.md.

**Do this instead:** Add every new model to `orgScopedModels` before writing a single route. `rawPrisma` is only for public routes that resolve orgId via slug before calling `runWithOrgContext`.

### Anti-Pattern 4: Storing Raw Card Data or Processing Payments Server-Side

**What people do:** Attempt to pass card numbers through the Lionheart server to avoid Stripe Elements complexity.

**Why it's wrong:** Immediate PCI DSS scope expansion requiring SAQ D compliance, security audits, and quarterly penetration testing. The PROJECT.md constraint is explicit: "Stripe Elements only — never store or transmit raw card numbers."

**Do this instead:** Stripe Elements on the client creates the PaymentIntent client-side. The server only creates a `paymentIntentClientSecret` and receives confirmation webhooks. Card data never touches Lionheart servers.

### Anti-Pattern 5: Single Stripe Webhook for Both Platform Billing and Event Payments

**What people do:** Add `case 'payment_intent.succeeded':` handlers to the existing `/api/platform/webhooks/stripe` route.

**Why it's wrong:** Platform billing webhooks carry `Subscription` and `Invoice` objects for platform SaaS billing. Event payment webhooks carry `PaymentIntent` objects tied to `EventRegistration`. Conflating them means shared error handling, ambiguous objects, and inability to use separate Stripe signing secrets.

**Do this instead:** Create `/api/webhooks/stripe-events/route.ts` with its own `STRIPE_EVENTS_WEBHOOK_SECRET` env variable. Add this path to `isPublicPath()` in middleware.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Stripe Events | Stripe Elements (client) + PaymentIntent API (server) + webhook | `STRIPE_EVENTS_SECRET_KEY` and `STRIPE_EVENTS_WEBHOOK_SECRET` are separate from platform Stripe keys |
| Planning Center | REST API client with OAuth 2.0 + inbound webhooks (HMAC-SHA256 `x-pco-signature`) | PCO supports People, Services, Check-Ins modules; retry up to 16x with exponential backoff |
| Google Calendar | Existing `CalendarFeedConnection` model and sync infrastructure already present; extend for EventProject published events | Use existing `EventSyncMapping` table |
| Twilio SMS | REST API for outbound SMS; inbound delivery status webhooks | Used for notification orchestrator SMS channel; store `twilioMessageSid` on EventCommunication |
| Resend (existing) | Already integrated for welcome emails; extend for event confirmation emails with QR code PNG inline | QR code as base64 PNG in email |
| Supabase Storage | Already used for photos; extend for PDF storage (bus manifests, rosters) | Store generated PDFs under `/event-pdfs/[orgId]/[eventId]/` prefix |
| Google Gemini (existing) | Already integrated; extend with event AI features: NLP creation, form generation, conflict detection, group AI assignment | All use existing `gemini.service.ts` client |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| EventProject → CalendarEvent | One-way bridge via `sourceModule`/`sourceId` | EventProject publish creates CalendarEvent; CalendarEvent deletion does NOT delete EventProject |
| EventProject → PlanningSeason | PlanningSubmission.eventProjectId (new FK) | When a PlanningSubmission is approved and published, it links to the EventProject it created |
| EventProject → Notification | Extend existing Notification model with `eventProjectId` | Participant notifications route through existing notification system |
| EventProject → AuditLog | AuditLog entries with `resourceType='EventProject'` | Reuse existing audit logging infrastructure |
| Public Pages → Branding | `/api/branding` already public (in middleware) | Public event pages fetch org branding from this existing endpoint |
| Offline layer → EventProject API | Same mutation queue pattern as maintenance tickets | `MutationQueueEntry.type` extended with event-specific mutation types |
| Notification Orchestrator → Email/SMS | Delegates to `emailService.ts` (Resend) and `twilioService.ts` | Orchestrator evaluates timing + conditions; services handle delivery |

---

## Suggested Build Order

Based on dependency analysis, the correct build order is:

1. **Data models first** — Add all 15+ Prisma models to `schema.prisma`, update `orgScopedModels` and `softDeleteModels` in `db/index.ts`, add permissions to `permissions.ts`. Everything downstream depends on this.

2. **EventProject CRUD + event project page (empty sections)** — Get the hub model working with create, read, update, delete, and the 8-tab workspace rendering empty states. Navigation reorientation (Sidebar.tsx) happens here.

3. **Calendar bridge** — Connect EventProject publish action to CalendarEvent creation. Existing CalendarView starts showing event projects. Validate that existing calendar functionality is unbroken.

4. **Form builder + public pages** — Multi-page form builder (staff) and public registration page (parents). This is the first public-facing page. Requires magic link auth, rate limiting additions to middleware.

5. **Registrations + payments** — EventRegistration model, Stripe Elements integration, Stripe webhook. Requires form builder to exist (a form is required before registration can happen).

6. **QR codes + day-of tools** — QR generation (confirmation emails), QR scanning (check-in), offline Dexie extension, PWA service worker update. Requires registrations to exist.

7. **Groups, documents, budget, communications** — The remaining EventProject sections. These are parallel and independent once the EventProject hub exists.

8. **Notification orchestrator** — Scheduled + condition-based communication delivery. Depends on communications API existing and cron infrastructure.

9. **AI features** — Smart event creation, form generation, conflict detection. Depends on all data models existing (AI features call into existing services).

10. **External integrations** — Planning Center, Google Calendar sync extension, Twilio. These are additive and can be deferred without blocking core functionality.

11. **PDF generation** — Printable manifests and rosters. Depends on groups and registrations existing. Server-side @react-pdf/renderer; deferred from critical path.

---

## Sources

- Direct codebase inspection: `prisma/schema.prisma`, `src/lib/db/index.ts`, `src/middleware.ts`, `src/lib/offline/db.ts`, `src/components/Sidebar.tsx` (confidence: HIGH)
- [Real-Time Updates with SSE in Next.js 15](https://damianhodgkiss.com/tutorials/real-time-updates-sse-nextjs) (confidence: HIGH — aligns with Next.js 15 ReadableStream pattern)
- [Stripe + Next.js 15: The Complete 2025 Guide](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/) — `req.text()` for webhook raw body (confidence: HIGH)
- [Offline-first frontend apps in 2025: IndexedDB and SQLite](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) — Dexie + Background Sync patterns (confidence: HIGH)
- [Planning Center API Documentation](https://developer.planning.center/docs/) — HMAC-SHA256 `x-pco-signature` verification, 16-retry backoff (confidence: HIGH)
- [7 Best QR Code Libraries for Developers in 2025](https://qrcode.fun/blog/best-qr-code-libraries-2025) — `qrcode` package for server-side SVG/PNG generation (confidence: MEDIUM)
- PROJECT.md constraints: EventProject as hub, Stripe Elements PCI, PWA offline, magic link for parents (confidence: HIGH — authoritative project spec)

---

*Architecture research for: Lionheart v3.0 Event Planning Integration*
*Researched: 2026-03-14*
