# Phase 3: Kanban & AI - Research

**Researched:** 2026-03-05
**Domain:** Drag-and-drop Kanban UI (dnd-kit), Anthropic Claude Vision API, optimistic mutations
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 6 main columns visible: BACKLOG, TODO, IN_PROGRESS, ON_HOLD, QA, DONE
- SCHEDULED and CANCELLED tickets NOT shown on the board
- Each column header shows ticket count badge updating live on drag
- Horizontal scroll on smaller screens
- Medium-density cards (~120px tall) with: ticket #, full title, priority badge, category tag, location snippet, assigned tech name + avatar, age indicator, photo indicator, AI indicator
- Click card to navigate to full ticket detail page
- Cards use `ui-glass-hover` styling
- Mobile: horizontal swipe columns, one column fills screen width, Trello mobile pattern
- ON_HOLD drop triggers hold reason modal (HoldReasonInlineForm); cancel reverts card
- QA drop triggers QA completion modal (QACompletionModal); cancel reverts card
- Invalid transition targets show red border/X overlay; on drop attempt, card snaps back with shake animation + toast
- Drag-to-assign: technician panel, dragging unassigned ticket onto avatar assigns + auto-moves BACKLOG to TODO
- Tab bar: "My Board" | "Campus Board" | "All Campuses"
- Technicians only see "My Board"; Head/Admin see all three
- Same page, different data — no route changes between views
- Board is default view; small grid/list toggle in top-right to switch to existing WorkOrdersView/WorkOrdersTable
- Same filter set as WorkOrdersFilters: specialty, priority, campus, technician, date range, keyword search, unassigned toggle
- AI diagnostic panel: collapsible, collapsed by default, in right column below status tracker above activity feed
- Lazy-loads Anthropic Claude API call on first expand
- Returns: likely diagnosis, suggested tools, suggested parts/supplies, step-by-step fix
- Confidence indicator badge: Low / Medium / High based on photo clarity
- Labeled "AI Suggestion — always verify on-site"
- Uses Anthropic Claude API (NOT Gemini)
- On expand: skeleton blocks with animate-pulse and "Analyzing photos..." label
- Ask AI: text input at bottom of AI panel, available on all tickets, responses inline, each turn cached in aiAnalysis JSON
- AI results cached in MaintenanceTicket.aiAnalysis JSON field (already exists)
- Reopening same ticket loads cached results; new photos invalidate cache
- PPE/Safety panel: amber/yellow warning card auto-shown for Custodial/Biohazard, above AI diagnostic panel, always visible, cannot be collapsed, NOT AI-generated

### Claude's Discretion
- dnd-kit implementation details (sensors, collision detection, drop animation)
- Technician assignment panel exact design (top row vs sidebar)
- Board column widths and responsive breakpoints
- AI prompt engineering for diagnostic quality
- PPE checklist content (specific items per category)
- Filter pill exact styling and layout
- Board/list toggle icon choice and placement
- Ask AI conversation history depth and display format

