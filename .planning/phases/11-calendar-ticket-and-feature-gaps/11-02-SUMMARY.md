---
phase: 11-calendar-ticket-and-feature-gaps
plan: 02
subsystem: api
tags: [tickets, prisma, supabase-storage, file-upload, search, comments]

# Dependency graph
requires:
  - phase: 02-core-tickets
    provides: Ticket model and ticketService foundation
provides:
  - TicketComment Prisma model with cascade delete on Ticket
  - TicketAttachment Prisma model with Supabase Storage integration
  - GET/PUT/DELETE /api/tickets/[id] individual ticket route
  - GET/POST /api/tickets/[id]/comments for ticket comments
  - GET/POST /api/tickets/[id]/attachments for file uploads
  - Keyword search across ticket title and description via ?search= param
  - Ticket creators can access their own tickets (access check fix)
affects: [calendar-ticket-and-feature-gaps, future ticket UI components]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Ticket sub-resource routes (comments, attachments) guard access via parent getTicketById
    - Base64 file upload to Supabase Storage bucket ticket-attachments
    - Nested AND/OR Prisma where for composing search with access-control filtering

key-files:
  created:
    - src/app/api/tickets/[id]/route.ts
    - src/app/api/tickets/[id]/comments/route.ts
    - src/app/api/tickets/[id]/attachments/route.ts
    - src/lib/services/ticketCommentService.ts
    - src/lib/services/ticketAttachmentService.ts
  modified:
    - prisma/schema.prisma
    - src/lib/services/ticketService.ts
    - src/app/api/tickets/route.ts

key-decisions:
  - "TicketComment and TicketAttachment not added to org-scoped extension — security via parent Ticket being org-scoped"
  - "Attachment uploads use base64 JSON body (not multipart) for consistency with existing API patterns"
  - "ticket-attachments Supabase bucket created as public — file URLs embedded in DB records"
  - "Search uses nested AND wrapper to avoid overwriting access-control OR clause in listTickets"
  - "Sub-resource routes guard access via getTicketById before operating — single point of access control enforcement"

patterns-established:
  - "Sub-resource access: always call parent getTicketById before touching comments/attachments"
  - "File validation errors from service layer: caught in route and returned as 400 VALIDATION_ERROR"

requirements-completed: [TIX-02, TIX-03]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 11 Plan 02: Ticket Comments, Attachments, Individual Route, and Keyword Search Summary

**TicketComment and TicketAttachment models with Supabase Storage, GET/PUT/DELETE /api/tickets/[id], and keyword search via ?search= param across title and description.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T22:04:38Z
- **Completed:** 2026-03-10T22:08:06Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added TicketComment and TicketAttachment Prisma models with cascade delete, synced to DB via db:push
- Fixed getTicketById to allow ticket creators (not just assignees) to access their own tickets, with full comments/attachments include
- Created GET/PUT/DELETE /api/tickets/[id] individual ticket route following standard pattern
- Created ticketCommentService and ticketAttachmentService with Zod validation, HTML sanitization, and Supabase Storage upload
- Created GET/POST /api/tickets/[id]/comments and GET/POST /api/tickets/[id]/attachments routes with access guards
- Wired keyword search (title OR description) through ListTicketsSchema and tickets/route.ts GET handler
- Created ticket-attachments Supabase Storage bucket (public)

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema additions and ticket [id] route with search** - `85e3b50` (feat)
2. **Task 2: Comment and attachment services + API routes** - `2ad0c7b` (feat)

## Files Created/Modified

- `prisma/schema.prisma` - Added TicketComment and TicketAttachment models, User and Ticket relations
- `src/lib/services/ticketService.ts` - Fixed getTicketById access check, added search param to ListTicketsSchema
- `src/app/api/tickets/route.ts` - Wired search param to listTickets call
- `src/app/api/tickets/[id]/route.ts` - New: GET/PUT/DELETE for individual ticket
- `src/lib/services/ticketCommentService.ts` - New: listComments and createComment with HTML sanitization
- `src/lib/services/ticketAttachmentService.ts` - New: listAttachments and createAttachment with MIME/size validation and Supabase Storage upload
- `src/app/api/tickets/[id]/comments/route.ts` - New: GET/POST with parent ticket access guard
- `src/app/api/tickets/[id]/attachments/route.ts` - New: GET/POST with parent ticket access guard and file validation errors -> 400

## Decisions Made

- **TicketComment/TicketAttachment not org-scoped in db extension** — security comes from parent Ticket being org-scoped; always filtered by ticketId
- **Base64 JSON body for attachments** — consistent with existing API patterns, avoids multipart complexity
- **ticket-attachments bucket created as public** — file URLs embedded directly in DB records, consistent with campus-images bucket pattern
- **Nested AND/OR for search** — the access-control OR clause in listTickets must not be overwritten; search OR is wrapped inside AND to compose correctly
- **Sub-resource access via getTicketById** — single point of access control enforcement for comments and attachments routes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The ticket-attachments Supabase bucket was created programmatically during execution.

## Next Phase Readiness

- Ticket comments and attachments are now fully functional at the API level
- Individual ticket route (GET/PUT/DELETE) provides foundation for future ticket detail UI
- Keyword search is ready for frontend wiring via ?search= query parameter
- Ready for plan 11-03 and subsequent plans in phase 11

---
*Phase: 11-calendar-ticket-and-feature-gaps*
*Completed: 2026-03-10*
