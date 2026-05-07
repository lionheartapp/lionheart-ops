---
phase: 23-schema-permissions-and-rls-foundation
plan: 01
subsystem: database
tags: [prisma, postgres, messaging, schema, multi-tenancy]

# Dependency graph
requires: []
provides:
  - "8 messaging Prisma models (Channel, ChannelMember, Message, MessageReaction, MessageAttachment, MessageMention, MessagingNotificationPreference, PushSubscription)"
  - "ChannelType enum (PUBLIC, PRIVATE, DM, GROUP_DM)"
  - "Organization.messagingEnabled Boolean flag"
  - "Org-scoped and soft-delete registrations in db/index.ts"
affects: [23-02, 23-03, messaging-api, messaging-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Messaging models follow existing org-scoped pattern with cuid() IDs"
    - "MessagingNotificationPreference renamed to avoid collision with existing NotificationPreference model"
    - "ChannelMember uses hard-delete (not soft-delete) for clean membership checks"

key-files:
  created: []
  modified:
    - "prisma/schema.prisma"
    - "src/lib/db/index.ts"

key-decisions:
  - "Renamed NotificationPreference to MessagingNotificationPreference to avoid collision with existing model"
  - "ChannelMember excluded from softDeleteModels per D-10 design (hard delete for membership rows)"

patterns-established:
  - "Phase 23 messaging models grouped with comment blocks in both schema and db/index.ts"

requirements-completed: [SCHEMA-01, SCHEMA-04]

# Metrics
duration: 3min
completed: 2026-05-07
---

# Phase 23 Plan 01: Schema, Permissions, and RLS Foundation Summary

**8 messaging Prisma models with ChannelType enum, messagingEnabled feature flag, and org-scoped + soft-delete registrations**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-07T17:52:03Z
- **Completed:** 2026-05-07T17:54:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- All 8 messaging models added to Prisma schema and validated
- Organization.messagingEnabled Boolean flag added with @default(false)
- All 8 models registered in orgScopedModels; Channel and Message registered in softDeleteModels
- Schema pushed to database successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 8 messaging Prisma models, ChannelType enum, and messagingEnabled flag** - `186f7f8` (feat)
2. **Task 2: Register messaging models in orgScopedModels and softDeleteModels, push schema** - `34e5179` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added ChannelType enum, messagingEnabled on Organization, 8 messaging models with relations
- `src/lib/db/index.ts` - Registered 8 models in orgScopedModels, Channel and Message in softDeleteModels

## Decisions Made
- Renamed plan's "NotificationPreference" to "MessagingNotificationPreference" because a general-purpose NotificationPreference model already exists in the schema (used for event notifications). The messaging version tracks per-channel notification levels and email digest preferences.
- Added `mentionedUser` relation on MessageMention (the plan specified mentionedUserId as a plain String?, but Prisma requires a relation field for the User model's messageMentions array).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed NotificationPreference to MessagingNotificationPreference**
- **Found during:** Task 1 (schema model creation)
- **Issue:** A NotificationPreference model already exists (line 4176) for general notification preferences. Adding a second model with the same name would fail.
- **Fix:** Named the messaging version MessagingNotificationPreference. Updated all relation arrays on Organization, User, and Channel to use the new name.
- **Files modified:** prisma/schema.prisma
- **Verification:** npx prisma validate passes
- **Committed in:** 186f7f8

**2. [Rule 3 - Blocking] Added mentionedUser relation on MessageMention**
- **Found during:** Task 1 (schema validation)
- **Issue:** User model had messageMentions MessageMention[] but MessageMention only had mentionedUserId as a plain String. Prisma requires an opposite relation field.
- **Fix:** Added `mentionedUser User? @relation(fields: [mentionedUserId], references: [id])` to MessageMention.
- **Files modified:** prisma/schema.prisma
- **Verification:** npx prisma validate passes
- **Committed in:** 186f7f8

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for schema validation. No scope creep.

## Issues Encountered
None beyond the deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema foundation is complete for all messaging features
- Plan 02 (permissions seeding) and Plan 03 (RLS policies + triggers) can proceed
- MessagingNotificationPreference name must be used instead of NotificationPreference in all subsequent messaging plans

---
*Phase: 23-schema-permissions-and-rls-foundation*
*Completed: 2026-05-07*