### Deferred Ideas (OUT OF SCOPE)
- IT Help Desk as second module
- Sidebar badge count for unclaimed matching-specialty tickets
- Real-time WebSocket board updates (polling with `?since=` is sufficient)
- Knowledge base article surfacing alongside AI diagnosis (Phase 7)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOARD-01 | Kanban board displays columns mapping 1:1 to ticket statuses | dnd-kit DndContext + droppable columns per status |
| BOARD-02 | Drag-and-drop moves tickets between columns with role-based validation | ALLOWED_TRANSITIONS map (client-side) + optimistic update + server-side transitionTicketStatus |
| BOARD-03 | "My Board" view shows only tickets assigned to current technician | Filter query param `assignedToId=currentUserId` |
| BOARD-04 | "Campus Board" shows all tickets for one campus (Head/Admin only) | Filter query param `schoolId=activeCampusId` + permission gate |
| BOARD-05 | "All Campuses" view shows cross-campus tickets with filtering | No schoolId filter + full filter bar |
| BOARD-06 | Cards show: ID, title, location, priority badge, category tag, assigned tech, age, photo/AI indicators | KanbanCard component using WorkOrderTicket type + photos/aiAnalysis presence |
| BOARD-07 | Backlog filters: specialty, priority, campus, technician, date range, keyword, unassigned toggle | Reuse WorkOrdersFilters component |
| BOARD-08 | SCHEDULED tickets shown in separate view, not in main backlog | Pass `excludeStatus=SCHEDULED` to board data query (pattern from Phase 2) |
| AI-01 | AI diagnostic panel triggered lazily when technician first opens ticket with photos | onClick expand → check cache → POST /api/maintenance/tickets/[id]/ai-diagnose |
| AI-02 | AI returns: diagnosis, tools, parts, step-by-step fix | Anthropic claude-sonnet-4-5 vision API with structured JSON response |
| AI-03 | Confidence indicator displayed (Low/Medium/High) based on photo clarity | Prompt returns confidence field; display as badge |
| AI-04 | "Ask AI" for free-form troubleshooting on any ticket | POST /api/maintenance/tickets/[id]/ai-ask with conversation turn appended to aiAnalysis |
| AI-05 | PPE/Safety panel auto-shown for Custodial/Biohazard tickets | Client-side: if category === 'CUSTODIAL_BIOHAZARD' render PPESafetyPanel |
| AI-06 | AI results cached in MaintenanceTicket.aiAnalysis | Check aiAnalysis JSON on panel expand; skip API call if cached |
| AI-07 | Panel labeled "AI Suggestion — always verify on-site" | Static text in AIDiagnosticPanel component |
| AI-08 | Uses Anthropic Claude API (not Gemini) | @anthropic-ai/sdk with claude-sonnet-4-5-20250929 |
</phase_requirements>

---

## Summary

Phase 3 adds two distinct technical capabilities to the existing maintenance module: a drag-and-drop Kanban board and an AI diagnostic panel powered by Anthropic's vision API. Both build on the ticket engine delivered in Phase 2 without requiring schema changes — the `aiAnalysis: Json?` field already exists on `MaintenanceTicket` and the `ALLOWED_TRANSITIONS` map already encodes the complete state machine.

The Kanban board uses `@dnd-kit/core` (v6.3.1) with `@dnd-kit/sortable` and `@dnd-kit/utilities`. These are new dependencies not yet in the project. The key implementation challenge is multi-container drag: tickets must move between 6 status columns with optimistic UI updates and gated modals for ON_HOLD and QA drops. The existing `transitionTicketStatus` service and optimistic mutation pattern from Phase 2's claim flow are the direct predecessors to reuse.

The AI integration uses `@anthropic-ai/sdk` (v0.78.0) with `claude-sonnet-4-5` (alias `claude-sonnet-4-5-20250929`). The project's decision to use Anthropic rather than Gemini is already pinned in STATE.md. The Supabase storage URLs for ticket photos are HTTPS URLs, which Claude accepts directly via the `url` source type — no base64 encoding needed. This simplifies the service layer significantly. The `aiAnalysis` JSON cache structure needs to be defined once and used consistently across both the diagnose and ask-AI endpoints.

**Primary recommendation:** Build the Kanban board as a new `KanbanBoard.tsx` component that wraps `WorkOrdersView.tsx` as a peer (not inside it), driven by the same filter state. Gate modals (ON_HOLD, QA) reuse existing Phase 2 components. The AI service uses URL-based image passing to avoid encoding overhead. Define a typed `AiAnalysisCache` interface to keep the JSON field structured.

---

## Standard Stack

### Core (new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | 6.3.1 | DnD context, sensors, drag events | De facto standard for React drag-and-drop; accessible, touch-friendly, no HTML5 DnD limitations |
| @dnd-kit/sortable | 7.0.2 | Sortable presets and hooks for items within containers | Official preset for ordered lists; provides `useSortable`, `SortableContext` |
| @dnd-kit/utilities | 3.2.2 | CSS helpers like `CSS.Transform.toString` | Required peer for sortable animations |
| @anthropic-ai/sdk | 0.78.0 | Anthropic Claude API client | Official SDK; project decision pinned in STATE.md |

