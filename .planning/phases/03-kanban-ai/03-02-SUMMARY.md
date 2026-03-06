---
phase: 03-kanban-ai
plan: 02
subsystem: maintenance-ai
tags: [ai, anthropic, claude, diagnostics, maintenance, vision]
dependency_graph:
  requires: [03-01]
  provides: [ai-diagnostic-panel, ppe-safety-panel, ai-diagnose-route, ai-ask-route]
  affects: [TicketDetailPage, maintenance-ticket-detail]
tech_stack:
  added: ["@anthropic-ai/sdk", "claude-sonnet-4-5-20250929"]
  patterns:
    - "AI service wrapper (analyzeMaintenancePhotos, askMaintenanceAI)"
    - "Lazy-load AI panel (collapsed by default, fetch on expand)"
    - "Cache invalidation via photo snapshot comparison"
    - "Graceful degrade pattern (available: false when no API key)"
    - "Conversation history appended to JSON cache field"
key_files:
  created:
    - src/lib/types/maintenance-ai.ts
    - src/lib/services/ai/maintenance-ai.service.ts
    - src/app/api/maintenance/tickets/[id]/ai-diagnose/route.ts
    - src/app/api/maintenance/tickets/[id]/ai-ask/route.ts
    - src/components/maintenance/AIDiagnosticPanel.tsx
    - src/components/maintenance/PPESafetyPanel.tsx
  modified:
    - src/components/maintenance/TicketDetailPage.tsx
    - package.json
decisions:
  - "Anthropic claude-sonnet-4-5 model used (not Gemini) per project decision AI-08"
  - "Cache stored in existing MaintenanceTicket.aiAnalysis Json? field — no schema change needed"
  - "Photo invalidation uses sorted array string comparison for simplicity and correctness"
  - "Ask AI input available on all tickets even without photos — user can describe issue in text"
  - "First Ask AI message includes ticket photos as visual context for grounded responses"
  - "MAINTENANCE_CLAIM permission guards both AI routes (technicians + heads)"
metrics:
  duration: "~18 minutes"
  completed_date: "2026-03-06"
  tasks_completed: 2
  files_created: 6
  files_modified: 2
---

# Phase 03 Plan 02: AI Diagnostics for Maintenance Tickets Summary

**One-liner:** Anthropic Claude vision diagnostics with lazy-load panel, PPE safety panel for biohazard tickets, and persistent conversation cache in ticket detail.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install Anthropic SDK, create AI types, service layer, and API routes | b46b219 | maintenance-ai.ts, maintenance-ai.service.ts, ai-diagnose/route.ts, ai-ask/route.ts |
| 2 | Create AIDiagnosticPanel, PPESafetyPanel, wire into TicketDetailPage | af58b33 | AIDiagnosticPanel.tsx, PPESafetyPanel.tsx, TicketDetailPage.tsx |

## What Was Built

### AI Types (`src/lib/types/maintenance-ai.ts`)
Three exported interfaces:
- `AiDiagnosis` — diagnosis result with confidence (LOW/MEDIUM/HIGH), tools, parts, steps
- `AiConversationTurn` — single user/assistant message with timestamp
- `AiAnalysisCache` — stored in `MaintenanceTicket.aiAnalysis` (Json?); contains diagnosis, conversation, and lastPhotoSnapshot for invalidation

### Anthropic AI Service (`src/lib/services/ai/maintenance-ai.service.ts`)
- `analyzeMaintenancePhotos()` — sends photo URLs + diagnostic prompt to claude-sonnet-4-5, returns structured `AiDiagnosis` or null on failure
- `askMaintenanceAI()` — multi-turn conversation with ticket context; includes photos on first message for visual grounding
- Gracefully returns null on any API or JSON parse failure

### POST /api/maintenance/tickets/[id]/ai-diagnose
- Requires `MAINTENANCE_CLAIM` permission
- Returns `{ available: false }` if `ANTHROPIC_API_KEY` is not set
- Returns `{ reason: 'no-photos' }` if ticket has no photos
- Checks photo hash vs `lastPhotoSnapshot` — returns cached result with `cached: true` if photos unchanged
- On cache miss: calls Anthropic, updates `aiAnalysis` in DB, returns fresh diagnosis

### POST /api/maintenance/tickets/[id]/ai-ask
- Requires `MAINTENANCE_CLAIM` permission
- Validates body with Zod (1–1000 chars)
- Loads existing conversation history from `aiAnalysis` cache
- Appends `user` + `assistant` turns, persists updated cache to DB
- Returns updated full conversation array

### PPESafetyPanel (`src/components/maintenance/PPESafetyPanel.tsx`)
- Static amber card — always visible, not collapsible
- 6 PPE checklist items with check icons
- 4-step safety protocol with numbered badges
- Emergency contact reminder
- Shown only for `CUSTODIAL_BIOHAZARD` category tickets

### AIDiagnosticPanel (`src/components/maintenance/AIDiagnosticPanel.tsx`)
- Collapsed by default with Bot icon + "AI Diagnostics" header
- "Cached" badge shown in header when cached diagnosis exists
- On first expand: fires `POST .../ai-diagnose`; subsequent expands use local state
- Loading: skeleton with animated pulse matching final layout shape
- Diagnosis display: likely diagnosis card, colored confidence badge, tools list, parts list, numbered steps
- "AI Suggestion — always verify on-site" amber disclaimer at top of expanded panel
- Ask AI section at bottom: textarea + send button (Enter to submit, Shift+Enter for newline)
- Conversation thread: user bubbles right-aligned (emerald), AI bubbles left-aligned (gray)
- "AI diagnostics not configured" fallback when API returns `available: false`
- "Upload photos to enable AI diagnosis" message when no photos

### TicketDetailPage Integration
- Imports `AIDiagnosticPanel`, `PPESafetyPanel`, `AiAnalysisCache`
- Added `aiAnalysis?: unknown | null` to `MaintenanceTicket` interface
- Right column order: Status Tracker → Actions → QA Review → PPESafetyPanel (biohazard only) → AIDiagnosticPanel → Activity Feed

## Requirements Satisfied

All 8 AI requirements met:
- AI-01: Panel collapses by default, API called only on first expand
- AI-02: Diagnosis shows likely diagnosis, tools, parts, step-by-step fix
- AI-03: Confidence badge with LOW/MEDIUM/HIGH colored pills + reason text
- AI-04: Free-form Ask AI input with inline conversation thread
- AI-05: PPESafetyPanel auto-shown for CUSTODIAL_BIOHAZARD category
- AI-06: Cached results loaded from `aiAnalysis`; new photos invalidate cache
- AI-07: "AI Suggestion — always verify on-site" disclaimer visible in expanded panel
- AI-08: Anthropic Claude SDK used, not Gemini

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All 6 created files confirmed on disk. Both task commits (b46b219, af58b33) confirmed in git log.
