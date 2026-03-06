# Phase 1: Foundation - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

The maintenance module exists in the platform as a gated add-on with all Prisma models, permissions, and navigation in place, ready for feature development. This phase delivers: schema (9 models), org-scope registration, permissions seeding, module gate toggle, sidebar navigation, and two landing page shells (maintenance team command center + teacher "My Requests" view). No actual ticket CRUD or business logic — that's Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Module Scope & Gating
- Per-campus toggle (like Athletics) — uses `scope: 'campus'` in MODULE_REGISTRY
- Head of Maintenance sees a unified cross-campus view by default, with a campus filter dropdown to narrow down
- Any authenticated user with the module enabled can see the Maintenance sidebar section — permission system controls what they can do inside
- Any authenticated user can submit maintenance requests (no special `maintenance:submit` permission needed — lowest friction)

### Dashboard Shell Layout
- Compact command center style — dense, information-rich single screen for Head of Maintenance
- Full monitoring layout with 7+ panels ready from Phase 1:
  - Tickets by Status (mini bars)
  - Urgent/Overdue Alerts
  - Campus Breakdown
  - Technician Workload
  - Recent Activity feed
  - PM Calendar Preview
  - Cost Summary
  - Compliance Status
- All panels show skeleton placeholder structure with zero-count stat cards, empty chart frames, and "No data yet" labels — user can see what it WILL look like
- Teacher/Staff "My Requests" view also gets a shell in Phase 1 (empty list + "Submit Request" CTA)

### Permission Design
- Role-based tiers with ~8-10 permission strings:
  - Head of Maintenance: full control (assign, approve QA, cancel, manage assets, view analytics, manage PM)
  - Technician: work on assigned tickets, self-claim, log labor, view diagnostics
  - Staff/Teacher: submit tickets, view own tickets, comment on own tickets
- Dedicated `maintenance-head` role added to DEFAULT_ROLES (separate from platform `admin` — a maintenance head manages the maintenance team but may not be a platform admin)
- Technician role handling: Claude's Discretion (dedicated role vs member + team membership)
- No special permission required for basic ticket submission — any authenticated user can submit

### Sidebar & Navigation
- "Support" text header/divider separates main nav items from maintenance-related items — no icon on the section header
- Role-adaptive nav items under "Support" header:
  - Teachers/Staff see: "Facilities" (one link → My Requests view)
  - Maintenance Head sees: "Facilities" (→ command center dashboard), "Work Orders" (→ ticket list)
  - Technicians see: "Facilities" (→ assigned work view), "My Requests" (→ own submissions)
- Each nav item gets a small icon (consistent with existing sidebar style)
- No secondary sidebar panel — all sub-sections use in-page tabs (like Athletics)
- Route: `/maintenance` for the main page, role determines default view/tab

### Claude's Discretion
- Technician role implementation (dedicated `maintenance-technician` role vs `member` + Facility Maintenance team membership)
- Specific icons for each nav item (Wrench, ClipboardList, FileText, etc.)
- Panel arrangement/grid layout in the command center
- Loading skeleton exact design within panels
- Color theme for Maintenance module in MODULE_REGISTRY (gradient, accent color)
- Tab order and labels for the maintenance page sub-tabs
- Whether the "Support" section header has any visual treatment beyond text

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ModuleGate` component: fully generic, just wrap with `moduleId="maintenance"` — no changes needed
- `useModuleEnabled('maintenance')` hook: returns `{ enabled, loading }` — works out of the box
- `TenantModule` model: already supports per-campus scope via `campusId` field
- `AddOnsTab.tsx` `MODULE_REGISTRY`: just add an entry for `maintenance`
- `/api/modules/route.ts`: fully generic, handles any module ID — no changes needed
- Glassmorphism CSS classes: `ui-glass`, `ui-glass-hover`, `ui-glass-table`, `ui-glass-overlay`
- `AnimatedCounter`, `PageTransition`, `StaggerList` components for animations
- Framer Motion variants in `src/lib/animations.ts`
- Existing `DEFAULT_TEAMS.MAINTENANCE` already seeds a "Facility Maintenance" team (`slug: 'maintenance'`)

### Established Patterns
- Org-scope extension: add model names to `orgScopedModels` and `softDeleteModels` Sets in `src/lib/db/index.ts`
- Permission constants: add to `PERMISSIONS` object in `src/lib/permissions.ts`, then add to role arrays in `DEFAULT_ROLES`
- Seeding: `seedOrgDefaults` auto-picks up new permissions — but existing orgs need a backfill migration
- Module landing page: `DashboardLayout` → `ModuleGate` → sub-tabs with `hidden`/`animate-[fadeIn]` CSS toggling
- Sidebar conditional rendering: `useModuleEnabled` + permission check to show/hide nav items
- Enum naming: each module uses distinctive enum names (e.g., `SportSeasonType`, not `SeasonType`) to avoid collisions

### Integration Points
- `prisma/schema.prisma`: add 9 new models with relations to Organization, Building/Area/Room, User
- `src/lib/db/index.ts`: add model names to both Sets
- `src/lib/permissions.ts`: add `MAINTENANCE_*` constants and update `DEFAULT_ROLES`
- `src/components/settings/AddOnsTab.tsx`: add entry to `MODULE_REGISTRY`
- `src/components/Sidebar.tsx`: add "Support" section, `useModuleEnabled`, role-adaptive items
- `src/app/maintenance/page.tsx`: new page file (module landing page)
- `src/components/maintenance/`: new directory for maintenance components
- Organization model: add `timezone` field (SCHEMA-06 prep for Phase 6 compliance)

</code_context>

<specifics>
## Specific Ideas

- Teachers/staff should be able to see their submitted tickets, track progress, create new tickets, edit tickets, cancel tickets, and communicate with the assigned technician within the ticket — from the "My Requests" view
- The sidebar should use a plain text "Support" header as a divider — no icon on the header, just text separating the main nav from maintenance items
- The command center should feel like a monitoring dashboard — dense information at a glance without clicking around

</specifics>

<deferred>
## Deferred Ideas

- In-ticket communication/messaging between teachers and technicians — Phase 2 (ticket detail + activity feed)
- Kanban board views (My Board, Campus Board, All Campuses) — Phase 3
- IT Help Desk as a second module under the "Support" section — future milestone

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-05*