### Already in Project
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| framer-motion | 12.34.3 | Card drag animations, DragOverlay, gate modal transitions | Already used throughout; variants in `src/lib/animations.ts` |
| @tanstack/react-query | 5.90.21 | Data fetching, optimistic mutations | Pattern established in Phase 2 (claim mutation) |
| lucide-react | 0.564.0 | Icons (GripVertical, Bot, ShieldAlert, etc.) | Already installed |
| tailwindcss | 3.4.15 | Styling | Already installed |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @anthropic-ai/sdk
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/core | react-beautiful-dnd | react-beautiful-dnd is deprecated; dnd-kit is the successor |
| @dnd-kit/core | @hello-pangea/dnd | Community fork of rbd; less flexible for multi-container; dnd-kit has better TS support |
| claude-sonnet-4-5 | claude-haiku-4-5 | Haiku is faster/cheaper but weaker at visual reasoning for maintenance photos |
| URL-based images | Base64 encoding | URL is simpler; Supabase storage URLs are stable HTTPS URLs Claude can fetch |

---

## Architecture Patterns

### Recommended Project Structure

New files for this phase:
```
src/
  components/
    maintenance/
      KanbanBoard.tsx          # Main board: DndContext + 6 columns + drag overlay
      KanbanColumn.tsx         # Single column: SortableContext + card list + header
      KanbanCard.tsx           # Draggable ticket card with glassmorphism
      TechnicianAssignPanel.tsx # Droppable tech avatars for drag-to-assign
      AIDiagnosticPanel.tsx    # Collapsible AI panel with lazy load + ask-ai input
      PPESafetyPanel.tsx       # Static amber safety panel for biohazard tickets
  lib/
    services/
      ai/
        maintenance-ai.service.ts  # Anthropic SDK wrapper for diagnose + ask-ai
  app/
    api/
      maintenance/
        tickets/
          [id]/
            ai-diagnose/route.ts   # POST — vision analysis, returns + caches diagnosis
            ai-ask/route.ts        # POST — free-form Q, appends to aiAnalysis cache
```

### Pattern 1: Multi-Container Kanban with DndContext

**What:** Wrap the entire board in a single `DndContext`. Each column is a `SortableContext`. Tickets are `useDraggable` items. An `onDragEnd` handler resolves source column → target column and fires the status transition.

**When to use:** Any time items must move between discrete containers (columns) with validation.

**Example:**
```typescript
// Source: @dnd-kit/core docs + LogRocket verified pattern
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { SortableContext, verticalListSorting } from '@dnd-kit/sortable'

// Activation constraints prevent accidental drags on click
const mouseSensor = useSensor(MouseSensor, {
  activationConstraint: { distance: 8 },
})
const touchSensor = useSensor(TouchSensor, {
  activationConstraint: { delay: 200, tolerance: 5 },
})
const sensors = useSensors(mouseSensor, touchSensor)

// Each column needs a unique droppable ID matching the status string
// DragOverlay renders a ghost card that follows the pointer
<DndContext
  sensors={sensors}
  collisionDetection={closestCorners}
  onDragStart={handleDragStart}
  onDragOver={handleDragOver}   // For live column highlighting
  onDragEnd={handleDragEnd}
>
  {BOARD_COLUMNS.map(status => (
    <KanbanColumn key={status} id={status} tickets={columnTickets[status]} />
  ))}
  <DragOverlay>
    {activeTicket ? <KanbanCard ticket={activeTicket} isOverlay /> : null}
  </DragOverlay>
</DndContext>
```

### Pattern 2: Optimistic Kanban Drag with Gate Modals

**What:** On `onDragEnd`, immediately move the card in local state (optimistic), then either (a) show a gate modal if the transition requires it, or (b) fire the API call directly. If the API fails or the user cancels the modal, revert the optimistic state.

**When to use:** All drag transitions in the Kanban board.

