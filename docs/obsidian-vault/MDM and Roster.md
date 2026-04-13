---
aliases: [MDM, Roster, Phase 2A, Device Management, Student Roster]
tags: [feature, completed, it, mdm]
created: 2026-04-08
---

# MDM & Roster (Phase 2A)

**Status:** COMPLETE (Backend + Frontend)

## Schema Additions

- 6 new enums + 9 new models
- `deviceId` added to ITTicket
- Reverse relations on Org/School/Building/Room/User
- 7 models added to `orgScopedModels`, 2 to `softDeleteModels` (Student, ITDevice)
- 18 new permission constants, 6 role definitions updated

## Backend Services

| Service | Lines | Purpose |
|---------|-------|---------|
| `itDeviceService.ts` | ~430 | Device CRUD, asset tag gen (DEV-XXXX), assignment, bulk import, repairs |
| `studentService.ts` | ~345 | Student CRUD, FERPA-scoped listing, search |
| `studentAuditService.ts` | ~112 | FERPA audit logging via AuditLog model |
| `itLoanerService.ts` | ~225 | Loaner pool, checkout/checkin, overdue |
| `itDeviceIntelligenceService.ts` | ~575 | Lemon detection, repair-vs-replace, [[AI Services|Gemini AI]] recommendations |
| `itSyncJobService.ts` | ~173 | Sync job lifecycle |
| `googleAdminService.ts` | ~419 | Google Admin SDK Chromebook sync (no external deps, crypto for JWT) |
| `rosterSyncService.ts` | ~734 | Clever + ClassLink OneRoster sync, webhooks |

## API Routes (25+)

**Devices:**
- `/api/it/devices` — GET (list), POST (create)
- `/api/it/devices/[id]` — GET, PATCH, DELETE
- `/api/it/devices/[id]/assign` — POST
- `/api/it/devices/[id]/unassign` — POST
- `/api/it/devices/[id]/history` — GET
- `/api/it/devices/[id]/repairs` — GET, POST
- `/api/it/devices/bulk-import` — POST

**Students:**
- `/api/it/students` — GET (FERPA-filtered), POST
- `/api/it/students/[id]` — GET, PATCH, DELETE
- `/api/it/audit/students` — GET (requires `students:audit`)

**Intelligence:**
- `/api/it/intelligence/lemons` — GET
- `/api/it/intelligence/recommendations` — GET
- `/api/it/intelligence/analyze/[deviceId]` — POST

**Loaners:**
- `/api/it/loaners` — GET, checkout (POST), checkin (POST), overdue (GET)

**Sync:**
- `/api/it/sync/configs` — GET, POST
- `/api/it/sync/google/trigger` — POST
- `/api/it/sync/roster/trigger` — POST
- `/api/it/sync/jobs` — GET, GET by ID

**Webhooks:**
- `/api/webhooks/clever` — POST (public)
- `/api/webhooks/classlink` — POST (public)

**Cron:**
- `/api/cron/it-device-tasks` — POST (CRON_SECRET auth)

See [[API Routes#IT Help Desk (82)]] for the full IT route listing.

## Frontend

All frontend components (device management, student roster, loaner pool, sync settings, intelligence widgets) shipped. See [[Components#IT Help Desk (35 files)]].

## Related

- [[IT Help Desk]] — Core ticket system this builds on
- [[AI Services]] — `itDeviceIntelligenceService.ts` for repair/replace recommendations
