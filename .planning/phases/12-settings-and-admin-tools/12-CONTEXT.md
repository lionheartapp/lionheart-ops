# Phase 12: Settings and Admin Tools - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Admins gain full visibility into platform activity and full control over organization configuration. This phase delivers: audit log viewer UI, billing/subscription management UI, CSV export for users/tickets/events, org name/slug editing, and per-user notification preferences. No new auth flows, no new modules — this extends existing Settings and user profile areas.

</domain>

<decisions>
## Implementation Decisions

### Audit Log Viewer
- Compact one-line rows: timestamp, actor email, action badge (color-coded), target resource
- Click row to expand inline detail panel showing changes JSON, IP address, resource ID
- Filters: action type dropdown, user picker, date range picker (industry standard set)
- Paginated with existing API (`GET /api/settings/audit-logs` already supports page/limit/action/userId/resourceType)
- Claude's discretion on tab placement — recommend dedicated "Activity Log" tab in Settings

### Billing & Subscription
- Full billing management tab in Settings (not read-only)
- Show current plan name, billing cycle, next payment date, plan features summary
- In-app plan picker: plan comparison cards with "Upgrade" / "Downgrade" buttons
- Calls Stripe API for plan changes with confirmation dialog and proration preview
- Invoice history: last 12 invoices with date, amount, status, and PDF download link
- Payment method management via Stripe Customer Portal redirect (not in-app card form — avoids PCI scope)
- Uses existing `Subscription`, `SubscriptionPlan`, `Payment` models and Stripe integration

### CSV Export
- Export buttons placed directly on each data list (not a centralized export page)
- Add "Export CSV" button to: Members tab, Tickets page, Events/Calendar page
- Exports respect active filters — what you see is what you export
- Follow existing CSV export pattern from IT damage reports (`/api/it/damage/export`)

### Org Name/Slug Editing
- Lives inside the existing Branding tab (not a new tab)
- Org name: simple text field, save immediately
- Slug change: confirmation dialog with warning about URL change, require typing new slug to confirm (GitHub-style)
- Change takes effect on save — no re-login required
- Slug uniqueness validated before save (existing `/api/organizations/slug-check` endpoint)

### Notification Preferences
- Per-user setting, accessed from user profile/account area (avatar menu), not the org Settings page
- Grouped by module: Calendar, Maintenance, IT, Compliance, Inventory, Security
- Two toggle columns per notification type: Email and In-App (independent control)
- Master "Pause all notifications" toggle at the top
- Per-module group toggle to mute/unmute all types in a category
- Individual preferences persist when using master/group toggles (restore when unmuted)
- New `NotificationPreference` model needed (userId + type + emailEnabled + inAppEnabled)

### Claude's Discretion
- Audit log tab naming and exact placement in Settings sidebar
- Billing tab visual layout and card styling
- Plan comparison card design
- CSV column selection and ordering
- Notification preference default values for new users
- Date range picker component choice
- Proration calculation display format

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `auditService.ts`: `audit()`, `getIp()`, `sanitize()` — audit log writing already in place
- `GET /api/settings/audit-logs/route.ts`: paginated API with action/userId/resourceType filtering — ready for UI
- `notificationService.ts`: 25+ `NotificationType` values already defined — use as basis for preference categories
- `NotificationBell.tsx`: existing notification UI — preferences integrate naturally
- `AuditExportDialog.tsx` + `/api/maintenance/compliance/export`: CSV export pattern with streaming response
- `/api/it/damage/export/[batchId]/route.ts`: another CSV export pattern reference
- `Subscription` + `SubscriptionPlan` + `Payment` models: full billing schema exists
- `/api/platform/webhooks/stripe/route.ts` + `webhook-verify.ts`: Stripe webhook handling exists
- `/api/organizations/slug-check`: slug uniqueness validation exists
- Settings page tabs: Campus, Members, Roles, Teams, Schools, Add-Ons, Branding, Approval Config, Academic Calendar, School Info

### Established Patterns
- Settings tabs: component per tab (e.g., `MembersTab.tsx`, `CampusTab.tsx`) loaded in settings page
- API routes: `getOrgIdFromRequest` → `getUserContext` → `assertCan` → `runWithOrgContext`
- Glassmorphism: `ui-glass`, `ui-glass-table` for all containers and tables
- Pagination: page/limit pattern in audit-logs API — extend to CSV endpoints
- FloatingDropdown for filter UI (established in `AssetRegisterFilters.tsx`)
- AnimatePresence for expandable sections (used across dashboard, inventory)

### Integration Points
- `src/app/settings/page.tsx`: add Audit Log and Billing tabs
- `src/components/settings/`: new `AuditLogTab.tsx`, `BillingTab.tsx` components
- `prisma/schema.prisma`: add `NotificationPreference` model
- User profile/account area: add notification preferences section
- `src/components/settings/MembersTab.tsx`: add CSV export button
- Tickets and Calendar pages: add CSV export buttons
- New API routes: `/api/settings/billing`, `/api/settings/export/*`, `/api/user/notification-preferences`

</code_context>

<specifics>
## Specific Ideas

- Audit log action badges should be color-coded by category (auth actions, user management, resource changes)
- Plan comparison cards should feel clean and modern — similar to the existing pricing page cards
- Slug change confirmation should mirror GitHub's repo rename pattern (type new slug to confirm)
- Notification preferences should feel like GitHub's notification settings — grouped, two-column toggles
- CSV exports should include a timestamp in the filename (e.g., `users-2026-03-10.csv`)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-settings-and-admin-tools*
*Context gathered: 2026-03-10*
