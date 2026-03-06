---
phase: 03-kanban-ai
verified: 2026-03-06T05:15:00Z
status: passed
score: 16/16 must-haves verified
re_verification: false
---

# Phase 03: Kanban & AI Verification Report

**Phase Goal:** The maintenance team can manage all tickets visually on a Kanban board with drag-and-drop, and technicians get AI-generated diagnostic help on photo tickets
**Verified:** 2026-03-06T05:15:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Maintenance team sees 6 Kanban columns (BACKLOG, TODO, IN_PROGRESS, ON_HOLD, QA, DONE) with ticket cards | VERIFIED | `BOARD_COLUMNS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'ON_HOLD', 'QA', 'DONE']` in KanbanBoard.tsx:31; KanbanColumn.tsx renders each with status label and count badge |
| 2  | Dragging a card to a valid column triggers the status transition API and updates the board immediately | VERIFIED | KanbanBoard.tsx:242 calls `PATCH /api/maintenance/tickets/${id}/status` with optimistic state via `setLocalTickets` before the API call |
| 3  | Invalid drag targets show red visual feedback and card snaps back with toast error | VERIFIED | KanbanColumn.tsx:49 renders `ring-2 ring-red-400 opacity-70`; KanbanBoard.tsx:214 calls `toast(...)` on invalid transition |
| 4  | ON_HOLD drop shows hold reason modal; QA drop shows completion modal; cancel reverts card | VERIFIED | KanbanBoard.tsx:222-231 sets `holdPending`/`qaPending`; renders HoldReasonInlineForm in modal (line 386) and QACompletionModal (line 400); no optimistic move before confirm |
| 5  | Technicians see only My Board tab; Head/Admin see all three tabs | VERIFIED | KanbanBoard.tsx:308 — Campus Board and All Campuses tabs only added when `canManage` is true |
| 6  | Board filters (specialty, priority, campus, technician, date range, keyword, unassigned) filter cards | VERIFIED | WorkOrdersFilters rendered inside KanbanBoard.tsx:326 and wired via `onFilterChange` prop; filter state shared with the ticket query in WorkOrdersView |
| 7  | SCHEDULED tickets do not appear on the board columns | VERIFIED | WorkOrdersView.tsx:124 excludes SCHEDULED from the main query (`buildTicketQueryParams(filters, 'SCHEDULED')`); BOARD_COLUMNS contains no SCHEDULED entry |
| 8  | Users can toggle between Kanban board and existing table view | VERIFIED | WorkOrdersView.tsx:95 `viewMode` state; LayoutGrid/List icons in header (lines 279-299); `viewMode === 'board'` branch renders KanbanBoard, `viewMode === 'table'` renders WorkOrdersTable |
| 9  | When a technician expands the AI Diagnostics panel on a ticket with photos, the Anthropic API is called and returns a diagnosis with tools, parts, and fix steps | VERIFIED | AIDiagnosticPanel.tsx:171 fetches `POST .../ai-diagnose`; ai-diagnose/route.ts:72 calls `analyzeMaintenancePhotos`; response includes likelyDiagnosis, suggestedTools, suggestedParts, steps |
| 10 | The AI panel shows a confidence indicator (Low/Medium/High) based on photo clarity | VERIFIED | AIDiagnosticPanel.tsx:33-48 `ConfidenceBadge` component with HIGH/MEDIUM/LOW colored pill + confidenceReason text |
| 11 | The AI panel is labeled "AI Suggestion — always verify on-site" | VERIFIED | AIDiagnosticPanel.tsx:297 — exact text "AI Suggestion — always verify on-site before beginning work." in amber info bar |
| 12 | Reopening the same ticket loads cached AI results without a second API call | VERIFIED | AIDiagnosticPanel.tsx:152-155 — if `hasCachedDiagnosis && diagnosis`, sets `isCached=true` and returns without fetching; `hasFetchedRef.current` guards subsequent expands |
| 13 | Adding new photos to a ticket invalidates the cached AI analysis | VERIFIED | AIDiagnosticPanel.tsx:132-137 — `photosChanged` computes sorted photo array comparison vs `lastPhotoSnapshot`; ai-diagnose/route.ts:63-68 performs same check server-side |
| 14 | Users can ask free-form follow-up questions via the Ask AI input | VERIFIED | AIDiagnosticPanel.tsx:418-445 — textarea + send button; handleAskSubmit (line 210) posts to `/api/maintenance/tickets/${ticketId}/ai-ask`; conversation thread rendered at line 408 |
| 15 | Custodial/Biohazard tickets auto-show an amber PPE/Safety panel above the AI section | VERIFIED | TicketDetailPage.tsx:776 — `{ticket.category === 'CUSTODIAL_BIOHAZARD' && <PPESafetyPanel />}` rendered before AIDiagnosticPanel (line 784) |
| 16 | The Anthropic Claude API is used (not Gemini) for photo analysis | VERIFIED | maintenance-ai.service.ts:12 `import Anthropic from '@anthropic-ai/sdk'`; model `claude-sonnet-4-5-20250929` (line 25); no Gemini import anywhere in the AI service or routes |

