---
phase: 20-registration-and-public-pages
plan: 03
subsystem: ui
tags: [react, tanstack-query, registration, form-builder, ferpa, typescript]

# Dependency graph
requires:
  - phase: 20-02
    provides: registration-config API (GET/POST/PUT /api/events/projects/[id]/registration-config) and all service layer

provides:
  - useRegistrationForm hook (fetch with null-on-404 for empty state detection)
  - useCreateRegistrationForm mutation hook
  - useUpdateRegistrationForm mutation hook
  - Exported TypeScript interfaces: FormConfig, FormField, FormSection, DiscountCode, RegistrationFormData
  - CommonFieldPicker component: 14-field toggleable grid with FERPA shield indicators on medical fields
  - FormFieldEditor component: type picker, label, help text, placeholder, required toggle, options editor
  - SectionEditor component: title, description, field list, add field, move up/down, remove with confirmation
  - FormBuilder component: two-column orchestrator with section editors, CommonFieldPicker, FormSettingsPanel, save
  - RegistrationTab component: empty state CTA, FormBuilder when form exists, stats row with share link
  - Registration tab wired into EventProjectTabs (9th tab, after People)

affects:
  - 20-04-parent-portal (uses registration form structure)
  - 20-05-staff-dashboard (RegistrationTab is the staff management surface for registration)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Form builder uses local state initialized from server data — all edits local until explicit Save action
    - useRegistrationForm returns null (not error) when 404 — consumer distinguishes no-form from fetch-error
    - CommonFieldPicker exports COMMON_FIELDS constant for reuse in RegistrationTab's default section builder
    - FormSettingsPanel is a sub-component of FormBuilder for settings isolation
    - useToast (project's custom hook) used for save feedback — sonner is not installed

key-files:
  created:
    - src/lib/hooks/useRegistrationForm.ts (TanStack Query hooks + all TypeScript interfaces)
    - src/components/registration/CommonFieldPicker.tsx (14-field toggle grid with FERPA indicators)
    - src/components/registration/FormFieldEditor.tsx (individual field editor with type picker + options)
    - src/components/registration/SectionEditor.tsx (section container with field list + move/remove)
    - src/components/registration/FormBuilder.tsx (main form builder orchestrator)
    - src/components/events/project/RegistrationTab.tsx (tab content for EventProject workspace)
  modified:
    - src/components/events/EventProjectTabs.tsx (added Registration tab after People tab)

key-decisions:
  - "useRegistrationForm catches NOT_FOUND and returns null — allows RegistrationTab to distinguish empty state without throwing"
  - "COMMON_FIELDS exported from CommonFieldPicker for reuse in RegistrationTab default section seeding"
  - "FormSettingsPanel is an inline sub-component of FormBuilder — not a separate file — fits within 800-line limit"
  - "useToast used for save feedback instead of sonner — sonner not installed in this project"
  - "Default section created client-side with alwaysOn common fields when CTA is clicked — form created then caller must PUT sections"

patterns-established:
  - "Local-state form builder: initialize from server on first load, all edits local, explicit save via PUT mutation"
  - "null-on-404 pattern: useRegistrationForm wraps fetchApi and converts NOT_FOUND to null for empty-state differentiation"
  - "Two-column layout: lg:col-span-2 for main content, col-span-1 for sidebar config panel"

requirements-completed: [REG-01, REG-02, REG-03]

# Metrics
duration: 8min
completed: 2026-03-15
---

# Phase 20 Plan 03: Registration Form Builder UI Summary

**Staff-facing form builder with toggleable common fields (FERPA-protected), custom field editor, named section management, payment/capacity settings, and Registration tab wired into the 9-tab EventProject workspace**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-15T12:41:55Z
- **Completed:** 2026-03-15T12:50:00Z
- **Tasks:** 2
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- Full TanStack Query hook layer for registration form: fetch (null-on-404), create, update — with all TypeScript interfaces exported
- Complete form builder component tree: CommonFieldPicker (14 fields with FERPA shield badges) → FormFieldEditor → SectionEditor → FormBuilder orchestrator
- Payment settings panel: base price (cents), deposit percent, max capacity, waitlist toggle, COPPA consent, open/close datetime, discount codes
- RegistrationTab with empty state CTA → form builder view, wired into EventProjectTabs as 9th tab after People

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useRegistrationForm hook and CommonFieldPicker component** - `768f59a` (feat)
2. **Task 2: Create FormFieldEditor, SectionEditor, FormBuilder, and RegistrationTab** - `6b4f5f1` (feat, included with 20-05 portal work by prior agent)

## Files Created/Modified

- `src/lib/hooks/useRegistrationForm.ts` — Three TanStack Query hooks + FormConfig, FormField, FormSection, DiscountCode, RegistrationFormData interfaces
- `src/components/registration/CommonFieldPicker.tsx` — 14-field toggle grid; alwaysOn fields disabled; FERPA shield on 7 medical/emergency fields; exports COMMON_FIELDS constant
- `src/components/registration/FormFieldEditor.tsx` — Type picker (TEXT/DROPDOWN/CHECKBOX/NUMBER/DATE/FILE), label input, collapsible help text and placeholder, required toggle, dynamic options editor for DROPDOWN/CHECKBOX, remove button
- `src/components/registration/SectionEditor.tsx` — Title input, collapsible description, FormFieldEditor list, add custom field, move up/down arrows, two-click remove confirmation
- `src/components/registration/FormBuilder.tsx` — Two-column layout: section editors (2/3) + CommonFieldPicker + FormSettingsPanel (1/3); common field toggle syncs to first section; full payment/capacity/dates/discounts settings; save via useUpdateRegistrationForm
- `src/components/events/project/RegistrationTab.tsx` — Empty state with ClipboardList icon and Set Up Registration CTA; FormBuilder when form exists; stats row showing registrations / waitlisted / share link
- `src/components/events/EventProjectTabs.tsx` — Added Registration tab (ClipboardList icon) after People; updated TabId union type; added case in renderTab()

## Decisions Made

- useRegistrationForm catches NOT_FOUND errors and returns null — allows RegistrationTab to show empty state without treating 404 as an error condition
- COMMON_FIELDS exported from CommonFieldPicker so RegistrationTab can build the default "Participant Information" section with alwaysOn fields when creating a new form
- FormSettingsPanel is defined as an inline sub-component within FormBuilder — single cohesive module, within 800-line limit
- Used project's `useToast` hook for save success/error feedback (sonner is not installed in this project)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Alignment] Used useToast instead of sonner for toast notifications**
- **Found during:** Task 2 (FormBuilder save feedback implementation)
- **Issue:** Plan specified `sonner` for toasts but sonner is not installed in the project (ShareHub.tsx in project directory also has pre-existing sonner import errors)
- **Fix:** Used `useToast` from `@/components/Toast` (the project's own toast system) for save success and error feedback
- **Files modified:** `src/components/registration/FormBuilder.tsx`, `src/components/events/project/RegistrationTab.tsx`
- **Verification:** TypeScript compiles without errors in new files
- **Committed in:** 6b4f5f1

---

**Total deviations:** 1 auto-fixed (Rule 1 alignment)
**Impact on plan:** No scope change — toast behavior is identical, just using the project's existing system.

## Issues Encountered

- Pre-existing `ShareHub.tsx` in `src/components/events/project/` uses `sonner` import which is not installed — causes TypeScript errors unrelated to our changes. Logged to `deferred-items.md` in phase directory.
- Pre-existing test error in `__tests__/lib/assistant-prompt.test.ts:158` also noted — logged to `deferred-items.md`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All form builder components are in place — staff can configure registration forms via the EventProject workspace Registration tab
- RegistrationTab correctly shows empty state until a form is created, then shows FormBuilder
- The PUT /api/events/projects/[id]/registration-config endpoint is complete from Plan 02 — save button is wired end-to-end
- Plan 20-04 (parent portal) can use the form structure and the public register endpoint built in Plan 02
- Plan 20-05 (staff dashboard) can use the registration counts from the same API

---
*Phase: 20-registration-and-public-pages*
*Completed: 2026-03-15*
