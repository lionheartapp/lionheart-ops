# Phase 4: Assets, QR & PM - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Every major piece of equipment has an asset record with QR tag, preventive maintenance runs on a schedule, and all labor and costs are tracked per ticket. This phase delivers: asset register with CRUD and detail page, QR code generation and scanning (native + in-app), PM schedule management with auto-ticket generation and checklist enforcement, labor time tracking (timer + manual), cost/receipt tracking, and repair-vs-replace cost visualization. Analytics dashboard and repeat repair detection are Phase 5. Compliance calendar is Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Asset Register List
- Filterable sortable table (like Work Orders table pattern)
- Columns: asset number, name, category, make/model, location, status, warranty expiry, replacement cost
- Filter bar: category, location (building/area/room), status, warranty status, keyword search
- Default sort: asset number ascending

### Asset Detail Page
- Full page at `/maintenance/assets/[id]`
- Equipment identity first: top section shows photo(s), name, asset number, make/model/serial, category, location hierarchy, QR code thumbnail, warranty status badge
- Cost & health section below: repair-vs-replace gauge (green→amber→red progress bar showing cumulative repairs filling toward replacement cost) PLUS alert banner when threshold exceeded ("Cumulative repairs ($2,400) have reached 60% of replacement cost ($4,000). Consider replacement.")
- Both gauge and banner display together when threshold is exceeded — gauge always visible, banner appears on threshold breach
- Ticket history section: table of all related tickets (open + closed), linked by asset
- Upcoming PM section: list of PM schedules linked to this asset with next due dates
- "Report Issue" button pre-fills ticket submission wizard with asset's location and asset number

### Asset Creation
- Slide-over drawer from the asset list page
- Scrollable form with sections: Identity (name, category, make/model, serial), Location (building/area/room picker), Financials (purchase date, replacement cost, warranty expiry, expected lifespan, repair threshold %), Photos, Notes
- Auto-generated asset number (AST-0001 format) using existing MaintenanceAssetCounter

### QR Code Experience
- Every asset gets a unique QR code encoding a URL (e.g., `{base_url}/maintenance/assets/{id}`)
- Scanning with native phone camera opens the URL → lands on asset detail page
- In-app scanner button also available in the maintenance section for convenience (JS camera library)
- From asset detail page, user clicks "Report Issue" to start a pre-filled ticket submission
- Manual fallback: search field on the ticket submission wizard where users type an asset number (AST-XXXX) or search by name with autocomplete

### QR Label Printing
- Two formats available from asset detail page:
  - Individual label (~2x1 inch): QR code + asset number + asset name — designed for label printers (Dymo/Brother)
  - Batch sheet: letter-size PDF with multiple labels per page (Avery label layout) — for regular printers
- User picks which to print from asset detail page

### PM Schedule Creation
- Step-by-step wizard: Name/Description → Recurrence setup (type, interval, months, advance notice days) → Checklist items (add/reorder/delete) → Asset/Location link → Default technician assignment
- Simple text list for checklist items: text input + "Add" button, drag to reorder, X to delete
- No template library for v1 — plain text items only

### PM Schedule Views
- Calendar view is primary: month/week calendar showing PM tasks on due dates, color-coded by status (upcoming=blue, overdue=red, completed=green)
- Click a date to see that day's PM tasks
- List/table view as secondary toggle: sortable table of all schedules (name, recurrence, next due, asset/location, technician, status)

### PM Ticket Checklist
- Dedicated "PM Checklist" section on the ticket detail page for auto-generated PM tickets
- Each checklist item is a checkbox — tech checks off as completed
- Visual progress indicator (e.g., "3/7 complete")
- ALL checklist items must be checked before the tech can move ticket to QA (PM-07 gate)
- Attempting QA with incomplete checklist shows error: "Complete all checklist items before moving to QA"

### Labor Time Entry
- Timer with manual fallback:
  - Start/Stop timer button on ticket detail page — creates labor entries automatically with start/end timestamps
  - Manual entry option for logging time after the fact (date, start time, end time or duration, notes)
  - Multiple entries per ticket supported (multi-session, multi-technician)
- Labor cost auto-computed from hours × technician's loadedHourlyRate (from TechnicianProfile)

### Cost Entry & Receipts
- Add cost entries with: vendor (autocomplete from pre-populated list), description, amount, optional receipt photo
- Receipt upload: inline "Attach Receipt" button on the cost entry form opens file picker. Receipt thumbnail shows next to the entry. Tap to view full-size. Uses existing Supabase Storage pattern
- Vendor autocomplete: pre-populated list that learns from previous entries in the org

### Cost Summary Display
- Collapsible section in the right column of ticket detail page (like AI diagnostic panel pattern)
- Summary stat cards at top of section: 4 compact cards in a row (Total Hours, Labor Cost, Materials Cost, Grand Total) using gradient accent card style
- Below summary: chronological list of all labor entries and cost entries
- Updates live as new entries are added (optimistic UI)

