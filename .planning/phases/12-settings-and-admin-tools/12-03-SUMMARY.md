---
phase: 12-settings-and-admin-tools
plan: 03
subsystem: ui, api, database
tags: [prisma, nextjs, react, framer-motion, zod, notifications, settings]

# Dependency graph
requires:
  - phase: 12-01
    provides: audit log infrastructure and settings page pattern

provides:
  - NotificationPreference model and per-user notification preference persistence
  - pauseAllNotifications field on User model
  - GET/PATCH /api/settings/organization for org name/slug editing
  - GET/PUT /api/user/notification-preferences for per-type toggles and master pause
  - GitHub-style slug confirmation flow in SchoolInfoTab Branding section
  - NotificationPreferences React component with master pause, group toggles, individual email/in-app toggles
  - notificationService updated to check preferences before creating in-app notifications

affects:
  - Any feature that calls createNotification or createBulkNotifications
  - Settings page profile tab
  - SchoolInfoTab Branding section

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Slug confirmation uses AnimatePresence expandable inline section (not a modal)
    - rawPrisma used for all NotificationPreference queries (not in org-scoped whitelist)
    - Debounced preference saves (1s) with spinner and "Saved" indicator
    - Group toggle sets all types in a module to the same value
    - Master pause check in createNotification uses Promise.all for user + pref lookup

key-files:
  created:
    - prisma/schema.prisma (NotificationPreference model, pauseAllNotifications on User)
    - src/app/api/settings/organization/route.ts (GET/PATCH org name+slug)
    - src/app/api/user/notification-preferences/route.ts (GET/PUT per-user prefs)
    - src/components/NotificationPreferences.tsx (preferences UI component)
  modified:
    - src/lib/services/notificationService.ts (NOTIFICATION_TYPES export, preference checks in createNotification)
    - src/components/settings/SchoolInfoTab.tsx (removed standalone slug field, added slug confirmation in Branding)
    - src/app/settings/page.tsx (added NotificationPreferences section to Profile tab)

key-decisions:
  - "NotificationPreference queries use rawPrisma — model not in org-scoped whitelist in db/index.ts"
  - "Slug confirmation flow is inline expandable section (AnimatePresence) inside Branding section — not a modal"
  - "Slug updates via /api/settings/organization PATCH; org name continues via existing school-info form"
  - "NOTIFICATION_TYPES exported as array from notificationService for validation in preferences API"
  - "createNotification checks pauseAllNotifications and inAppEnabled with Promise.all before creating notification"
  - "Master pause toggle persists on User.pauseAllNotifications; individual prefs in NotificationPreference table"

patterns-established:
  - "Slug confirmation pattern: read-only display with change button, expandable confirmation area with validation"
  - "Toggle component: rounded-full w-10 h-5 with sliding dot, Tailwind only, no external library"
  - "Notification preference groups: Calendar/Maintenance/IT/Compliance/Security/Inventory"
  - "Debounced save pattern for preference panels: 1s delay, visual saving/saved feedback"

requirements-completed: [SET-04, SET-05]

# Metrics
duration: 25min
completed: 2026-03-11
---

# Phase 12 Plan 03: Org Identity Editing and Per-User Notification Preferences Summary

**NotificationPreference model with rawPrisma preference checks in createNotification, GitHub-style inline slug confirmation in Branding section, and grouped notification preference toggles in Profile tab**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-11T15:30:00Z
- **Completed:** 2026-03-11T15:55:00Z
- **Tasks:** 2
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- NotificationPreference Prisma model added with `userId_type` unique constraint, DB pushed successfully
- `pauseAllNotifications` boolean added to User model for master pause
- Organization update API (`GET/PATCH /api/settings/organization`) with slug uniqueness check and audit logging
- Notification preferences API (`GET/PUT /api/user/notification-preferences`) with per-type email/in-app toggles
- `createNotification` updated to respect user preferences via rawPrisma (not org-scoped client)
- Removed standalone slug FloatingInput from School Information form
- Added inline slug confirmation flow in Branding section with real-time validation and AnimatePresence
- Created `NotificationPreferences` component with master pause banner, 6 module groups, group/individual toggles
- Wired NotificationPreferences into the Profile tab in `settings/page.tsx`

## Task Commits

Each task was committed atomically:

1. **Task 1: NotificationPreference schema, org update API, notification preferences API** - `c20495b` (feat)
2. **Task 2: Org slug confirmation UI in Branding and notification preferences UI** - `0116ddf` (feat)

## Files Created/Modified

- `prisma/schema.prisma` - Added NotificationPreference model, pauseAllNotifications on User, relations on Organization and User
- `src/app/api/settings/organization/route.ts` - GET/PATCH for org name and slug with uniqueness check and audit logging
- `src/app/api/user/notification-preferences/route.ts` - GET/PUT for per-user notification preferences
- `src/lib/services/notificationService.ts` - Added NOTIFICATION_TYPES export; updated createNotification to check preferences via rawPrisma
- `src/components/settings/SchoolInfoTab.tsx` - Removed standalone slug input; added inline GitHub-style slug confirmation in Branding section
- `src/components/NotificationPreferences.tsx` - New component: master pause + amber banner, 6 module groups, group/individual email+in-app toggles, debounced save
- `src/app/settings/page.tsx` - Added NotificationPreferences section to Profile tab after Account Security

## Decisions Made

- **rawPrisma for all NotificationPreference ops** — model is not in the org-scoped whitelist in db/index.ts; using org-scoped prisma would not auto-inject organizationId
- **Inline slug confirmation** — Per plan spec, uses AnimatePresence expandable section rather than a modal to keep context and avoid overlay UX
- **Slug still included in school-info PATCH payload** — Form state has the slug, which remains correct after slug changes via the new confirmation flow; SchoolInfoSchema on server still requires it
- **NOTIFICATION_TYPES array exported** — Allows the preferences API to validate incoming type strings without re-declaring them

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Zod `parsed.error.errors` does not exist — correct field is `parsed.error.issues`. Fixed automatically during development.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Org identity editing and notification preferences are complete
- Any future feature calling `createNotification` will automatically respect user preferences
- Phase 12-04 (if any) or phase 13 can proceed