**Score:** 16/16 truths verified

---

### Required Artifacts

| Artifact | Min Lines | Actual | Status | Notes |
|----------|-----------|--------|--------|-------|
| `src/components/maintenance/KanbanBoard.tsx` | 150 | 408 | VERIFIED | DndContext, 6 columns, DragOverlay, gate modals, view tabs, optimistic updates |
| `src/components/maintenance/KanbanColumn.tsx` | 40 | 90 | VERIFIED | useDroppable, SortableContext, valid/invalid ring highlighting |
| `src/components/maintenance/KanbanCard.tsx` | 60 | 161 | VERIFIED | useSortable, priority badge, category tag, location, tech avatar, age/photo/AI indicators |
| `src/components/maintenance/TechnicianAssignPanel.tsx` | 30 | 96 | VERIFIED | Per-tech useDroppable with id=tech-{userId}, emerald highlight on hover |
| `src/lib/maintenance-transitions.ts` | — | 28 | VERIFIED | Client-safe BOARD_ALLOWED_TRANSITIONS + isBoardTransitionAllowed(); no server imports |
| `src/lib/types/maintenance-ai.ts` | — | 33 | VERIFIED | AiDiagnosis, AiConversationTurn, AiAnalysisCache all exported |
| `src/lib/services/ai/maintenance-ai.service.ts` | — | 241 | VERIFIED | analyzeMaintenancePhotos and askMaintenanceAI exported; Anthropic SDK; graceful null returns |
| `src/app/api/maintenance/tickets/[id]/ai-diagnose/route.ts` | — | 105 | VERIFIED | POST with caching, graceful degrade, analyzeMaintenancePhotos call, DB persist |
| `src/app/api/maintenance/tickets/[id]/ai-ask/route.ts` | — | 122 | VERIFIED | POST with Zod validation, conversation history, DB persist, graceful degrade |
| `src/components/maintenance/AIDiagnosticPanel.tsx` | 100 | 455 | VERIFIED | Collapsible panel, lazy-load, skeleton, diagnosis display, Ask AI input, conversation thread |
| `src/components/maintenance/PPESafetyPanel.tsx` | 30 | 88 | VERIFIED | Amber card, 6 PPE items, 4 safety steps, emergency contact; always visible |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `KanbanBoard.tsx` | `/api/maintenance/tickets/[id]/status` | `PATCH` in `onDragEnd` | WIRED | Line 242: `fetchApi(\`/api/maintenance/tickets/${draggedTicket.id}/status\`, { method: 'PATCH', ... })` |
| `KanbanBoard.tsx` | `src/lib/maintenance-transitions.ts` | `isBoardTransitionAllowed` import | WIRED | Line 25: `import { isBoardTransitionAllowed } from '@/lib/maintenance-transitions'` — correctly uses client-safe file, NOT maintenanceTicketService |
| `KanbanBoard.tsx` | `HoldReasonInlineForm.tsx` | Gate modal for ON_HOLD drops | WIRED | Lines 22, 386-396: imported and rendered when `holdPending !== null` |
| `KanbanBoard.tsx` | `QACompletionModal.tsx` | Gate modal for QA drops | WIRED | Lines 23, 400-405: imported and rendered when `qaPending !== null` |
| `WorkOrdersView.tsx` | `KanbanBoard.tsx` | Board/table toggle renders KanbanBoard | WIRED | Line 20 import; line 305-319: `{viewMode === 'board' && <KanbanBoard ... />}` with all props |
| `AIDiagnosticPanel.tsx` | `/api/maintenance/tickets/[id]/ai-diagnose` | `fetch` on first panel expand | WIRED | Line 171: `fetch(\`/api/maintenance/tickets/${ticketId}/ai-diagnose\`, { method: 'POST', ... })` |
| `AIDiagnosticPanel.tsx` | `/api/maintenance/tickets/[id]/ai-ask` | `fetch` on Ask AI submit | WIRED | Line 219: `fetch(\`/api/maintenance/tickets/${ticketId}/ai-ask\`, { method: 'POST', ... })` |
| `ai-diagnose/route.ts` | `maintenance-ai.service.ts` | `analyzeMaintenancePhotos` call | WIRED | Line 22 import; line 72: `const diagnosis = await analyzeMaintenancePhotos({...})` |
| `TicketDetailPage.tsx` | `AIDiagnosticPanel.tsx` | Rendered in right column below status tracker | WIRED | Lines 35, 784-789: imported and rendered with ticketId, photos, category, aiAnalysis props |
| `TicketDetailPage.tsx` | `PPESafetyPanel.tsx` | Conditionally rendered for CUSTODIAL_BIOHAZARD | WIRED | Lines 36, 776-780: `{ticket.category === 'CUSTODIAL_BIOHAZARD' && <PPESafetyPanel />}` rendered above AIDiagnosticPanel |

