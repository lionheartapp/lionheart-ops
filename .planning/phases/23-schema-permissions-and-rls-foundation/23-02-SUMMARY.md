---
phase: 23-schema-permissions-and-rls-foundation
plan: 02
subsystem: permissions
tags: [messaging, permissions, rbac, phase-23]
dependency_graph:
  requires: []
  provides: [messaging-permission-constants, role-permission-mappings]
  affects: [organizationRegistrationService-syncRolePermissions]
tech_stack:
  added: []
  patterns: [permission-constant-definition, role-permission-matrix]
key_files:
  created: []
  modified:
    - src/lib/permissions.ts
decisions:
  - "Reuse INTEGRATIONS_MANAGE for messaging integration permission instead of creating duplicate"
  - "Admin/head-of-schools/principal get full moderation; operational staff get create+DMs; restricted roles get nothing"
metrics:
  duration: "103s"
  completed: "2026-05-07"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
---

# Phase 23 Plan 02: Messaging Permission Constants Summary

5 new MESSAGING_* permission constants added to PERMISSIONS object and mapped to all 15 roles per the D-02 permission matrix.

## What Was Done

### Task 1: Add messaging permission constants (98a097e)
Added 5 new constants to the PERMISSIONS object before the wildcard entry:
- `MESSAGING_CHANNELS_CREATE` ('channels:create')
- `MESSAGING_CHANNELS_MANAGE` ('channels:manage')
- `MESSAGING_CHANNELS_MODERATE` ('channels:moderate')
- `MESSAGING_MESSAGES_DELETE_ANY` ('messages:delete:any')
- `MESSAGING_DMS_SEND` ('dms:send')

Reused existing `INTEGRATIONS_MANAGE` for the 6th permission string (no duplication).

### Task 2: Map permissions to roles (d7b179b)
- **Full moderation** (all 5): admin, head-of-schools, principal
- **Create + DMs** (2): member, teacher, athletic-director, coach, maintenance-head, maintenance-technician, it-coordinator, secretary
- **No messaging**: viewer, student-technician, board-member, parent

## Verification Results

| Check | Expected | Actual |
|-------|----------|--------|
| MESSAGING_CHANNELS_CREATE grep count | 12 | 12 |
| MESSAGING_DMS_SEND grep count | 12 | 12 |
| MESSAGING_CHANNELS_MODERATE grep count | 4 | 4 |
| MESSAGING_MESSAGES_DELETE_ANY grep count | 4 | 4 |
| integrations:manage string count | 1 | 1 |
| Viewer MESSAGING_ count | 0 | 0 |
| Student-technician MESSAGING_ count | 0 | 0 |
| Board-member MESSAGING_ count | 0 | 0 |
| Parent MESSAGING_ count | 0 | 0 |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Mitigations

- T-23-03 (Elevation of Privilege): Verified viewer, board-member, parent, student-technician excluded from messaging permissions via grep counts
- T-23-04 (Elevation of Privilege): Confirmed INTEGRATIONS_MANAGE reused, not duplicated (1 string occurrence)

## Self-Check: PASSED