```typescript
// Source: Phase 2 established pattern (useMutation onMutate/onError/onSettled)
const transitionMutation = useMutation({
  mutationFn: ({ ticketId, newStatus, extra }) =>
    fetch(`/api/maintenance/tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus, ...extra }),
    }),
  onMutate: async ({ ticketId, newStatus }) => {
    // 1. Snapshot current query cache
    const snapshot = queryClient.getQueryData(['kanban-tickets'])
    // 2. Optimistically move card in cache
    queryClient.setQueryData(['kanban-tickets'], (old) => moveCard(old, ticketId, newStatus))
    return { snapshot }
  },
  onError: (err, vars, ctx) => {
    // Revert to snapshot
    queryClient.setQueryData(['kanban-tickets'], ctx.snapshot)
    toast.error('Move failed')
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['kanban-tickets'] })
  },
})

// Gate modal flow:
function handleDragEnd(event) {
  const { active, over } = event
  if (!over) return                               // Dropped outside
  const newStatus = over.id as MaintenanceTicketStatus
  const ticket = findTicket(active.id)

  if (!isValidTransition(ticket.status, newStatus)) {
    // Shake animation + toast — no state change
    triggerShake(active.id)
    toast.error(`Cannot move from ${ticket.status} to ${newStatus}`)
    return
  }

  if (newStatus === 'ON_HOLD') {
    setPendingDrop({ ticketId: ticket.id, newStatus })
    setShowHoldModal(true)    // Modal has confirm/cancel
    return                    // Don't mutate yet
  }
  if (newStatus === 'QA') {
    setPendingDrop({ ticketId: ticket.id, newStatus })
    setShowQAModal(true)
    return
  }

  // Direct transition — fire immediately
  transitionMutation.mutate({ ticketId: ticket.id, newStatus })
}
```

### Pattern 3: Client-Side Transition Validation

**What:** Import `ALLOWED_TRANSITIONS` from `maintenanceTicketService.ts` on the client to determine valid drop targets while dragging, so invalid columns can show a red border before the drop occurs.

**When to use:** `onDragOver` event — highlight valid vs invalid targets in real time.

```typescript
// maintenanceTicketService.ts exports ALLOWED_TRANSITIONS — reuse on client
import { ALLOWED_TRANSITIONS } from '@/lib/services/maintenanceTicketService'

function isValidTransition(from: MaintenanceTicketStatus, to: MaintenanceTicketStatus): boolean {
  return !!ALLOWED_TRANSITIONS[from]?.[to]
}

// In KanbanColumn: apply red border when activeTicket's current status
// has no valid path to this column
const isDragTarget = activeTicket && isValidTransition(activeTicket.status, columnStatus)
const isInvalidTarget = activeTicket && !isDragTarget
```

### Pattern 4: Anthropic Vision API — URL-Based Image Analysis

**What:** Pass Supabase storage URLs directly to Claude's vision API. No base64 encoding needed. Return structured JSON with a typed schema.

**When to use:** POST /api/maintenance/tickets/[id]/ai-diagnose

```typescript
// Source: Anthropic official docs (platform.claude.com/docs/en/build-with-claude/vision)
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Supabase URLs are stable HTTPS — pass directly via "url" source type
const imageContent = ticket.photos.map(url => ({
  type: 'image' as const,
  source: { type: 'url' as const, url },
}))

const response = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: [
      ...imageContent,
      {
        type: 'text',
        text: DIAGNOSTIC_PROMPT,
      },
    ],
  }],
})

// Parse JSON from response.content[0].text
```

### Pattern 5: AiAnalysis Cache Structure

**What:** Define a typed `AiAnalysisCache` interface for what gets stored in `MaintenanceTicket.aiAnalysis: Json?`. This prevents unstructured JSON accumulation and makes cache invalidation logic clear.

```typescript
// src/lib/types/maintenance-ai.ts
export interface AiDiagnosis {
  likelyDiagnosis: string
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  suggestedTools: string[]
  suggestedParts: string[]
  steps: string[]
  analyzedPhotoCount: number  // Used to detect when new photos invalidate cache
  analyzedAt: string          // ISO timestamp
}

