# Phase 3: Kanban & AI - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

The maintenance team can manage all tickets visually on a Kanban board with drag-and-drop, and technicians get AI-generated diagnostic help on photo tickets. This phase delivers: Kanban board with dnd-kit (6 main columns + board/list toggle), three role-based views (My Board, Campus Board, All Campuses), drag-to-assign technician panel, AI photo diagnostic panel (Anthropic Claude API), Ask AI free-form troubleshooting, PPE/safety panel for Custodial/Biohazard, and AI result caching. Asset tracking, PM schedules, and labor/cost tracking are Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Kanban Column Layout
- 6 main columns visible: BACKLOG, TODO, IN_PROGRESS, ON_HOLD, QA, DONE
- SCHEDULED and CANCELLED tickets are NOT shown on the board — they live in separate views (SCHEDULED already has its own section from Phase 2; CANCELLED is filtered out)
- Each column header shows ticket count badge: "IN_PROGRESS (4)" — updates live on drag
- Horizontal scroll on smaller screens to accommodate all 6 columns

### Kanban Card Design
- Medium-density cards (~120px tall): ticket #, full title, priority badge (small colored badge with text in top-right: "URGENT", "HIGH", etc.), category tag, location snippet, assigned tech name + avatar, age indicator
- Photo indicator icon if ticket has photos; AI indicator icon if aiAnalysis is cached
- Click card to navigate to full ticket detail page
- Cards use `ui-glass-hover` styling consistent with existing patterns

### Mobile Board Experience
- Horizontal swipe columns — one column fills screen width, swipe left/right between columns
- Column header shows status name + count
- Native mobile Kanban feel (Trello mobile pattern)

### Drag-and-Drop Gate Behavior
- **ON_HOLD drop:** Card visually moves to ON_HOLD column with pending/dimmed state. Hold reason modal appears (same fields as existing HoldReasonInlineForm: reason dropdown + optional note). Cancel reverts card to original column
- **QA drop:** Card visually moves to QA column with pending state. QA completion modal appears (same as existing QACompletionModal: completion photo + completion note required). Cancel reverts card
- **Invalid transitions:** Invalid target columns show red border/X overlay while dragging. On drop attempt, card snaps back with shake animation + toast explaining why ("Cannot skip from BACKLOG to IN_PROGRESS")
- All gate modals reuse existing Phase 2 components (HoldReasonInlineForm, QACompletionModal)

### Drag-to-Assign
- Technician panel/row at the top or side of the board
- Dragging an unassigned ticket onto a technician's avatar assigns them
- Assignment also auto-moves BACKLOG tickets to TODO (same behavior as existing claim/assign)

### Board Views & Navigation
- Tab bar above the board: "My Board" | "Campus Board" | "All Campuses"
- Technicians only see "My Board" tab (shows only their assigned tickets)
- Head/Admin see all three tabs
- "Campus Board" filters to the active campus; "All Campuses" shows cross-campus tickets
- Same page, different data — no route changes between views

### Board vs Table Toggle
- Kanban board replaces the Work Orders table as the default view
- Small toggle icon (grid/list) in the top-right corner lets users switch to the existing table view
- Board is the primary experience — the whole point of Phase 3
- Existing WorkOrdersView.tsx and WorkOrdersTable.tsx are preserved and accessible via toggle

### Board Filters
- Compact filter bar above columns (horizontal row of filter dropdowns/pills)
- Same filter set as existing WorkOrdersFilters: specialty, priority, campus, technician, date range, keyword search, unassigned toggle
- Collapses to a "Filters" button on mobile that opens filter options

### AI Diagnostic Panel
- Collapsible section in the right column of ticket detail page, below the status tracker, above the activity feed
- Collapsed by default with "AI Diagnostics" header + expand chevron
- Lazy-loads Anthropic Claude API call on first expand (AI-01)
- Returns: likely diagnosis, suggested tools, suggested parts/supplies, step-by-step fix (AI-02)
- Confidence indicator badge: Low / Medium / High based on photo clarity (AI-03)
- Labeled "AI Suggestion — always verify on-site" (AI-07)
- Uses Anthropic Claude API, not Gemini (AI-08)

### AI Loading State
- On expand, panel shows skeleton blocks matching final layout (diagnosis block, tools list, parts list, steps section) with `animate-pulse`
- "Analyzing photos..." label visible during load
- Matches existing skeleton loading patterns throughout the app

### Ask AI Integration
- Text input at the bottom of the AI diagnostic panel: "Ask a follow-up question..." with send button
- Available on all tickets (even without photos — user can describe the issue)
- Responses appear inline in the panel below the diagnostic results
- Each conversation turn cached in aiAnalysis JSON (AI-06)