All 10 key links verified as WIRED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BOARD-01 | 03-01-PLAN | Kanban board displays columns mapping 1:1 to ticket statuses | SATISFIED | 6-column board is default view in WorkOrdersView (viewMode defaults to 'board') |
| BOARD-02 | 03-01-PLAN | Drag-and-drop with role-based validation | SATISFIED | dnd-kit DndContext in KanbanBoard; isBoardTransitionAllowed validates before PATCH |
| BOARD-03 | 03-01-PLAN | "My Board" shows only assigned technician's tickets | SATISFIED | KanbanBoard:117-118 filters by `assignedTo.id === currentUserId` when boardView === 'my-board' |
| BOARD-04 | 03-01-PLAN | "Campus Board" for Head/Admin | SATISFIED | KanbanBoard:120-122 filters by `school.id === activeCampusId`; tab only visible when `canManage` |
| BOARD-05 | 03-01-PLAN | "All Campuses" cross-campus with filtering | SATISFIED | 'all' boardView returns unfiltered displayTickets; tab only visible when `canManage` |
| BOARD-06 | 03-01-PLAN | Cards show ID, title, location, priority badge, category tag, assigned tech, age, photo/AI indicators | SATISFIED | KanbanCard.tsx renders all 8 data points (ticket number, title, priority badge, category tag, building+room, assigned tech/initials avatar, age via formatAge, Camera/Bot icons) |
| BOARD-07 | 03-01-PLAN | Backlog filters: specialty, priority, campus, technician, date range, keyword, unassigned | SATISFIED | WorkOrdersFilters rendered inside KanbanBoard; all filter options present and match Prisma enums |
| BOARD-08 | 03-01-PLAN | SCHEDULED tickets in separate view, not main backlog | SATISFIED | WorkOrdersView excludes SCHEDULED from main query; BOARD_COLUMNS has no SCHEDULED entry |
| AI-01 | 03-02-PLAN | AI diagnostic panel triggered lazily when technician first opens ticket with photos | SATISFIED | AIDiagnosticPanel collapsed by default; fetch only fires on first expand (`hasFetchedRef.current` guard) |
| AI-02 | 03-02-PLAN | AI returns: likely diagnosis, suggested tools, suggested parts/supplies, step-by-step fix | SATISFIED | AIDiagnosticPanel displays all 4 sections from AiDiagnosis response |
| AI-03 | 03-02-PLAN | Confidence indicator (Low/Medium/High) based on photo clarity | SATISFIED | ConfidenceBadge component with colored pills (green/yellow/red) + confidenceReason text |
| AI-04 | 03-02-PLAN | "Ask AI" for free-form questions on any ticket | SATISFIED | Ask AI section in expanded panel; available even when no photos (aiAvailable !== false guard) |
| AI-05 | 03-02-PLAN | PPE/Safety panel auto-shown for Custodial/Biohazard | SATISFIED | TicketDetailPage:776 conditionally renders PPESafetyPanel for CUSTODIAL_BIOHAZARD |
| AI-06 | 03-02-PLAN | AI results cached; does not re-run unless new photos added | SATISFIED | Cache stored in `aiAnalysis` Json field; photo hash comparison in both client and server; `cached: true` returned when valid |
| AI-07 | 03-02-PLAN | Panel labeled "AI Suggestion — always verify on-site" | SATISFIED | Amber disclaimer bar rendered at top of expanded content every time (AIDiagnosticPanel:294-299) |
| AI-08 | 03-02-PLAN | Uses Anthropic Claude API, not Gemini | SATISFIED | `@anthropic-ai/sdk` imported; model `claude-sonnet-4-5-20250929`; zero Gemini imports in AI service or routes |

All 16 requirements satisfied. No orphaned requirements — every BOARD-* and AI-* requirement in REQUIREMENTS.md (Phase 3) is claimed by a plan and verified implemented.

---

### Anti-Patterns Found

