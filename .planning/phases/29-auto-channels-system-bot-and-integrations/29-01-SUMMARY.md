---
phase: 29-auto-channels-system-bot-and-integrations
plan: 01
subsystem: api
tags: [prisma, messaging, channels, bot, auto-channels]

requires:
  - phase: 24-messaging
    provides: Channel/ChannelMember/Message models, channelService, messageService

provides:
  - sourceType/sourceId fields on Channel model for auto-channel linking
  - isBot field on User model for system bot identification
  - autoChannelService with team/school channel creation and membership sync
  - systemBotService with bot user management and domain-specific message posting
  - Bot user seeded during org registration

affects: [29-auto-channels-system-bot-and-integrations, messaging, teams, schools]

tech-stack:
  added: []
  patterns:
    - "Auto-channel idempotent creation (check sourceType+sourceId before creating)"
    - "Fire-and-forget bot posting (errors logged, never thrown)"
    - "Dynamic import in seedOrgDefaults to avoid circular deps"

key-files:
  created:
    - src/lib/services/autoChannelService.ts
    - src/lib/services/systemBotService.ts
  modified:
    - prisma/schema.prisma
    - src/lib/services/organizationRegistrationService.ts

key-decisions:
  - "Bot email uses @lionheart.internal (non-routable) to prevent impersonation"
  - "Auto-channel sync uses direct prisma calls, not channelService, to bypass permission checks"
  - "Dynamic import of systemBotService in seedOrgDefaults to avoid circular dependency"

patterns-established:
  - "sourceType/sourceId pattern for linking channels to entities"
  - "Fire-and-forget bot messaging with try/catch and logging"

requirements-completed: [INT-01, INT-02, INT-03, INT-04]

duration: 5min
completed: 2026-05-07
---

# Phase 29 Plan 01: Auto-Channels, System Bot, and Schema Foundation Summary

**Schema additions (sourceType/sourceId on Channel, isBot on User), auto-channel service for team/school membership sync, and system bot service for automated messaging**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-07T22:09:31Z
- **Completed:** 2026-05-07T22:14:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Channel model now has optional sourceType and sourceId for auto-channel linking
- User model has isBot boolean for system bot identification
- Auto-channel service handles idempotent creation and membership sync for both teams and schools
- System bot service posts fire-and-forget messages for ticket updates, event approvals, and maintenance alerts
- New orgs automatically get a bot user via seedOrgDefaults

## Task Commits

1. **Task 1: Schema changes + db push** - `f519239` (feat)
2. **Task 2: Auto-channel service + system bot service + seedOrgDefaults** - `62ded1e` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added sourceType, sourceId to Channel; isBot to User
- `src/lib/services/autoChannelService.ts` - Team/school auto-channel creation and membership sync
- `src/lib/services/systemBotService.ts` - Bot user management and domain-specific message posting
- `src/lib/services/organizationRegistrationService.ts` - Added bot user creation to seedOrgDefaults

## Decisions Made
- Bot email uses `bot@lionheart.internal` (non-routable domain) so it cannot be used for login
- Auto-channel sync bypasses channelService permission checks by using prisma directly (bot is a system actor, not a real user with roles)
- Used dynamic import for systemBotService in seedOrgDefaults to avoid potential circular dependency issues

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npx tsc --noEmit` runs out of memory with default heap size (large codebase). Used `NODE_OPTIONS="--max-old-space-size=8192"` to verify. Pre-existing type errors exist in messaging-digest and push-subscription routes (not caused by this plan).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Auto-channel and bot services are ready for integration hooks (plan 02: wiring into team/school/ticket routes)
- Schema is pushed and client regenerated

---
*Phase: 29-auto-channels-system-bot-and-integrations*
*Completed: 2026-05-07*
