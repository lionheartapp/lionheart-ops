---
aliases: [Features, Shipped Features]
tags: [feature, completed]
created: 2026-04-08
---

# Completed Features

## Notifications & Communication

- **NotifyAttendeesDialog wiring** — `notify` boolean passes through `CalendarView -> useDragReschedule -> useCalendar -> PUT /api/calendar-events/[id]`. When `notify=true`, creates in-app Notification rows for attendees and sends email via Resend.
- **In-app notification system** — `Notification` model (org-scoped), `notificationService.ts`, 4 [[API Routes|API routes]] (`/api/notifications/*`), `NotificationBell.tsx` in header. Polls unread count every 30s.

## Global Search

- `GET /api/search?q=` searches users/events/tickets/buildings in parallel. [[Components#SearchCommand]] Cmd+K dialog with keyboard navigation. Wired into `DashboardLayout.tsx`.

## Add-ons System

- `AddOnsTab.tsx` with module registry, toggle switch wired to `POST /api/modules`. Sidebar conditionally shows Athletics nav when enabled. Athletics page shell at `/athletics` with [[Components#ModuleGate]].

## Athletics (Phases 4-6)

- **Phase 4 — Tournaments** — Tournament CRUD, single elimination bracket generation (byes, auto-advance), round robin (circle scheduling), SVG bracket viz (`SingleEliminationBracket.tsx`), `RoundRobinGrid.tsx` with standings, `MatchResultDialog` for winner selection, `TournamentDetail` orchestrator, `TournamentsSection` list/detail. Double elim & pool play use simple grouped-match list for now.
- **Phase 5 — Rosters, Stats & Public Schedule** — `AthleticRoster` model (players on teams, optional User link), `PlayerGameStat` (key-value per-player per-game), `SportStatConfig` (dynamic stat categories per sport). Roster tab with CRUD, `PlayerStatsDialog` for entering stats after games (grid: players x stat categories), `StatsSection` with standings/leaders/config views. Public athletics page at `/athletics/public/[slug]` (no auth). 2 new permissions: `athletics:roster:manage`, `athletics:stats:manage`.
- **Phase 6 — Overview Dashboard** — `AthleticsDashboard.tsx` with summary stats row, upcoming games, recent results, standings table, weekly schedule, quick actions. API at `/api/athletics/dashboard?campusId=`. Overview is now the default tab.

See [[Components#Athletics (19 files)]] for the full component list.

## Export Schedule Drawer

Replaced redundant 4-option Print dropdown with single "Export" button that opens a configuration drawer.

- `src/lib/types/event-project.ts` — shared `BlockTypeConfig` interface
- `src/lib/utils/scheduleExportHtml.ts` — pure HTML generation with multi-day page breaks, audience filtering, detail toggling
- `src/components/events/ExportScheduleDrawer.tsx` — [[Components#DetailDrawer]] with day chips, staff/attendee audience cards, attendee customization (block type checkboxes, detail toggle switches)
- `SchedulePrintView.tsx` deleted, `SchedulePrintDropdown` removed from EventScheduleTab