export interface AiConversationTurn {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface AiAnalysisCache {
  diagnosis: AiDiagnosis | null
  conversation: AiConversationTurn[]
  lastPhotoSnapshot: string[]  // Copy of photos[] at time of analysis — for invalidation check
}
```

**Cache invalidation check (server-side in ai-diagnose route):**
```typescript
const cached = ticket.aiAnalysis as AiAnalysisCache | null
const photosChanged = JSON.stringify(ticket.photos.sort()) !==
  JSON.stringify((cached?.lastPhotoSnapshot ?? []).sort())

if (cached?.diagnosis && !photosChanged) {
  return NextResponse.json(ok({ diagnosis: cached.diagnosis, cached: true }))
}
// else: run analysis, update aiAnalysis field
```

### Anti-Patterns to Avoid

- **Mounting DndContext per column:** DndContext must wrap ALL draggable/droppable elements. One global context for the whole board.
- **Using HTML5 DnD events directly:** dnd-kit abstracts this away. Never mix `onDragStart` native events with dnd-kit events.
- **Calling transitionTicketStatus directly from onDragEnd for gated transitions:** Always show the modal first for ON_HOLD and QA. The server rejects requests missing required fields anyway, but the UX should not flash a failed state.
- **Fetching AI results on ticket detail page load:** The panel is collapsed by default. Only trigger the API call on first expand (lazy loading).
- **Storing conversation turns outside aiAnalysis:** The `aiAnalysis` JSON field is the single source of truth for all AI state on a ticket. No separate table.
- **Passing base64 images to Anthropic when URL is available:** Supabase storage URLs are public (signed or direct). Use URL source type to avoid the 32MB request limit and unnecessary encoding overhead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop primitives | Custom mousemove/touchmove tracking | @dnd-kit/core | Pointer events, touch events, keyboard nav, accessibility, scroll containers — all handled |
| Sortable item transforms | Manual CSS position tracking during drag | `useSortable` from @dnd-kit/sortable | Provides `transform`, `transition`, `isDragging`, `setNodeRef` with correct CSS values |
| Drag ghost element | Cloning the dragged element | `DragOverlay` from @dnd-kit/core | Renders in a portal, prevents layout shift, correct z-index stacking |
| Anthropic HTTP client | Raw fetch to api.anthropic.com | @anthropic-ai/sdk | Auth headers, retry logic, streaming support, TypeScript types for all response shapes |
| Image encoding | fileReader.readAsDataURL() + manual base64 | URL source type in Anthropic SDK | Supabase URLs are HTTPS — Claude accepts them directly, 0 bytes transferred client-to-server |
| Status transition logic | Duplicating ALLOWED_TRANSITIONS on client | Import from `maintenanceTicketService.ts` | Already defined authoritatively; import it on the client to keep the source of truth single |

**Key insight:** The dnd-kit `DragOverlay` + `useSortable` combination handles everything that makes custom drag implementations fail: scroll while dragging, touch events, accessibility, z-index, and layout stability. Do not attempt to replicate this.

---

## Common Pitfalls

### Pitfall 1: Click vs Drag Conflict
**What goes wrong:** Users clicking a card to navigate to the detail page accidentally start a drag. Cards become hard to click.
**Why it happens:** Default MouseSensor activates on any mousedown + mousemove. Without an activation constraint, even slight mouse movement starts a drag.
**How to avoid:** Set `activationConstraint: { distance: 8 }` on MouseSensor. The drag only activates after the pointer moves 8px. Clicks register normally.
**Warning signs:** Users report cards not clicking; navigation to detail page stops working.

### Pitfall 2: Optimistic State Out of Sync After Gate Modal Cancel
**What goes wrong:** User drags to ON_HOLD, modal appears, user cancels — but the card stays in ON_HOLD column.
**Why it happens:** If you move the card optimistically before showing the modal (common mistake), the cancel path must explicitly revert the state.
**How to avoid:** For gated transitions (ON_HOLD, QA), do NOT move the card in local state until the modal submits successfully. Show the card in its original column with a "pending" visual only. On modal cancel, remove the pending state. Only on modal confirm: fire the API call with the modal data using the standard optimistic mutation pattern.

### Pitfall 3: DragOverlay Position Glitch on Scroll
**What goes wrong:** The drag overlay jumps or repositions when the board is scrolled horizontally during drag.
**Why it happens:** `DragOverlay` uses fixed positioning relative to the viewport, but if the board container has a scrolling parent, coordinates can be off.
**How to avoid:** Ensure the DndContext wraps the outermost board container. Use `CSS.Transform.toString(transform)` from `@dnd-kit/utilities` for the overlay transform — do not compute it manually.

### Pitfall 4: Anthropic API Key Not Set — Service Crashes
**What goes wrong:** The `ai-diagnose` route throws an unhandled error if `ANTHROPIC_API_KEY` is not set, returning a 500 to the client.
**Why it happens:** Anthropic SDK constructor will throw if `apiKey` is undefined.
**How to avoid:** Follow the same pattern as `ai-suggest-category` route — check for key at top of route, return `{ available: false }` gracefully if absent. The AIDiagnosticPanel shows a "AI diagnostics unavailable" state rather than an error.

### Pitfall 5: aiAnalysis JSON Type Mismatch
**What goes wrong:** The `aiAnalysis` field is `Json?` in Prisma — TypeScript types it as `Prisma.JsonValue`. Direct property access fails at compile time.
**Why it happens:** Prisma's `Json` type is `string | number | boolean | object | null | undefined[]` — no structure guaranteed.
**How to avoid:** Cast explicitly after fetching: `const cache = ticket.aiAnalysis as AiAnalysisCache | null`. Define the `AiAnalysisCache` interface in a shared types file and use it consistently in both API routes and components.

### Pitfall 6: WorkOrdersFilters Category Enum Mismatch
**What goes wrong:** `WorkOrdersFilters.tsx` uses old category names (`CARPENTRY`, `PAINTING`, `CLEANING`) from an earlier schema version. The Prisma schema uses `ELECTRICAL`, `PLUMBING`, `HVAC`, `STRUCTURAL`, `CUSTODIAL_BIOHAZARD`, `IT_AV`, `GROUNDS`, `OTHER`.
**Why it happens:** The filter component has its own local `MaintenanceCategory` type that was not updated with the schema.
**How to avoid:** Update `WorkOrdersFilters.tsx` category type and dropdown options to match Prisma schema during this phase (identified from reading the file). Also note the status type has `QA_REVIEW` vs the schema's `QA` — verify which is correct and align the filter component.

### Pitfall 7: Mobile Touch Drag Conflicts with Scroll
**What goes wrong:** On mobile, horizontal board scroll and vertical card drag conflict — users trying to scroll the board accidentally start dragging cards.
**Why it happens:** Touch events are ambiguous — a horizontal swipe should scroll the board, a vertical start should potentially drag.
**How to avoid:** For the mobile swipe-column view (single column fills screen), disable dnd-kit drag entirely and use native horizontal scroll. Only enable dnd-kit on the full-width board view for tablet/desktop. The mobile column view navigates via swipe, not drag-to-reorder.

---

## Code Examples

Verified patterns from official sources:

### Anthropic Vision API — URL Image Source (TypeScript)
```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/vision
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const response = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: [
      {
        type: 'image',
        source: {
          type: 'url',
          url: 'https://[supabase-project].supabase.co/storage/v1/object/...',
        },
      },
      { type: 'text', text: 'Analyze this maintenance issue.' },
    ],
  }],
})