### Claude's Discretion
- Timer button design and placement on ticket detail
- QR code generation library choice
- In-app QR scanner library choice (html5-qrcode or similar)
- Calendar component library (or custom build)
- Avery label layout specifics (label dimensions, spacing)
- Asset status enum values and transitions
- PM recurrence calculation algorithm
- Vendor autocomplete implementation (local list vs API-backed)
- Cost section collapse/expand default state
- PM calendar color palette for status coding

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MaintenanceAsset` model: fully defined in schema with all fields (name, category, make/model/serial, photos, warranty, replacement cost, location links, repairThresholdPct, expectedLifespanYears)
- `PmSchedule` model: fully defined with recurrence fields, checklist items array, advance notice, avoidSchoolYear flag
- `MaintenanceLaborEntry` model: start/end time, duration, technician link
- `MaintenanceCostEntry` model: vendor, amount, receipt URL, createdBy
- `MaintenanceAssetCounter` model: atomic asset number generation (same pattern as MaintenanceCounter for tickets)
- `WorkOrdersTable.tsx` + `WorkOrdersFilters.tsx`: reuse pattern for asset register table with filter bar
- `SubmitRequestWizard.tsx`: step-by-step wizard pattern — reuse for PM schedule creation wizard
- `ImageDropZone.tsx`: photo upload component — reuse for asset photos and receipt uploads
- `AIDiagnosticPanel.tsx`: collapsible right-column section pattern — reuse for cost/labor section
- `storageService.ts`: Supabase Storage upload — extend for asset photos and receipt photos
- `useCampusLocations()` hook: building/area/room picker — reuse for asset and PM location assignment
- Glassmorphism classes: `ui-glass`, `ui-glass-hover`, `ui-glass-table`, `ui-glass-overlay`
- Framer Motion animations in `src/lib/animations.ts`

### Established Patterns
- Org-scoped models in `db/index.ts` Sets — add MaintenanceAsset, PmSchedule, MaintenanceLaborEntry, MaintenanceCostEntry
- Auto-increment counters via `rawPrisma.$transaction` (MaintenanceCounter pattern)
- API route pattern: `getOrgIdFromRequest` → `getUserContext` → `assertCan` → `runWithOrgContext`
- Tab switching: `className={activeTab === 'x' ? 'animate-[fadeIn]' : 'hidden'}`
- Collapsible sections: chevron rotation + AnimatePresence height animation
- Optimistic mutations: onMutate snapshot + patch, onError rollback, onSettled invalidate

### Integration Points
- `/src/app/api/maintenance/assets/` — greenfield CRUD routes
- `/src/app/api/maintenance/pm-schedules/` — greenfield CRUD + cron route
- `/src/app/api/maintenance/tickets/[id]/labor/` — greenfield labor entry routes
- `/src/app/api/maintenance/tickets/[id]/costs/` — greenfield cost entry routes
- `TicketDetailPage.tsx` — add cost/labor section, PM checklist section, asset link
- `SubmitRequestWizard.tsx` — add optional asset search field
- Existing cron endpoint — extend for PM ticket auto-generation
- Maintenance sidebar — add Assets and PM Calendar nav items
- `MaintenanceDashboard.tsx` — wire PM Calendar Preview panel

</code_context>

<specifics>
## Specific Ideas

- Asset detail page should prioritize equipment identity (photos, make/model, serial) over cost metrics — maintenance heads look at the equipment first, then check financials
- QR scan landing on asset detail (not ticket form directly) gives context before reporting — user sees if there's already an open ticket or upcoming PM
- Timer should be prominent on ticket detail for active tickets — techs work on a ticket and want to start/stop time easily
- PM calendar should feel like a real calendar app (month grid, click days, color-coded dots) — not just a table with dates
- Checklist gate on QA transition is strict — no partial completion allowed, same pattern as QA completion photo requirement from Phase 2
- Slide-over drawer for asset creation keeps the user on the list page — quick add without context switching

</specifics>

<deferred>
## Deferred Ideas

- IT Help Desk as second module under "Support" section — future milestone (carried from Phase 1, 2, 3)
- Sidebar badge count for unclaimed matching-specialty tickets — nice-to-have (carried from Phase 2)
- Checklist template library for PM schedules — v2 enhancement, start with simple text items
- Asset import from CSV/spreadsheet — bulk onboarding tool for existing equipment
- PM schedule avoidSchoolYear enforcement — requires SchoolCalendar model; flag exists in schema but enforcement deferred (STATE.md blocker note)
- Barcode scanning (not just QR) for assets with existing barcodes

</deferred>

---

*Phase: 04-assets-qr-pm*
*Context gathered: 2026-03-06*
