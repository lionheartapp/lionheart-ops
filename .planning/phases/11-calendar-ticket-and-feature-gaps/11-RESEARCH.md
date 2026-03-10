# Phase 11: Calendar, Ticket, and Feature Gaps - Research

**Researched:** 2026-03-10
**Domain:** Next.js 15 App Router API routes, Prisma v5 ORM, Supabase Storage, React 18 UI patterns
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAL-01 | Admin can GET, PUT, and DELETE individual draft events via `/api/draft-events/[id]` | Service functions exist (getDraftEventById, updateDraftEvent, deleteDraftEvent) but the `[id]` route file is missing entirely — only a collection route exists |
| CAL-02 | System prevents booking two events for the same room at the same time (conflict detection) | Event model uses free-text `room` string — conflict detection requires a Prisma `findFirst` overlap query before save; no structured Room FK on Event or DraftEvent |
| TIX-01 | Dashboard ticket drawer edit button navigates to ticket edit view | Dead `console.log('Edit clicked')` in dashboard page.tsx line 473 — needs router.push to ticket edit route |
| TIX-02 | Generic tickets support comments and file attachments | No TicketComment or TicketAttachment models exist in schema; storage pattern via Supabase already proven in branding/campus image uploads |
| TIX-03 | Users can search tickets by keyword across title and description | ListTicketsSchema has no `search` field; Prisma `contains` + `mode: 'insensitive'` pattern is established in maintenanceAssetService and itDeviceService |
</phase_requirements>

---

## Summary

Phase 11 closes five discrete gaps across two modules. Three are API/schema gaps; two are UI gaps. None require new infrastructure — all leverage patterns already in production in this codebase.

**CAL-01** is the simplest: the `draftEventService.ts` already implements `getDraftEventById`, `updateDraftEvent`, and `deleteDraftEvent` with full permission logic, but there is no `src/app/api/draft-events/[id]/route.ts` file exposing them. The task is creating that file following the exact pattern of `src/app/api/inventory/[id]/route.ts`.

**CAL-02** requires a conflict detection check before any event or draft event is saved with a room value. The `Event` and `DraftEvent` models both store `room` as a free-text `String?` — there is no structured `roomId` FK. Conflict detection must use a `prisma.event.findFirst({ where: { room: validated.room, NOT: { id }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } })` overlap query pattern. The same check applies to both `createEvent` and `updateEvent` in eventService.ts.

**TIX-01** is a one-line UI fix: the `onEdit` callback in dashboard `page.tsx` currently runs `console.log('Edit clicked')`. It must call `router.push('/dashboard/tickets/' + selectedTicket.id)` or open an edit state within the drawer. Since no edit page exists at a tickets route, the simplest compliant solution is toggling an edit form inside the same drawer.

**TIX-02** requires two new Prisma models (`TicketComment` and `TicketAttachment`), two new API route groups (`/api/tickets/[id]/comments` and `/api/tickets/[id]/attachments`), and Supabase Storage integration for files. The storage pattern is fully proven in `storageService.ts` and `file-upload.ts`. `ALLOWED_DOCUMENT_TYPES` already covers image + PDF.

**TIX-03** is a targeted backend addition: add a `search` param to `ListTicketsSchema`, add an OR clause with `{ title: { contains: search, mode: 'insensitive' } }` and `{ description: { contains: search, mode: 'insensitive' } }`, and pass `?search=` from the dashboard UI's search input.