const text = response.content[0].type === 'text' ? response.content[0].text : ''
```

### dnd-kit Sensor Setup with Activation Constraints
```typescript
// Source: @dnd-kit/core docs — prevents accidental drags from clicks
import { MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'

const sensors = useSensors(
  useSensor(MouseSensor, {
    activationConstraint: { distance: 8 },   // 8px movement to start drag
  }),
  useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },  // 200ms hold to start
  })
)
```

### Droppable Column with Invalid Target Highlighting
```typescript
// Source: @dnd-kit/core useDroppable hook pattern
import { useDroppable } from '@dnd-kit/core'

function KanbanColumn({ id, isInvalidTarget }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'kanban-column',
        isOver && !isInvalidTarget && 'ring-2 ring-emerald-400',
        isOver && isInvalidTarget && 'ring-2 ring-red-400 opacity-70',
      )}
    >
      {/* cards */}
    </div>
  )
}
```

### AI Diagnostic Prompt (Structured JSON output)
```typescript
// Recommended prompt structure for consistent JSON response
const DIAGNOSTIC_PROMPT = `You are an expert school facilities maintenance technician AI assistant.

Analyze the provided maintenance photo(s) and return a JSON object with this exact structure:
{
  "likelyDiagnosis": "string — one sentence describing the most likely problem",
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "suggestedTools": ["tool1", "tool2"],
  "suggestedParts": ["part1", "part2"],
  "steps": ["step 1", "step 2", "step 3"],
  "confidenceReason": "string — brief explanation of why confidence is this level"
}

Confidence levels:
- HIGH: Clear photos showing obvious issue with clear solution
- MEDIUM: Photos show issue but some diagnosis uncertainty
- LOW: Photos are unclear, blurry, or multiple possible diagnoses

Return ONLY valid JSON, no markdown, no explanation outside the JSON object.
The category is: ${ticket.category}
The reported issue: ${ticket.title}${ticket.description ? ` — ${ticket.description}` : ''}`
```

### aiAnalysis Cache Write (in API route)
```typescript
// After getting Anthropic response, write to aiAnalysis field
const diagnosis: AiDiagnosis = {
  ...parsedResponse,
  analyzedPhotoCount: ticket.photos.length,
  analyzedAt: new Date().toISOString(),
}