### AI Result Caching
- Results cached in `MaintenanceTicket.aiAnalysis` JSON field (already exists in schema)
- Reopening the same ticket loads cached results — no second API call
- New photos added to the ticket invalidate the cache and trigger re-analysis on next panel expand

### PPE / Safety Panel
- For Custodial/Biohazard category tickets, an amber/yellow warning card auto-appears above the AI diagnostic panel
- Shows required PPE checklist, safety steps, emergency contacts
- Always visible — cannot be collapsed
- Separate from AI suggestions — hard safety requirements, not AI-generated

### Claude's Discretion
- dnd-kit implementation details (sensors, collision detection, drop animation)
- Technician assignment panel exact design (top row vs sidebar)
- Board column widths and responsive breakpoints
- AI prompt engineering for diagnostic quality
- PPE checklist content (specific items per category)
- Filter pill exact styling and layout
- Board/list toggle icon choice and placement
- Ask AI conversation history depth and display format

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkOrdersView.tsx` + `WorkOrdersTable.tsx`: existing filtered table with sort, inline actions, claim mutation — preserved behind board/list toggle
- `WorkOrdersFilters.tsx`: filter bar component with all filters — reuse for board filter bar
- `HoldReasonInlineForm.tsx`: hold reason form — reuse in ON_HOLD gate modal
- `QACompletionModal.tsx`: QA completion modal — reuse in QA gate modal
- `TicketDetailPage.tsx`: ticket detail page — extend with AI diagnostic panel section
- `TicketStatusTracker.tsx`: status progress bar — already in right column
- `TicketActivityFeed.tsx`: activity feed — AI panel goes between status tracker and activity feed
- `maintenanceTicketService.ts`: ALLOWED_TRANSITIONS map — use client-side for valid drop target highlighting
- `maintenanceNotificationService.ts`: notification dispatch — extend for AI-related notifications if needed
- `ImageDropZone.tsx`: file upload component — reuse in QA gate modal on board
- Framer Motion variants in `src/lib/animations.ts` — card entrance, drag animations
- Glassmorphism classes: `ui-glass`, `ui-glass-hover`, `ui-glass-table`

### Established Patterns
- Tab switching: `className={activeTab === 'x' ? 'animate-[fadeIn]' : 'hidden'}` — use for board view tabs
- Optimistic mutations: `onMutate` snapshot + patch, `onError` rollback, `onSettled` invalidate (Phase 2 claim pattern)
- API route pattern: `getOrgIdFromRequest` → `getUserContext` → `assertCan` → `runWithOrgContext`
- `aiAnalysis` is a `Json?` field on MaintenanceTicket — no schema migration needed for AI caching
- Existing AI files use Gemini (`@google/genai`); maintenance AI uses Anthropic — separate service needed
- No `@dnd-kit` in project yet — new dependency to install

### Integration Points
- `TicketDetailPage.tsx`: add collapsible AI diagnostic panel between status tracker and activity feed
- `WorkOrdersView.tsx`: replace as default view with Kanban board + board/list toggle
- New `KanbanBoard.tsx` component with dnd-kit columns
- New `KanbanCard.tsx` component for board cards
- New `AIDiagnosticPanel.tsx` component for AI section
- New `PPESafetyPanel.tsx` component for Custodial/Biohazard warning
- New API route: `POST /api/maintenance/tickets/[id]/ai-diagnose` — Anthropic API call
- New API route: `POST /api/maintenance/tickets/[id]/ai-ask` — free-form question
- New service: `src/lib/services/ai/maintenance-ai.service.ts` — Anthropic SDK integration
- `package.json`: add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@anthropic-ai/sdk`

</code_context>

<specifics>
## Specific Ideas

- Board should feel like Linear or Trello — clean cards, smooth drag animations, instant visual feedback
- Gate modals on drop should feel natural: card moves, modal appears, cancel reverts — no jarring experience
- AI panel should feel like a helpful assistant, not a mandatory step — collapsible, lazy-loaded, clearly labeled as suggestion
- PPE/safety is NOT AI-generated — it's hard safety requirements that always show for hazardous categories
- Mobile swipe columns should feel native — smooth momentum scrolling, column snap-to-center

</specifics>

<deferred>
## Deferred Ideas

- IT Help Desk as second module under "Support" section — future milestone (carried from Phase 1, 2)
- Sidebar badge count for unclaimed matching-specialty tickets — nice-to-have (carried from Phase 2)
- Real-time WebSocket board updates — polling with `?since=` timestamp is sufficient for MVP (PROJECT.md out of scope)
- Knowledge base article surfacing alongside AI diagnosis — Phase 7

</deferred>

---

*Phase: 03-kanban-ai*
*Context gathered: 2026-03-05*