**Primary recommendation:** Address all five gaps in three plans — one per plan group as specified: (1) draft events [id] route, (2) room conflict detection, (3) ticket drawer edit + comments + attachments + search.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15 (App Router) | Route handlers | Project framework |
| Prisma | v5.22 | ORM for DB queries | Project ORM |
| Zod | Latest | Input validation | Project validation library |
| @supabase/supabase-js | Installed | Supabase Storage client | Already used in storageService.ts |
| React 18 | Installed | UI | Project framework |
| TanStack Query | Installed | Client data fetching | Project standard |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/api-response` | local | `ok()` / `fail()` envelope | Every API route response |
| `@/lib/org-context` | local | `runWithOrgContext` / `getOrgIdFromRequest` | Every org-scoped route |
| `@/lib/request-context` | local | `getUserContext` | Get userId + email from JWT |
| `@/lib/auth/permissions` | local | `assertCan` / `can` | Permission checks |
| `@/lib/validation/file-upload` | local | `validateFileUpload` | File type + size guard |
| `@/lib/services/storageService` | local | Supabase Storage upload | File persistence |

**No new npm packages are required for this phase.**

---

## Architecture Patterns

### Recommended Project Structure (additions)

```
src/
  app/
    api/
      draft-events/
        [id]/
          route.ts          # NEW — GET/PUT/DELETE for single draft event
      tickets/
        [id]/
          route.ts          # NEW — GET/PUT/DELETE for single ticket (needed for comments/attachments sub-routes)
          comments/
            route.ts        # NEW — GET/POST ticket comments
          attachments/
            route.ts        # NEW — GET/POST ticket attachments
            [attachmentId]/
              route.ts      # NEW — DELETE single attachment
  lib/
    services/
      ticketCommentService.ts   # NEW — comment CRUD service functions
      ticketAttachmentService.ts # NEW — attachment upload/list/delete
```

### Pattern 1: [id] Route Handler (established pattern)

The project pattern for `[id]` route files is consistent across inventory, IT tickets, and other modules. Follow this exactly:

```typescript
// src/app/api/draft-events/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import * as draftEventService from '@/lib/services/draftEventService'
import { z } from 'zod'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    return await runWithOrgContext(orgId, async () => {
      const draft = await draftEventService.getDraftEventById(id, ctx.userId)
      if (!draft) {
        return NextResponse.json(fail('NOT_FOUND', 'Draft event not found'), { status: 404 })
      }
      return NextResponse.json(ok(draft))
    })
  } catch (error) {
    // standard error handling
  }
}
```

**Critical detail:** `params` is a `Promise` in Next.js 15 App Router — always `await params` before destructuring.

### Pattern 2: Prisma Time-Range Overlap Query (for CAL-02)

Standard interval overlap condition: two intervals [A.start, A.end) and [B.start, B.end) overlap when `A.start < B.end AND A.end > B.start`.

```typescript
// In eventService.ts createEvent / updateEvent
async function detectRoomConflict(
  room: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string
): Promise<boolean> {
  const conflict = await prisma.event.findFirst({
    where: {
      room,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      status: { not: 'CANCELLED' },
    },
  })
  return conflict !== null
}
```

Throw a descriptive error if conflict found:
```typescript
if (room && await detectRoomConflict(room, startsAt, endsAt, existingEventId)) {
  throw Object.assign(
    new Error(`Room "${room}" is already booked from ${startsAt.toISOString()} to ${endsAt.toISOString()}`),
    { code: 'ROOM_CONFLICT' }
  )
}
```

Route handler catches `ROOM_CONFLICT` and returns `409 Conflict`:
```typescript
if (error instanceof Error && (error as any).code === 'ROOM_CONFLICT') {
  return NextResponse.json(fail('ROOM_CONFLICT', error.message), { status: 409 })
}
```

### Pattern 3: Keyword Search (Prisma contains, established pattern)

Match what maintenanceAssetService and itDeviceService already do:

```typescript
// In ticketService.ts listTickets
if (validated.search) {
  const s = validated.search.trim()
  where.OR = [
    { title: { contains: s, mode: 'insensitive' } },
    { description: { contains: s, mode: 'insensitive' } },
  ]
}
```

In `ListTicketsSchema`, add:
```typescript
search: z.string().max(200).optional(),
```

In `tickets/route.ts` GET handler, add:
```typescript
const search = searchParams.get('search') || undefined
```

### Pattern 4: File Upload (Supabase Storage, established pattern)

The branding upload route (`/api/settings/branding/upload/route.ts`) is the canonical reference. For ticket attachments:

- Accept `{ fileBase64, contentType, fileName }` JSON body
- Use `validateFileUpload(...)` with `ALLOWED_DOCUMENT_TYPES` (images + PDF)
- Upload via `storageService` to a `ticket-attachments` bucket
- Path convention: `{orgId}/tickets/{ticketId}/{timestamp}-{random}.{ext}`
- Return `{ attachmentId, fileUrl, fileName, contentType, sizeBytes }`

The `ALLOWED_DOCUMENT_TYPES` set from `file-upload.ts` covers: JPEG, PNG, WebP, GIF, PDF — use this for ticket attachments without modification.

### Pattern 5: Prisma Schema for Comments and Attachments

Follow PlanningComment pattern for TicketComment:

```prisma
model TicketComment {
  id             String   @id @default(cuid())
  organizationId String
  ticketId       String
  authorId       String
  body           String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  ticket  Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  author  User   @relation("TicketCommentAuthor", fields: [authorId], references: [id], onDelete: Cascade)

  @@index([ticketId, createdAt])
  @@index([organizationId])
}

