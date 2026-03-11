---
phase: 14-ai-assistant-ux-upgrade
plan: 02
subsystem: ai
tags: [ai, assistant, tools, weather, inventory, room-availability, open-meteo, gemini]

# Dependency graph
requires:
  - phase: 11-calendar-ticket-and-feature-gaps
    provides: checkRoomConflict exported from eventService
provides:
  - fetchWeatherForecast function for daily forecast by date in weatherService.ts
  - check_room_availability AI tool (uses checkRoomConflict, returns available/conflict JSON)
  - find_available_rooms AI tool (queries Room model via org-scoped prisma)
  - check_resource_availability AI tool (queries InventoryItem.quantityOnHand via prisma)
  - get_weather_forecast AI tool (org lat/lng via rawPrisma + Open-Meteo daily forecast API)
  - scripts/smoke-ai-assistant.mjs for end-to-end tool validation
affects: [14-ai-assistant-ux-upgrade, future-tool-additions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI tool execution handler pattern: async function execute(input, ctx) returning JSON.stringify result"
    - "rawPrisma for org-level lookups (Organization coordinates) inside tool handlers"
    - "prisma (org-scoped) for model queries inside tool handlers (Room, InventoryItem)"

key-files:
  created:
    - scripts/smoke-ai-assistant.mjs
  modified:
    - src/lib/services/weatherService.ts
    - src/lib/services/ai/assistant-tools.ts

key-decisions:
  - "Room model has no capacity field -- find_available_rooms removed capacity filter, min_capacity param accepted but not applied"
  - "InventoryItem uses quantityOnHand not quantity -- fixed in check_resource_availability handler"
  - "executeGetWeatherForecast uses rawPrisma (not prisma) for Organization lookup because Organization is not org-scoped the same way"
  - "check_room_availability has requiredPermission: null -- room availability is public info within the org"

patterns-established:
  - "Tool handler schema validation: check plan-provided interfaces against actual Prisma schema before using field names"
  - "Smoke test SSE parsing: split on double-newline, filter data: prefix, JSON.parse each event, find tool_start events"

requirements-completed: [AI-UX-03, AI-UX-04]

# Metrics
duration: 12min
completed: 2026-03-11
---

# Phase 14 Plan 02: AI Assistant Tools (Room, Weather, Inventory) Summary

**Four new AI assistant tools added: room availability checking via checkRoomConflict, room finding via Room model, inventory stock level via InventoryItem.quantityOnHand, and weather forecasting via Open-Meteo daily API with org coordinates**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-11T13:31:00Z
- **Completed:** 2026-03-11T13:43:03Z
- **Tasks:** 2
- **Files modified:** 3 (weatherService.ts, assistant-tools.ts, smoke-ai-assistant.mjs created)

## Accomplishments
- Extended `weatherService.ts` with `WeatherForecastDay` interface and `fetchWeatherForecast()` function using Open-Meteo daily forecast API
- Added 4 new tools to `TOOL_REGISTRY` in `assistant-tools.ts`: `check_room_availability`, `find_available_rooms`, `check_resource_availability`, `get_weather_forecast`
- Updated `assistant-tools.ts` imports to include both `prisma` (org-scoped) and `rawPrisma` from `@/lib/db`
- Created `scripts/smoke-ai-assistant.mjs` smoke test validating all 4 tools via authenticated SSE chat API calls

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fetchWeatherForecast and 4 new AI assistant tools** - `71cfbb3` (feat)
2. **Task 2: Create smoke test for AI assistant tools** - `72cc760` (feat)

## Files Created/Modified
- `src/lib/services/weatherService.ts` - Added `WeatherForecastDay` interface and `fetchWeatherForecast(lat, lng, targetDate)` function
- `src/lib/services/ai/assistant-tools.ts` - Added rawPrisma import, checkRoomConflict + fetchWeatherForecast imports, 4 new TOOL_REGISTRY entries, 4 execution handler functions
- `scripts/smoke-ai-assistant.mjs` - Smoke test for all 4 new tools via authenticated chat API

## Decisions Made
- `Room` model has no `capacity` field in the actual schema (plan interfaces were aspirational). The `find_available_rooms` tool accepts `min_capacity` parameter but does not filter by it -- filtering by `building_name` still works. This is noted in the tool's handler comment.
- `InventoryItem` uses `quantityOnHand` not `quantity` -- corrected from plan's interface definition.
- `executeGetWeatherForecast` uses `rawPrisma` to look up `Organization.latitude/longitude` because `Organization` is not org-scoped in the same way as other models.
- All 4 new tools have `requiredPermission: null` -- these are informational lookups appropriate for any authenticated user within the org.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Room.capacity field reference**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Plan's interface definition showed `capacity: Int?` on Room model but actual `prisma/schema.prisma` has no `capacity` field on Room
- **Fix:** Removed `capacity` from Room select query and result mapping. The `min_capacity` parameter is accepted but noted as not-applied in a code comment.
- **Files modified:** `src/lib/services/ai/assistant-tools.ts`
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** `71cfbb3` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed InventoryItem.quantity field name**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Plan used `quantity` but actual schema field is `quantityOnHand`
- **Fix:** Changed `quantity: true` to `quantityOnHand: true` in select, and all references in the map/lowStock logic
- **Files modified:** `src/lib/services/ai/assistant-tools.ts`
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** `71cfbb3` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug, schema field mismatches in plan interfaces)
**Impact on plan:** Both auto-fixes were necessary for correct TypeScript compilation and runtime behavior. No scope creep.

## Issues Encountered
- TypeScript caught two field name mismatches between plan-provided interfaces and actual Prisma schema: `Room.capacity` (doesn't exist) and `InventoryItem.quantity` (should be `quantityOnHand`). Both auto-fixed per deviation Rule 1.

## User Setup Required
None - no external service configuration required. Weather uses Open-Meteo (no API key). Organization lat/lng is already a field in the schema; admins can set it via Settings if they want weather forecasts to work.

## Next Phase Readiness
- All 4 new tools are registered in TOOL_REGISTRY and will be surfaced to users with appropriate permissions
- Smoke test at `scripts/smoke-ai-assistant.mjs` can validate tool registration end-to-end (requires dev server + GEMINI_API_KEY)
- Phase 14 plan 03 can build on these tools for improved assistant UX

---
*Phase: 14-ai-assistant-ux-upgrade*
*Completed: 2026-03-11*
