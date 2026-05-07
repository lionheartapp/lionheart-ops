---
phase: 23-schema-permissions-and-rls-foundation
plan: 03
subsystem: database
tags: [postgres, rls, triggers, tsvector, messaging, security]

# Dependency graph
requires:
  - "23-01: 8 messaging Prisma models must exist in database"
provides:
  - "RLS policies on all 8 messaging tables (org isolation + channel membership)"
  - "JWT claim helper functions (messaging_org_id, messaging_user_id)"
  - "Unread counter triggers (increment on insert, reset on read)"
  - "tsvector auto-populate trigger with GIN index for full-text search"
affects: [messaging-api, messaging-realtime, messaging-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RLS helper functions use SECURITY DEFINER to avoid circular policy dependencies"
    - "BEFORE UPDATE trigger for reset-on-read (modifies NEW directly, avoids second write)"
    - "ChannelMember SELECT uses org-only check to break circular RLS with Channel"

key-files:
  created:
    - "prisma/migrations/messaging_rls_and_triggers.sql"
  modified: []

key-decisions:
  - "Used MessagingNotificationPreference table name (per Plan 01 rename) instead of NotificationPreference"
  - "ChannelMember SELECT policy uses org-only check (no self-referential join) to avoid circular RLS"
  - "Reset-on-read trigger uses BEFORE UPDATE (not AFTER) for efficiency"

patterns-established:
  - "RLS policy naming: lowercase tablename + operation (e.g. channel_select, message_insert)"
  - "JWT claim helpers prefixed with messaging_ to namespace away from other RLS functions"

requirements-completed: [SCHEMA-02, SCHEMA-05, SCHEMA-06]

# Metrics
duration: 1min
completed: 2026-05-07
---

# Phase 23 Plan 03: RLS Policies, Unread Triggers, and tsvector Search Summary

**RLS org+channel isolation on 8 messaging tables, unread counter triggers, and GIN-indexed tsvector for full-text search**

## Performance

- **Duration:** 1 min
- **Started:** 2026-05-07T17:56:50Z
- **Completed:** 2026-05-07T17:57:52Z
- **Tasks:** 1 auto + 1 checkpoint
- **Files modified:** 1

## Accomplishments
- 25 RLS policies across 8 messaging tables with org isolation and channel membership enforcement
- Unread counter increment trigger on Message INSERT (excludes author) and reset on ChannelMember.lastReadAt update
- tsvector auto-populate trigger with GIN index for performant full-text message search
- JWT helper functions (messaging_org_id, messaging_user_id) with SECURITY DEFINER

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RLS policies, triggers, and GIN index SQL migration** - `1c3c3e6` (feat)
2. **Task 2: Human verification checkpoint** - not committed (checkpoint: verify in Supabase Dashboard)

## Files Created/Modified
- `prisma/migrations/messaging_rls_and_triggers.sql` - RLS helper functions, 25 policies for 8 tables, 3 triggers, GIN index

## Decisions Made
- Used MessagingNotificationPreference (renamed in Plan 01) for all RLS policy references
- Policy naming uses abbreviated prefix for MessagingNotificationPreference (msgnotifpref_*) to keep names reasonable

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated NotificationPreference references to MessagingNotificationPreference**
- **Found during:** Task 1 (SQL file creation)
- **Issue:** Plan SQL examples used "NotificationPreference" but Plan 01 renamed the table to "MessagingNotificationPreference"
- **Fix:** Used "MessagingNotificationPreference" for all ALTER TABLE and CREATE POLICY statements
- **Files modified:** prisma/migrations/messaging_rls_and_triggers.sql
- **Verification:** grep confirms 6 references to MessagingNotificationPreference, 0 standalone NotificationPreference
- **Committed in:** 1c3c3e6

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Table name correction required for SQL to execute against actual schema. No scope creep.

## Checkpoint Pending

**Task 2 (human-verify):** SQL migration needs to be executed against the Supabase database and verified in the Dashboard. The orchestrator will present this checkpoint.

Verification steps:
1. Execute `prisma/migrations/messaging_rls_and_triggers.sql` against the database
2. Confirm RLS enabled on all 8 tables in Supabase Dashboard > Database > Policies
3. Run trigger check: `SELECT tgname FROM pg_trigger WHERE tgname LIKE 'message%' OR tgname LIKE 'channelmember%';`
4. Run index check: `SELECT indexname FROM pg_indexes WHERE indexname = 'Message_searchVector_idx';`

## Issues Encountered
None.

## User Setup Required
SQL migration file must be executed against the Supabase database before messaging features can use RLS. Use Supabase SQL Editor or `psql "$DIRECT_URL" -f prisma/migrations/messaging_rls_and_triggers.sql`.

## Next Phase Readiness
- RLS foundation complete for all messaging tables
- Phase 25 realtime token endpoint must produce JWT claims matching `organizationId` and `userId` keys
- Messaging API routes get belt-and-suspenders security: Prisma org-scoping + RLS

## Self-Check: PASSED

- FOUND: prisma/migrations/messaging_rls_and_triggers.sql
- FOUND: .planning/phases/23-schema-permissions-and-rls-foundation/23-03-SUMMARY.md
- FOUND: commit 1c3c3e6

---
*Phase: 23-schema-permissions-and-rls-foundation*
*Completed: 2026-05-07*