model TicketAttachment {
  id             String   @id @default(cuid())
  organizationId String
  ticketId       String
  uploadedById   String
  fileName       String
  fileUrl        String   // Supabase public URL
  contentType    String
  sizeBytes      Int
  createdAt      DateTime @default(now())

  ticket      Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  uploadedBy  User   @relation("TicketAttachmentUploader", fields: [uploadedById], references: [id], onDelete: Cascade)

  @@index([ticketId, createdAt])
  @@index([organizationId])
}
```

**CRITICAL:** `TicketComment` and `TicketAttachment` are NOT listed in CLAUDE.md's org-scoped models list. Adding `organizationId` to them allows future scoping but they are NOT auto-injected by the Prisma extension. Their security comes from the parent `Ticket` being org-scoped. Do not expect `prisma.ticketComment.findMany({})` to auto-filter by org — filter explicitly or rely on `ticketId` which already belongs to an org-scoped ticket.

### Pattern 6: TIX-01 Edit Button Fix

The `onEdit` callback in `src/app/dashboard/page.tsx` line 472-474 currently runs `console.log('Edit clicked')`. The fix is switching from view mode to an edit form inline within the same drawer (no separate route needed):

```typescript
const [isEditMode, setIsEditMode] = useState(false)
const [editForm, setEditForm] = useState({ title: '', description: '', priority: 'NORMAL' })