const currentCache = (ticket.aiAnalysis as AiAnalysisCache | null) ?? {
  diagnosis: null,
  conversation: [],
  lastPhotoSnapshot: [],
}

const updatedCache: AiAnalysisCache = {
  ...currentCache,
  diagnosis,
  lastPhotoSnapshot: [...ticket.photos],
}

await prisma.maintenanceTicket.update({
  where: { id: ticketId },
  data: { aiAnalysis: updatedCache as any },
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit/core | 2021 (rbd maintenance mode) | rbd is unmaintained; dnd-kit has full TS, accessibility, touch support |
| Gemini vision for maintenance | Anthropic Claude vision | Project decision (STATE.md) | Anthropic pinned as claude-sonnet-4-5; use `claude-sonnet-4-5-20250929` |
| claude-sonnet-4-5 (legacy) | claude-sonnet-4-6 (latest) | Aug 2025 | `claude-sonnet-4-5-20250929` is still available; `claude-sonnet-4-6` is faster and more capable but either works |
| Base64 image encoding | URL source type in Anthropic API | Always supported, but URL type added explicitly | Zero encoding overhead; use Supabase HTTPS URLs directly |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Do not use; unmaintained since 2023; replaced by dnd-kit
- `@hello-pangea/dnd`: Community fork; less flexible than dnd-kit for multi-container layouts
- `claude-3-haiku-20240307`: Deprecated, retiring April 19, 2026

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — project uses manual smoke tests only |
| Config file | None — `scripts/smoke-*.mjs` for integration tests |
| Quick run command | Manual: `npm run smoke:all` (requires live API) |
| Full suite command | Manual: `npm run smoke:all` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOARD-02 | Drag moves ticket between columns, status updates | manual-only | Smoke test against live API | ❌ Wave 0 |
| BOARD-03 | My Board shows only technician's tickets | manual-only | `node scripts/smoke-kanban-board.mjs` | ❌ Wave 0 |
| AI-01 | AI panel lazy loads on first expand | manual-only | Browser interaction test | ❌ Wave 0 |
| AI-06 | AI results cached, no second API call | unit-ish | Check aiAnalysis field in response | ❌ Wave 0 |
| AI-08 | Anthropic API used (not Gemini) | manual-only | Check network tab / log output | N/A |

Note: The project has no automated test infrastructure. All testing is manual smoke tests against the live API. Validation for this phase is observational.

### Sampling Rate
- **Per task commit:** Manual review of changed components in browser
- **Per wave merge:** Run `npm run smoke:all` and verify board loads + drag works
- **Phase gate:** Full smoke test suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/smoke-kanban-board.mjs` — covers BOARD-01 through BOARD-07 (verify board loads, filters work, API returns correct ticket sets)
- No framework install needed — smoke test pattern already established in project

---

## Open Questions

1. **WorkOrdersFilters.tsx category/status enum mismatch**
   - What we know: The file uses `QA_REVIEW` as a status and `CARPENTRY`/`PAINTING`/`CLEANING` as categories — these don't match the Prisma schema (`QA` and `CUSTODIAL_BIOHAZARD`/`IT_AV`)
   - What's unclear: Whether the filter component's categories are passed through to the API or just displayed locally
   - Recommendation: Fix the enum types in `WorkOrdersFilters.tsx` at the start of this phase before building the board, to ensure board filters work correctly

2. **Anthropic API key environment variable name**
   - What we know: The project uses `GEMINI_API_KEY` for Gemini. The Anthropic SDK by default reads `ANTHROPIC_API_KEY`.
   - What's unclear: Whether `ANTHROPIC_API_KEY` is already in `.env` / `.env.local`
   - Recommendation: Add `ANTHROPIC_API_KEY` to `.env` documentation and add a graceful-degrade check at the start of both AI routes (same pattern as `ai-suggest-category` route)

3. **Supabase storage URL accessibility for Anthropic**
   - What we know: Photos are stored in Supabase Storage. The Anthropic API fetches images from URLs server-side.
   - What's unclear: Whether Supabase bucket is configured as public or uses signed URLs that expire
   - Recommendation: In the `ai-diagnose` route, generate fresh signed URLs for the ticket's photos before passing them to Anthropic. This adds ~50ms but ensures Anthropic can fetch them regardless of bucket policy.

---

## Sources

### Primary (HIGH confidence)
- Anthropic official docs `platform.claude.com/docs/en/about-claude/models/overview` — model IDs confirmed: `claude-sonnet-4-5-20250929` (legacy, available), `claude-sonnet-4-6` (latest)
- Anthropic official docs `platform.claude.com/docs/en/build-with-claude/vision` — URL-based image source type confirmed, TypeScript examples verified
- Project codebase: `maintenanceTicketService.ts` — ALLOWED_TRANSITIONS map, transition types
- Project codebase: `schema.prisma` lines 1985–2035 — `aiAnalysis: Json?` field confirmed present, no migration needed
- Project codebase: `ai-suggest-category/route.ts` — graceful degrade pattern for AI routes
- Project codebase: `WorkOrdersTable.tsx`, `WorkOrdersView.tsx` — WorkOrderTicket type confirmed; existing mutation pattern

### Secondary (MEDIUM confidence)
- npm registry via WebSearch: `@dnd-kit/core` v6.3.1, `@anthropic-ai/sdk` v0.78.0 — versions confirmed from npm pages
- LogRocket article `blog.logrocket.com/build-kanban-board-dnd-kit-react/` — multi-container DnD patterns, sensor configuration, collision detection confirmed

### Tertiary (LOW confidence)
- `@dnd-kit/sortable` version — listed as ~7.0.x in various sources; exact version should be verified on install (`npm view @dnd-kit/sortable version`)
- `@dnd-kit/utilities` v3.2.2 — from WebSearch, last published ~2 years ago but no breaking changes expected

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — dnd-kit v6.3.1 and @anthropic-ai/sdk v0.78.0 confirmed from npm; Anthropic model IDs from official docs
- Architecture: HIGH — patterns derived from existing Phase 2 codebase (optimistic mutations, route structure, service layer) + official dnd-kit patterns
- Pitfalls: HIGH — WorkOrdersFilters enum mismatch confirmed by direct file inspection; drag/click conflict is documented dnd-kit pitfall; others from Anthropic official limitations docs
- AI prompt structure: MEDIUM — recommended structure follows Anthropic best practices but actual prompt tuning requires iteration

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable libraries; Anthropic model IDs may change if newer models release)
