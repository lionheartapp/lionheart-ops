---
aliases: [IT, IT Module, Help Desk]
tags: [feature, completed, it]
created: 2026-04-08
---

# IT Help Desk Module

**Status:** COMPLETE (Backend + Frontend)

## Spec Reference

- Source: `/Users/mkerley/Desktop/lionheart-it-spec-v1.1.docx`
- Building Phase 1 (Core tier — free)

## Prisma Schema

| Model | Purpose |
|-------|---------|
| `ITTicket` | 6-status workflow (BACKLOG, TODO, IN_PROGRESS, ON_HOLD, DONE, CANCELLED) |
| `ITTicketCounter` | Auto-increment for IT-XXXX numbers |
| `ITTicketActivity` | Immutable audit log |
| `ITMagicLink` | Hashed tokens, campus-scoped, single-use, time-limited |

**Enums:** ITIssueType, ITPasswordSubType, ITAVSubType, ITTicketStatus, ITPriority, ITHoldReason, ITActivityType, ITTicketSource

**Relations:** Organization, User, Building, Area, Room, School, Campus

**Scoping:** Org-scoped (ITTicket, ITTicketActivity, ITMagicLink). Soft-delete: ITTicket only.

## Permissions

9 new permissions: `IT_TICKET_SUBMIT`, `IT_TICKET_READ_OWN`, `IT_TICKET_READ_ASSIGNED`, `IT_TICKET_READ_ALL`, `IT_TICKET_UPDATE_STATUS`, `IT_TICKET_ASSIGN`, `IT_TICKET_COMMENT_INTERNAL`, `IT_TICKET_COMMENT_SUBMITTER`, `IT_MAGICLINK_GENERATE`

**New roles:** IT_COORDINATOR, SECRETARY
- Admin role gets all IT permissions
- Member/Teacher get: submit, read own, comment submitter
- Viewer gets: read own

## Service (`itTicketService.ts`)

| Function | Purpose |
|----------|---------|
| `generateITTicketNumber(orgId)` | IT-XXXX via ITTicketCounter |
| `createITTicket(input, userId, orgId)` | Authenticated submission |
| `createSubTicket(input, orgId, schoolId?)` | Magic link submission (no user) |
| `transitionITTicketStatus(ticketId, newStatus, data, ctx)` | State machine |
| `assignITTicket(ticketId, assigneeId, ctx)` | Assign + auto-move to TODO |
| `listITTickets(filters, ctx)` | Role-scoped with search |
| `getITTicketDetail(ticketId)` | Full detail with activities |
| `getITBoardData(ctx, schoolId?)` | Kanban columns grouped by status |
| `getITDashboardStats(ctx, schoolId?)` | total, open, inProgress, urgent, recentDone |
| `addITTicketComment(ticketId, content, isInternal, ctx)` | Activity feed comment |

## API Routes

See [[API Routes#IT Help Desk (82)]] for the full route listing.

Key routes:
- `POST/GET /api/it/tickets` — create + list
- `GET/PATCH /api/it/tickets/[id]` — detail + update
- `PATCH /api/it/tickets/[id]/status` — status transitions
- `PATCH /api/it/tickets/[id]/assign` — assign ticket
- `GET/POST /api/it/tickets/[id]/comments` — activity feed
- `GET /api/it/board` — Kanban board data
- `GET /api/it/dashboard` — dashboard stats
- `POST /api/it/magic-links` — generate magic link
- `POST /api/it/tickets/sub` — submit via magic link (no auth)

## AI Integration

See [[AI Services]] for:
- `itAIDiagnosticService.ts` — ticket/device diagnostics
- `itBoardReportService.ts` — board report narrative

## Frontend

See [[Components#IT Help Desk (35 files)]] for the full component list.

Also see [[MDM and Roster]] for device management, student roster, and sync features.