| File | Pattern | Severity | Finding |
|------|---------|----------|---------|
| `KanbanBoard.tsx` | Optimistic state | INFO | Component-local `localTickets` state instead of TanStack Query optimistic update — intentional per SUMMARY decision; DnD state is ephemeral, query cache invalidated after every mutation |
| `maintenance-transitions.ts` | Manual sync required | INFO | BOARD_ALLOWED_TRANSITIONS is a plain JS object manually mirrored from `maintenanceTicketService.ts` ALLOWED_TRANSITIONS — no automated sync; deviation from server state is a latent risk, documented in SUMMARY |
| `WorkOrdersView.tsx:117` | localStorage access | INFO | `currentUserId` read from `localStorage` directly; works but not SSR-safe (protected by `typeof window !== 'undefined'` guard) |

No blockers or warnings found. All anti-patterns are INFO level with documented rationale.

---

### Human Verification Required

The following items cannot be verified programmatically and require manual testing:

#### 1. Drag-and-Drop Interaction Feel

**Test:** Open the Work Orders tab (must be logged in as Head of Maintenance). Drag a BACKLOG ticket to the IN_PROGRESS column.
**Expected:** Card moves smoothly, hover highlights column with green ring, card snaps to new column position, toast appears confirming the change, ticket count badges update.
**Why human:** DOM interaction, animation quality, and real-time state update cannot be tested by static code analysis.

#### 2. Gate Modal Cancel Behavior

**Test:** Drag a ticket to the ON_HOLD column, then click Cancel in the hold reason modal.
**Expected:** Ticket stays in its original column; no status change; no API call fired.
**Why human:** Requires user interaction with a modal triggered by a DnD drop event.

#### 3. AI Diagnosis on a Ticket With Photos

**Test:** Ensure `ANTHROPIC_API_KEY` is set. Open a maintenance ticket that has at least one photo. Expand the AI Diagnostics panel.
**Expected:** Loading skeleton appears, then diagnosis shows with likely diagnosis, confidence badge (green/yellow/red), suggested tools list, suggested parts list, and numbered fix steps.
**Why human:** Requires a real Anthropic API call and a ticket with actual photo URLs.

#### 4. AI Cache Invalidation on Photo Upload

**Test:** Open a ticket with a cached AI diagnosis (Cached badge visible). Upload a new photo. Collapse and re-expand the AI panel.
**Expected:** Panel re-fetches from Anthropic (no Cached badge), returns fresh diagnosis incorporating the new photo.
**Why human:** Requires actual photo upload flow and API call sequencing.

#### 5. Mobile Kanban Horizontal Scroll

**Test:** Open Work Orders on a device or DevTools mobile viewport (< lg breakpoint). Observe the board.
**Expected:** Single column fills ~85% viewport width, horizontal swipe moves between columns with snap behavior. "Swipe between columns. Tap a ticket to manage it." notice is visible.
**Why human:** CSS scroll snap behavior requires visual/physical verification on a mobile viewport.

#### 6. PPE Panel Visibility on Biohazard Tickets

**Test:** Open a maintenance ticket with category = Custodial/Biohazard.
**Expected:** Amber PPE & Safety Requirements panel appears immediately above the AI Diagnostics panel, before any user interaction. All 6 PPE items and 4 safety steps are visible.
**Why human:** Requires a real ticket with CUSTODIAL_BIOHAZARD category in the system.

---

### Technical Notes

**Critical deviation handled correctly:** The SUMMARY documents that `maintenanceTicketService.ts` transitively imports `mjml` (which requires Node.js `fs`) — importing it from a client component would break the Next.js bundle. The executor created `src/lib/maintenance-transitions.ts` as a plain JS client-safe mirror. KanbanBoard imports from this file. Verified: no import of `maintenanceTicketService` in KanbanBoard.

**aiAnalysis scalar field delivery:** `TICKET_INCLUDES` in `maintenanceTicketService.ts` only specifies relation includes. Scalar fields (`photos`, `aiAnalysis`, etc.) are returned by default via Prisma's `findUnique` — no explicit include needed. `getTicketDetail` therefore returns `aiAnalysis` correctly without any additional select.

**TypeScript compilation:** `npx tsc --noEmit` passes with zero errors across all 16 new/modified files.

**All 4 commits verified in git log:**
- `dd61157` — feat(03-01): install dnd-kit and build Kanban components
- `0c97bbf` — feat(03-01): wire KanbanBoard into WorkOrdersView with board/table toggle
- `b46b219` — feat(03-02): install Anthropic SDK, create AI types, service, and diagnose/ask routes
- `af58b33` — feat(03-02): add AIDiagnosticPanel, PPESafetyPanel, wire into TicketDetailPage

---

_Verified: 2026-03-06T05:15:00Z_
_Verifier: Claude (gsd-verifier)_