// In drawer's onEdit:
onEdit={() => {
  setEditForm({
    title: selectedTicket?.title || '',
    description: selectedTicket?.description || '',
    priority: selectedTicket?.priority || 'NORMAL',
  })
  setIsEditMode(true)
}}
```

Render edit form when `isEditMode === true` inside the same DetailDrawer, with Save/Cancel buttons. Save calls `PUT /api/tickets/[id]` and refreshes.

### Anti-Patterns to Avoid

- **Using `rawPrisma` in route handlers** — always use `prisma` (org-scoped) inside `runWithOrgContext`
- **Skipping conflict detection on update** — conflict check must also run in `updateEvent` with `excludeId = id` (skip self-comparison)
- **Checking for room conflicts when room is empty** — only run conflict query when `room` is a non-empty string; free-text rooms are optional
- **Storing files as base64 in DB** — use Supabase Storage; only store the URL in the DB row
- **Forgetting `await params`** — Next.js 15 App Router passes `params` as a Promise; always `const { id } = await params`

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File type validation | Custom MIME check | `validateFileUpload` from `@/lib/validation/file-upload` | Already covers all needed types, has ALLOWED_DOCUMENT_TYPES |
| File storage | Custom S3/disk logic | `storageService.ts` + Supabase Storage | Pattern proven, bucket names established |
| Permission checks | Manual role comparison | `assertCan` / `can` from `@/lib/auth/permissions` | Cached, consistent with all other routes |
| Response envelopes | Manual `{ ok: true, data: ... }` | `ok()` / `fail()` from `@/lib/api-response` | Project standard, client expects this shape |
| Org ID extraction | Manual header read | `getOrgIdFromRequest(req)` | Canonical pattern from middleware |
| User context | Manual JWT decode | `getUserContext(req)` | Handles httpOnly cookie + Authorization header fallback |

---

## Common Pitfalls

### Pitfall 1: Missing `await params` (Next.js 15)
**What goes wrong:** TypeScript will complain if `params` is destructured directly without await; at runtime, `id` is `undefined`.
**Why it happens:** Next.js 15 changed `params` to be a Promise.
**How to avoid:** Always write `const { id } = await params` at the top of each route function.
**Warning signs:** TypeScript error "Property 'id' does not exist on type 'Promise<...>'" or runtime 404s.

### Pitfall 2: Conflict Detection Skips Cancelled Events — or Doesn't
**What goes wrong:** If cancelled events are included in the conflict query, rooms can never be reused after a cancellation. If they are excluded, a cancelled event occupying a room allows overbooking without warning.
**Why it happens:** Business logic ambiguity.
**How to avoid:** Exclude `status: 'CANCELLED'` from conflict query (cancelled events free up the room). This is the semantically correct behavior.
**Warning signs:** Test where you cancel event A, create event B in same slot — should succeed.

### Pitfall 3: Room Conflict on Free-Text Field Allows Near-Misses
**What goes wrong:** Room is stored as a free string ("Room 204" vs "room 204" vs "Rm 204"). Two different strings for the same physical room won't detect a conflict.
**Why it happens:** No structured `roomId` FK on Event or DraftEvent — they store room as free text.
**How to avoid:** Do a case-insensitive comparison (or lowercase both sides) in the conflict query. Use `{ room: { equals: room, mode: 'insensitive' } }`.
**Warning signs:** Creating two events with "Room 204" and "room 204" — should conflict but won't without case-insensitive comparison.

### Pitfall 4: TicketComment Not Auto-Org-Scoped
**What goes wrong:** Calling `prisma.ticketComment.findMany({ where: { ticketId } })` works, but calling `prisma.ticketComment.findMany({})` without a `ticketId` or `organizationId` filter leaks data across orgs.
**Why it happens:** CLAUDE.md lists the org-scoped models explicitly; `TicketComment` and `TicketAttachment` are not on that list.
**How to avoid:** Always filter by `ticketId` (which is implicitly org-scoped). Do not expose list-all comments endpoints. When listing comments, always scope by `ticketId`.
**Warning signs:** A query with no `where` clause on comment/attachment models.

### Pitfall 5: Ticket [id] Route Needed Before Sub-Routes
**What goes wrong:** Creating `/api/tickets/[id]/comments/route.ts` requires `/api/tickets/[id]/` directory to exist. Also, a `GET /api/tickets/[id]` is needed to fetch a single ticket for the detail view (currently absent).
**Why it happens:** The current tickets API only has a collection route (`/api/tickets/route.ts`).
**How to avoid:** Create `/api/tickets/[id]/route.ts` with GET/PUT/DELETE first, then add sub-route directories.
**Warning signs:** 404 on `/api/tickets/[id]` when the drawer tries to fetch a single ticket.

### Pitfall 6: Supabase Storage Bucket Must Exist
**What goes wrong:** Uploading to a bucket that doesn't exist returns a storage error rather than creating it.
**Why it happens:** Supabase requires buckets to be pre-created in the dashboard or via API.
**How to avoid:** Note in plan that a `ticket-attachments` bucket must be created in Supabase dashboard before the upload route is used. This is a deployment/setup step, not a code step.
**Warning signs:** `Upload failed: The resource was not found` from storageService.

---

## Code Examples

### Draft Events [id] Route — Full Pattern

```typescript
// Source: pattern from src/app/api/inventory/[id]/route.ts (project codebase)
import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { z } from 'zod'
import * as draftEventService from '@/lib/services/draftEventService'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    return await runWithOrgContext(orgId, async () => {
      const draft = await draftEventService.getDraftEventById(id, ctx.userId)
      if (!draft) return NextResponse.json(fail('NOT_FOUND', 'Draft event not found'), { status: 404 })
      return NextResponse.json(ok(draft))
    })
  } catch (error) {
    if (isAuthError(error)) return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    if (error instanceof Error && error.message.includes('Insufficient permissions'))
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    if (error instanceof Error && error.message.includes('Access denied'))
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    return NextResponse.json(fail('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    return await runWithOrgContext(orgId, async () => {
      const draft = await draftEventService.updateDraftEvent(id, body, ctx.userId)
      return NextResponse.json(ok(draft))
    })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    if (error instanceof Error && error.message.includes('not found'))
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    if (error instanceof Error && (error.message.includes('Insufficient permissions') || error.message.includes('Access denied')))
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    return NextResponse.json(fail('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    return await runWithOrgContext(orgId, async () => {
      await draftEventService.deleteDraftEvent(id, ctx.userId)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found'))
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    if (error instanceof Error && (error.message.includes('Insufficient permissions') || error.message.includes('Access denied')))
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    return NextResponse.json(fail('INTERNAL_ERROR', 'Internal server error'), { status: 500 })
  }
}
```

### Room Conflict Detection Query

```typescript
// Source: Prisma interval overlap pattern — verified against Prisma docs
// Add to eventService.ts
async function checkRoomConflict(
  room: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string
): Promise<void> {
  if (!room || !room.trim()) return // no room = no conflict to check

  const conflict = await prisma.event.findFirst({
    where: {
      room: { equals: room.trim(), mode: 'insensitive' },
      status: { not: 'CANCELLED' },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  })

  if (conflict) {
    const err = new Error(
      `Room "${room}" is already booked from ${conflict.startsAt.toISOString()} to ${conflict.endsAt.toISOString()}`
    )
    ;(err as any).code = 'ROOM_CONFLICT'
    throw err
  }
}
```

### Ticket Keyword Search Addition

```typescript
// Source: established pattern from src/lib/services/maintenanceAssetService.ts
// Add to ListTicketsSchema in ticketService.ts:
search: z.string().max(200).optional(),

// Add to listTickets where-clause building:
if (validated.search) {
  const s = validated.search.trim()
  where.OR = [
    { title: { contains: s, mode: 'insensitive' } },
    { description: { contains: s, mode: 'insensitive' } },
  ]
}
```

### Dashboard Edit Button Fix

```typescript
// Source: src/app/dashboard/page.tsx (project codebase)
// Replace the dead console.log with edit mode toggle:
const [isEditMode, setIsEditMode] = useState(false)
const [editForm, setEditForm] = useState({ title: '', description: '', priority: 'NORMAL' })

// onEdit callback:
onEdit={() => {
  setEditForm({
    title: selectedTicket?.title || '',
    description: selectedTicket?.description || '',
    priority: selectedTicket?.priority || 'NORMAL',
  })
  setIsEditMode(true)
}}

// Inside the drawer children, render conditionally:
{isEditMode ? (
  <EditTicketForm
    form={editForm}
    onChange={setEditForm}
    onSave={handleSaveEdit}
    onCancel={() => setIsEditMode(false)}
    saving={editSaving}
    error={editError}
  />
) : (
  // existing read-only detail view
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `params` as object | `params` as Promise | Next.js 15 | Must `await params` in every route function |
| localStorage JWT reads | httpOnly cookie + `fetchApi()` | Phase 8 | dashboard/page.tsx still uses localStorage — this is pre-migration legacy; don't break it in this phase |
| No search on tickets | `?search=` param via `contains` | Phase 11 (this phase) | Prisma supports case-insensitive LIKE on PostgreSQL via `mode: 'insensitive'` |

**Deprecated/outdated:**
- `console.log('Edit clicked')` at line 473 of dashboard/page.tsx: dead code — replaced by edit mode state

---

## Open Questions

1. **Should conflict detection also apply to DraftEvent room bookings (CAL-02)?**
   - What we know: CAL-02 requirements say "prevents booking two events for the same room" — uses the word "event" which could mean only the published `Event` model
   - What's unclear: Whether admins creating overlapping drafts should be blocked, or only the publish step
   - Recommendation: Apply conflict detection at `createEvent` and `updateEvent` (published events only). DraftEvents are drafts — blocking them during drafting may be too restrictive. The conflict fires when a draft is submitted/published via `submitDraftEvent`.

2. **`ticket-attachments` Supabase bucket — create in dashboard or via service?**
   - What we know: Existing buckets (`logos`, `campus-images`) were created manually in the Supabase dashboard
   - What's unclear: Whether a bucket creation step should be documented in the plan or scripted
   - Recommendation: Document as a manual setup step in the plan's Wave 0 notes. The storageService pattern for a new bucket (`ticket-attachments`) is identical to `campus-images`.

3. **Ticket [id] route for GET — does `getTicketById` in ticketService access check work for the drawer?**
   - What we know: `getTicketById` checks if user has `TICKETS_READ_ALL` or is the assignee — but the dashboard shows tickets to any authenticated user including creator
   - What's unclear: The access check in `getTicketById` only passes for assignee or `TICKETS_READ_ALL` — ticket creators cannot GET their own ticket by ID
   - Recommendation: Fix the access check in `getTicketById` to also allow the ticket creator (`ticket.createdById === userId`) alongside the assignee check.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Smoke tests (Node.js .mjs scripts) — no Vitest unit tests yet (INFRA-01 in Phase 13) |
| Config file | `package.json` scripts (`smoke:*`) |
| Quick run command | `npm run smoke:campus` |
| Full suite command | `npm run smoke:all` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAL-01 | GET/PUT/DELETE `/api/draft-events/[id]` returns correct data, 404 for missing, 403 for unauthorized | smoke | `node scripts/smoke-draft-events.mjs` | ❌ Wave 0 |
| CAL-02 | POST event with conflicting room/time returns 409; non-conflicting succeeds | smoke | `node scripts/smoke-draft-events.mjs` | ❌ Wave 0 |
| TIX-01 | Edit button opens editable fields; save updates ticket via PUT | manual visual | manual | N/A |
| TIX-02 | POST comment appears in GET comments; POST attachment uploads file and appears in GET | smoke | `node scripts/smoke-tickets.mjs` | ❌ Wave 0 |
| TIX-03 | GET /api/tickets?search=keyword returns only matching tickets | smoke | `node scripts/smoke-tickets.mjs` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run smoke:campus` (existing suite — doesn't cover new routes yet)
- **Per wave merge:** `npm run smoke:all && node scripts/smoke-draft-events.mjs && node scripts/smoke-tickets.mjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/smoke-draft-events.mjs` — covers CAL-01 and CAL-02
- [ ] `scripts/smoke-tickets.mjs` — covers TIX-02 and TIX-03

*(TIX-01 is a UI change verified visually; it does not require a smoke test for the edit button click itself, but the underlying PUT /api/tickets/[id] should be covered by the tickets smoke test.)*

---

## Sources

### Primary (HIGH confidence)
- Project codebase (direct file reads) — `src/app/api/draft-events/route.ts`, `src/lib/services/draftEventService.ts`, `src/lib/services/eventService.ts`, `src/lib/services/ticketService.ts`, `src/app/dashboard/page.tsx`, `src/lib/services/storageService.ts`, `src/lib/validation/file-upload.ts`, `prisma/schema.prisma`, `src/lib/permissions.ts`
- Prisma v5 overlap query pattern — `startsAt: { lt: endsAt }, endsAt: { gt: startsAt }` is standard Prisma date range overlap

### Secondary (MEDIUM confidence)
- Existing search pattern verified in `src/lib/services/maintenanceAssetService.ts` (lines 185-192) and `src/lib/services/itDeviceService.ts` (lines 176-181) — `{ contains, mode: 'insensitive' }` on Prisma with PostgreSQL

### Tertiary (LOW confidence)
- None — all findings verified in project source code

---

## Metadata

**Confidence breakdown:**
- CAL-01 (draft events [id] route): HIGH — service functions exist, route pattern is direct copy with correct imports
- CAL-02 (room conflict detection): HIGH — Prisma overlap query is a standard pattern; caveat is free-text room field requires case-insensitive compare
- TIX-01 (edit button): HIGH — dead console.log confirmed at line 473, inline edit form is the correct scope-limited solution
- TIX-02 (comments + attachments): HIGH — schema additions straightforward, storage pattern proven; Supabase bucket creation is a deployment detail
- TIX-03 (keyword search): HIGH — `contains` + `mode: 'insensitive'` pattern exists in 3 other services in this codebase

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable stack, 30-day window)
