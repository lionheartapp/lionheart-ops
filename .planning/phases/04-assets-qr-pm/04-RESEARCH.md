# Phase 04: Assets, QR & PM — Research

**Researched:** 2026-03-06
**Domain:** Asset registry, QR code generation/scanning, preventive maintenance scheduling, labor/cost tracking
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Asset Register List**
- Filterable sortable table (like Work Orders table pattern)
- Columns: asset number, name, category, make/model, location, status, warranty expiry, replacement cost
- Filter bar: category, location (building/area/room), status, warranty status, keyword search
- Default sort: asset number ascending

**Asset Detail Page**
- Full page at `/maintenance/assets/[id]`
- Equipment identity first: top section shows photo(s), name, asset number, make/model/serial, category, location hierarchy, QR code thumbnail, warranty status badge
- Cost & health section: repair-vs-replace gauge (green→amber→red progress bar) PLUS alert banner when threshold exceeded
- Both gauge and banner display together when threshold is exceeded — gauge always visible, banner appears on threshold breach
- Ticket history section: table of all related tickets (open + closed), linked by asset
- Upcoming PM section: list of PM schedules linked to this asset with next due dates
- "Report Issue" button pre-fills ticket submission wizard with asset's location and asset number

**Asset Creation**
- Slide-over drawer from asset list page
- Scrollable form with sections: Identity, Location, Financials, Photos, Notes
- Auto-generated asset number (AST-0001 format) using existing MaintenanceAssetCounter

**QR Code Experience**
- Every asset gets a unique QR code encoding a URL (`{base_url}/maintenance/assets/{id}`)
- Scanning with native phone camera opens URL → lands on asset detail page
- In-app scanner button also available in maintenance section
- From asset detail page, user clicks "Report Issue" to start pre-filled ticket submission
- Manual fallback: search field on ticket submission wizard (asset number or name autocomplete)

**QR Label Printing**
- Two formats from asset detail page:
  - Individual label (~2x1 inch): QR code + asset number + asset name
  - Batch sheet: letter-size PDF with multiple labels (Avery label layout)

**PM Schedule Creation**
- Step-by-step wizard: Name/Description → Recurrence → Checklist items → Asset/Location link → Default technician
- Simple text list for checklist items
- No template library for v1

**PM Schedule Views**
- Calendar view is primary: month/week calendar showing PM tasks on due dates, color-coded by status
- Click a date to see that day's PM tasks
- List/table view as secondary toggle

**PM Ticket Checklist**
- Dedicated "PM Checklist" section on ticket detail page for PM tickets
- Each checklist item is a checkbox
- Visual progress indicator (e.g., "3/7 complete")
- ALL items must be checked before moving ticket to QA
- Attempting QA with incomplete checklist shows error

**Labor Time Entry**
- Timer with manual fallback: Start/Stop timer button on ticket detail, creates labor entries
- Manual entry: date, start time, end time or duration, notes
- Multiple entries per ticket (multi-session, multi-technician)
- Labor cost auto-computed from hours × technician's loadedHourlyRate

**Cost Entry & Receipts**
- Add cost entries with: vendor (autocomplete from pre-populated list), description, amount, optional receipt photo
- Receipt upload: inline "Attach Receipt" button, uses existing Supabase Storage pattern
- Vendor autocomplete: pre-populated list that learns from previous entries

**Cost Summary Display**
- Collapsible section in right column of ticket detail page (like AIDiagnosticPanel pattern)
- Summary stat cards at top: 4 compact cards (Total Hours, Labor Cost, Materials Cost, Grand Total)
- Below summary: chronological list of all labor and cost entries
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

### Deferred Ideas (OUT OF SCOPE)
- IT Help Desk as second module under "Support" section
- Sidebar badge count for unclaimed matching-specialty tickets
- Checklist template library for PM schedules
- Asset import from CSV/spreadsheet
- PM schedule avoidSchoolYear enforcement (SchoolCalendar model blocker)
- Barcode scanning (not just QR) for assets with existing barcodes
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ASSET-01 | Asset model with full fields: assetNumber, category, make/model/serial, purchase/warranty dates, replacement cost, photos, notes, status | Schema fully defined in `MaintenanceAsset` — status field is String, needs enum values decided |
| ASSET-02 | Auto-generated asset numbers (AST-0001 format) | `MaintenanceAssetCounter` pattern mirrors `MaintenanceCounter` — use `rawPrisma.$transaction` atomic increment |
| ASSET-03 | Assets linked to physical hierarchy (building/area/room) | Schema relations already defined; `useCampusLocations()` hook reusable for location picker |
| ASSET-04 | Asset detail page showing full ticket history, open tickets, upcoming PM, warranty status | Full page at `/maintenance/assets/[id]` — need new query joining tickets+PM by assetId |
| ASSET-05 | Cumulative repair cost tracked and displayed vs. replacement cost | Sum of `MaintenanceCostEntry.amount` + computed labor cost from labor entries on tickets linked to this asset |
| ASSET-06 | Repair threshold alert when cumulative repairs exceed configurable % of replacement cost | `repairThresholdPct` field already in schema (default 0.5 = 50%); alert logic: cumulative > replacementCost × threshold |
| QR-01 | Every asset record generates a unique QR code | `qrcode` npm library — server-side SVG generation from asset URL |
| QR-02 | QR code resolves to asset detail page when scanned | URL encoded in QR: `{NEXT_PUBLIC_APP_URL}/maintenance/assets/{id}` |
| QR-03 | Submitters can scan QR to auto-populate location and asset fields on new ticket | In-app scanner → resolves asset → navigates to SubmitRequestWizard with prefilled assetId + location |
| QR-04 | QR code printable for physical asset tagging | jsPDF: individual label + Avery batch sheet generation from API route |
| QR-05 | Manual asset number entry fallback for iOS camera limitations | Search field on wizard StepLocation or new StepAsset — autocomplete by assetNumber/name |
| PM-01 | PmSchedule model with recurrence types (DAILY through CUSTOM), interval, month selection | `PmSchedule` schema fully defined; recurrenceType is String — define enum values |
| PM-02 | PM schedules linked to assets or locations | Already in schema: `assetId`, `buildingId`, `areaId`, `roomId`, `schoolId` |
| PM-03 | Default technician assignment per PM schedule | `defaultTechnicianId` already in schema |
| PM-04 | School-year-aware scheduling (avoidSchoolYear flag) | Flag exists in schema — enforcement deferred per STATE.md blocker; store flag, display-only for now |
| PM-05 | Configurable advance notice days (default 7) for ticket generation | `advanceNoticeDays` already in schema with default 7 |
| PM-06 | Auto-generated PM tickets enter TODO status with checklist items | Cron: create MaintenanceTicket with status=TODO, pmScheduleId, pmChecklistItems copied from schedule |
| PM-07 | Checklist items must be completed before tech can move to QA | Modify status-transition validation in `maintenanceTicketService.ts` — check all pmChecklistItems complete |
| PM-08 | On completion, nextDueDate recalculated from completion date (not scheduled date) | Recurrence engine: compute next date from `lastCompletedDate` using recurrenceType/interval |
| PM-09 | PM Calendar view showing all upcoming scheduled maintenance | `react-big-calendar` already in package.json — reuse with custom event rendering |
| PM-10 | Cron job for PM ticket generation with idempotency via unique constraint (pmScheduleId + scheduledDueDate) | Add unique constraint on `MaintenanceTicket(pmScheduleId, pmScheduledDueDate)` — blocks duplicate creation |
| LABOR-01 | Multiple labor entries per ticket (multi-tech, multi-session) | `MaintenanceLaborEntry` model with ticketId relation — no constraint limits count |
| LABOR-02 | Labor entry: technician, start/end time, duration, notes | All fields present in schema; `durationMinutes` is optional (computed from start/end or set manually) |
| LABOR-03 | Labor cost auto-computed from hours × technician's loadedHourlyRate | Look up `TechnicianProfile.loadedHourlyRate` on labor entry creation; store computed cost or compute on read |
| LABOR-04 | Cost/receipt entries: vendor, description, amount, receipt photo upload | `MaintenanceCostEntry` has vendor/description/amount/receiptUrl; use existing signed-URL pattern |
| LABOR-05 | Pre-populated vendor list with autocomplete | API endpoint: GET /api/maintenance/vendors — distinct vendor strings from org's cost entries |
| LABOR-06 | Running cost summary on ticket detail: total labor hours, labor cost, materials cost, combined total | Aggregate query on GET /api/maintenance/tickets/[id] response — include laborEntries + costEntries |
| LABOR-07 | MaintenanceTicket includes `estimatedRepairCostUSD` field for FCI calculation | Field needs to be added to schema — will be used in Phase 6 FCI calculation |
</phase_requirements>

---

## Summary

Phase 4 builds four interconnected sub-systems on top of the Phase 1–3 foundation: (1) an asset register with QR codes, (2) a preventive maintenance scheduling engine with auto-ticket generation, (3) a labor/cost tracking layer on the ticket detail page, and (4) a repair-vs-replace cost visualization.

The good news is that the schema is almost entirely pre-built. `MaintenanceAsset`, `PmSchedule`, `MaintenanceLaborEntry`, `MaintenanceCostEntry`, and `MaintenanceAssetCounter` are all defined in `schema.prisma`. The org-scoped Prisma extension already includes these models (`db/index.ts` lines 47–51). The only schema gap is the `pmScheduledDueDate` field on `MaintenanceTicket` (needed for the idempotency unique constraint, PM-10) and `estimatedRepairCostUSD` (LABOR-07, needed for Phase 6 FCI). Both are single-line additions.

The primary technical decisions this research resolves: use `qrcode` npm for QR generation (server-side SVG/PNG), use `jsPDF` for label printing (already available pattern in ecosystem, client-side), use `react-big-calendar` for the PM calendar (already in package.json as a dependency), and use `html5-qrcode` with dynamic import for the in-app scanner (avoids Next.js SSR issues). The recurrence calculation uses `date-fns` (already in package.json) — no need for `rrule` since PM schedules use simple fixed-interval math, not iCalendar-style rrule complexity.

**Primary recommendation:** Deliver Phase 4 in 5 plans: (1) Schema gap + asset CRUD API + asset list UI, (2) Asset detail page + QR generation + label printing, (3) PM schedule wizard + calendar view, (4) PM cron + ticket checklist gate, (5) Labor timer + cost entries + ticket detail cost panel.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `qrcode` | `^1.5.4` | Server-side QR code generation (SVG/PNG/Buffer) | Defacto Node.js QR library, 18M+ weekly downloads, pure Node, no browser deps — ideal for API route generation |
| `@types/qrcode` | `^1.5.5` | TypeScript types for qrcode | Companion types package |
| `jspdf` | `^2.5.2` | Client-side PDF generation for label printing | Browser-native, no server required, well-supported in Next.js client components |
| `html5-qrcode` | `^2.3.8` | In-app camera QR scanner | Cross-platform, works iOS/Android/desktop browsers; must use `dynamic(() => import(...), { ssr: false })` in Next.js |
| `react-big-calendar` | `^1.19.4` | PM calendar view | Already in package.json — use existing installation |
| `date-fns` | `^4.1.0` | Recurrence date calculations | Already in package.json — sufficient for fixed-interval PM recurrence without rrule complexity |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns/tz` | (bundled with date-fns v4) | Timezone-aware date math | When computing PM dates relative to org timezone for PM-08 |

### Already Installed (No New Install Needed)
| Library | Version | Purpose |
|---------|---------|---------|
| `react-big-calendar` | `^1.19.4` | PM calendar — already in `package.json` |
| `date-fns` | `^4.1.0` | Date math — already in `package.json` |
| `framer-motion` | `^12.34.3` | Animations — already in `package.json` |
| `@supabase/supabase-js` | `^2.49.1` | Receipt photo upload — existing pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `qrcode` (server) | `qr-code-styling` | qr-code-styling adds visual styling but requires browser canvas — prefer pure Node `qrcode` for API routes |
| `html5-qrcode` (scanner) | `react-qr-scanner` | `react-qr-scanner` is simpler but less actively maintained; `html5-qrcode` has better iOS camera support |
| `jsPDF` (label PDF) | `pdfmake` | pdfmake uses declarative JSON — slightly more complex for simple label layouts; jsPDF's imperative API is easier for fixed-layout labels |
| `react-big-calendar` (PM calendar) | Custom month grid | react-big-calendar is already installed and handles month/week views; custom build would be significant work for no gain |
| `date-fns` (recurrence) | `rrule` | `rrule` is iCalendar-spec — overkill for simple daily/weekly/monthly/quarterly/annual intervals; date-fns `addDays/addWeeks/addMonths/addYears` is sufficient and already installed |

**Installation:**
```bash
npm install qrcode @types/qrcode jspdf html5-qrcode
```

---

## Architecture Patterns

### Recommended File Structure (New for Phase 4)
```
src/
  app/
    api/
      maintenance/
        assets/
          route.ts                    # GET list, POST create
          [id]/route.ts               # GET detail, PATCH update, DELETE soft-delete
          [id]/qr/route.ts            # GET QR code as SVG response
          [id]/label/route.ts         # GET individual label PDF
          labels/route.ts             # POST batch label PDF
          upload-url/route.ts         # POST signed URL for asset photos
        pm-schedules/
          route.ts                    # GET list, POST create
          [id]/route.ts               # GET detail, PATCH update, DELETE
        tickets/
          [id]/
            labor/route.ts            # GET list, POST create labor entry
            labor/[entryId]/route.ts  # PATCH update, DELETE labor entry
            costs/route.ts            # GET list, POST create cost entry
            costs/[entryId]/route.ts  # PATCH update, DELETE cost entry
            cost-upload-url/route.ts  # POST signed URL for receipt photos
        vendors/route.ts              # GET distinct vendor list for autocomplete
      cron/
        maintenance-tasks/route.ts    # EXTEND existing cron with PM ticket generation
    maintenance/
      assets/
        page.tsx                      # Asset register list page
        [id]/
          page.tsx                    # Asset detail page
  components/
    maintenance/
      AssetRegisterTable.tsx          # Table + filters (WorkOrdersTable pattern)
      AssetRegisterFilters.tsx        # Filter bar (WorkOrdersFilters pattern)
      AssetCreateDrawer.tsx           # Slide-over drawer for asset creation
      AssetDetailPage.tsx             # Full asset detail page component
      AssetRepairGauge.tsx            # Repair-vs-replace progress bar + alert banner
      QRCodeThumbnail.tsx             # QR code display (img from /api/.../qr)
      QRScannerModal.tsx              # In-app QR scanner (html5-qrcode, dynamic import)
      PmScheduleWizard.tsx            # Step-by-step PM creation wizard
      PmScheduleList.tsx              # Table view of all PM schedules
      PmCalendarView.tsx              # react-big-calendar wrapper for PM calendar
      PmCalendarEvent.tsx             # Custom event renderer for PM calendar
      PmChecklistSection.tsx          # Checklist on ticket detail (PM tickets only)
      LaborCostPanel.tsx              # Collapsible cost/labor panel (AIDiagnosticPanel pattern)
      LaborTimerButton.tsx            # Start/stop timer button for ticket detail
      LaborEntryForm.tsx              # Manual labor entry form
      CostEntryForm.tsx               # Cost + receipt entry form
      LaborCostSummaryCards.tsx       # 4 stat cards (hours, labor $, materials $, total)
      SubmitRequestWizard/
        StepAsset.tsx                 # New optional step: asset search/selection
```

### Pattern 1: QR Code Generation (Server-Side API Route)
**What:** API route generates QR code SVG from asset URL, returned as image response
**When to use:** Every asset detail page QR thumbnail, label printing

```typescript
// Source: qrcode npm package documentation
// /api/maintenance/assets/[id]/qr/route.ts
import QRCode from 'qrcode'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const orgId = getOrgIdFromRequest(req)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.lionheartapp.com'
  const assetUrl = `${appUrl}/maintenance/assets/${params.id}`

  const svgString = await QRCode.toString(assetUrl, {
    type: 'svg',
    margin: 1,
    width: 200,
    color: { dark: '#000000', light: '#ffffff' },
  })

  return new Response(svgString, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable', // QR never changes for an asset
    },
  })
}
```

### Pattern 2: In-App QR Scanner (Client Component, Dynamic Import)
**What:** Camera-based QR scanner using html5-qrcode, loaded only client-side
**When to use:** "Scan QR" button in maintenance section header

```typescript
// Source: html5-qrcode documentation + Next.js dynamic import pattern
// QRScannerModal.tsx — outer component (SSR-safe)
const QRScannerInner = dynamic(() => import('./QRScannerInner'), { ssr: false })

// QRScannerInner.tsx — actual scanner (client-only)
import { Html5QrcodeScanner } from 'html5-qrcode'

useEffect(() => {
  const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 }, false)
  scanner.render(
    (decodedText) => {
      // decodedText is the asset URL; extract asset ID and navigate
      const match = decodedText.match(/\/maintenance\/assets\/([^/?]+)/)
      if (match) router.push(`/maintenance/assets/${match[1]}`)
      scanner.clear()
    },
    (error) => { /* ignore scan errors */ }
  )
  return () => { scanner.clear().catch(() => {}) }
}, [])
```

### Pattern 3: Asset Number Auto-Generation (rawPrisma Transaction)
**What:** Atomic increment of `MaintenanceAssetCounter` mirroring `MaintenanceCounter` pattern
**When to use:** Every asset creation

```typescript
// Source: Existing MaintenanceCounter pattern in maintenanceTicketService.ts
async function generateAssetNumber(orgId: string): Promise<string> {
  const counter = await rawPrisma.maintenanceAssetCounter.upsert({
    where: { organizationId: orgId },
    update: { lastAssetNumber: { increment: 1 } },
    create: { organizationId: orgId, lastAssetNumber: 1 },
  })
  return `AST-${String(counter.lastAssetNumber).padStart(4, '0')}`
}
```

### Pattern 4: PM Recurrence Calculation (date-fns)
**What:** Compute `nextDueDate` from `lastCompletedDate` (or creation date for first run) using recurrenceType
**When to use:** After PM ticket completion (PM-08), cron job scheduling check

```typescript
// Source: date-fns documentation
import { addDays, addWeeks, addMonths, addYears } from 'date-fns'

export function computeNextDueDate(
  baseDate: Date,
  recurrenceType: string,
  intervalDays?: number | null,
  months?: number[] | null
): Date {
  switch (recurrenceType) {
    case 'DAILY':    return addDays(baseDate, 1)
    case 'WEEKLY':   return addWeeks(baseDate, 1)
    case 'BIWEEKLY': return addWeeks(baseDate, 2)
    case 'MONTHLY':  return addMonths(baseDate, 1)
    case 'QUARTERLY': return addMonths(baseDate, 3)
    case 'SEMIANNUAL': return addMonths(baseDate, 6)
    case 'ANNUAL':   return addYears(baseDate, 1)
    case 'CUSTOM':   return addDays(baseDate, intervalDays ?? 30)
    default:         return addMonths(baseDate, 1)
  }
}
```

### Pattern 5: PM Cron Idempotency (Unique Constraint)
**What:** Unique constraint on `(pmScheduleId, pmScheduledDueDate)` prevents duplicate ticket creation
**When to use:** PM ticket auto-generation in cron job

```typescript
// Schema addition needed to MaintenanceTicket:
//   pmScheduleId      String?
//   pmScheduledDueDate DateTime?
//   pmChecklistItems   String[]  @default([])
//   pmChecklistDone    Boolean[] @default([])   // parallel array to items
//   @@unique([pmScheduleId, pmScheduledDueDate])

// Cron pattern — use upsert or try/catch on unique violation:
try {
  await rawPrisma.maintenanceTicket.create({
    data: {
      organizationId: schedule.organizationId,
      status: 'TODO',
      pmScheduleId: schedule.id,
      pmScheduledDueDate: dueDate,
      pmChecklistItems: schedule.checklistItems,
      pmChecklistDone: schedule.checklistItems.map(() => false),
      assignedToId: schedule.defaultTechnicianId,
      // ... other fields
    }
  })
} catch (e) {
  if (isUniqueConstraintError(e)) continue // idempotent: already created
  throw e
}
```

### Pattern 6: PM Checklist Gate on QA Transition
**What:** In `ALLOWED_TRANSITIONS` IN_PROGRESS → QA, add PM checklist check
**When to use:** Any ticket with `pmScheduleId != null` attempting QA transition

```typescript
// Extend existing transition validation in maintenanceTicketService.ts
// In the IN_PROGRESS → QA transition handler:
if (ticket.pmScheduleId && ticket.pmChecklistItems.length > 0) {
  const allDone = ticket.pmChecklistDone.every(Boolean)
  if (!allDone) {
    throw new Error('Complete all PM checklist items before moving to QA')
  }
}
```

### Pattern 7: Cost Summary Aggregation
**What:** Aggregate labor + cost entries when fetching ticket detail
**When to use:** GET /api/maintenance/tickets/[id]

```typescript
// Include in ticket GET response:
const [laborEntries, costEntries] = await Promise.all([
  prisma.maintenanceLaborEntry.findMany({ where: { ticketId }, include: { technician: { select: { firstName: true, lastName: true, technicianProfile: { select: { loadedHourlyRate: true } } } } } }),
  prisma.maintenanceCostEntry.findMany({ where: { ticketId } }),
])

const totalLaborHours = laborEntries.reduce((sum, e) => sum + (e.durationMinutes ?? 0) / 60, 0)
const laborCost = laborEntries.reduce((sum, e) => {
  const rate = e.technician?.technicianProfile?.loadedHourlyRate ?? 0
  return sum + (e.durationMinutes ?? 0) / 60 * rate
}, 0)
const materialsCost = costEntries.reduce((sum, e) => sum + e.amount, 0)
```

### Pattern 8: Receipt Photo Upload (Extend Existing Pattern)
**What:** Signed URL pattern — same as `maintenance-photos` bucket, new bucket `maintenance-receipts`
**When to use:** Cost entry receipt attachment

```typescript
// POST /api/maintenance/tickets/[id]/cost-upload-url
// Same pattern as /api/maintenance/tickets/upload-url but bucket = 'maintenance-receipts'
const { data, error } = await supabase.storage
  .from('maintenance-receipts')
  .createSignedUploadUrl(`${orgId}/${ticketId}/${Date.now()}-${fileName}`)
```

### Pattern 9: Label PDF Generation (jsPDF, Client-Side)
**What:** Client-side PDF generation triggered from asset detail page
**When to use:** "Print Label" button on asset detail, "Print Batch" from asset list

```typescript
// Source: jsPDF documentation
import jsPDF from 'jspdf'

async function printAssetLabel(asset: MaintenanceAsset, qrDataUrl: string) {
  // Individual label: 2in × 1in at 72dpi = 144×72 points
  const doc = new jsPDF({ unit: 'pt', format: [144, 72] })
  doc.addImage(qrDataUrl, 'PNG', 4, 4, 64, 64)           // QR code 64×64 pt
  doc.setFontSize(7)
  doc.text(asset.assetNumber, 72, 20)                    // Asset number
  doc.setFontSize(6)
  doc.text(asset.name.slice(0, 28), 72, 32, { maxWidth: 68 }) // Name (truncated)
  doc.save(`${asset.assetNumber}-label.pdf`)
}
```

### Anti-Patterns to Avoid
- **SSR-loading html5-qrcode:** This library accesses `window`/`navigator` at import time. Must use `dynamic(() => import(...), { ssr: false })` or will crash on server.
- **Generating QR SVG client-side in browser:** Works but increases bundle size and is harder to cache. Prefer API route + `<img src="/api/maintenance/assets/[id]/qr">` which is cacheable.
- **Storing full QR code in database:** The QR URL is deterministic from the asset ID — never persist QR data in DB, always generate on demand.
- **Parallel array for checklist completion:** Use `pmChecklistDone: Boolean[]` parallel to `pmChecklistItems: String[]` to avoid a separate join table for this simple case. Keep arrays in sync on every update.
- **Recomputing cumulative repair cost on every page load with a full join:** Cache the running total in a computed field OR keep the aggregate query O(n) with proper indexes on `(ticketId, organizationId)`.
- **Using rawPrisma inside runWithOrgContext for labor/cost entries:** These models are org-scoped — always use `prisma` inside the context block.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code image generation | Custom QR encoding algorithm | `qrcode` npm library | Reed-Solomon error correction, masking, multiple versions — extremely complex |
| Camera QR decoding | Custom image processing / ZXing port | `html5-qrcode` | Browser camera access + image decoding with fallback to file upload is 2000+ lines of code |
| PDF layout engine | HTML-to-PDF string building | `jsPDF` | Avery layout math (margins, columns, rows, pt conversions) is tedious but trivially solved with jsPDF's coordinate system |
| Recurrence date math | Custom "every 3rd Thursday" logic | `date-fns` (for simple intervals) | Edge cases: leap years, month-end rollover, DST transitions — date-fns handles all of these |
| Vendor deduplication / fuzzy autocomplete | Custom string similarity scoring | Simple `ILIKE` query on distinct vendors | For org-scoped vendors, case-insensitive prefix match is sufficient; no need for fuzzy lib |

**Key insight:** QR and PDF are deceptively simple to describe but complex to implement correctly. The ecosystem has mature, well-tested libraries for both — the implementation time should be spent on UX, not encoding algorithms.

---

## Common Pitfalls

### Pitfall 1: html5-qrcode SSR Crash
**What goes wrong:** Importing `html5-qrcode` at the top level crashes the Next.js server with "window is not defined"
**Why it happens:** The library accesses `navigator.mediaDevices` at module load time
**How to avoid:** Always use `dynamic(() => import('./QRScannerInner'), { ssr: false })` — never import html5-qrcode directly in a component that can render server-side
**Warning signs:** Build error `ReferenceError: window is not defined` during `next build`

### Pitfall 2: PM Duplicate Tickets on Cron Retry
**What goes wrong:** Cron runs twice (network retry, Vercel cron duplicate fire) and creates two PM tickets for the same schedule+date
**Why it happens:** No idempotency guard without the unique constraint
**How to avoid:** Add `@@unique([pmScheduleId, pmScheduledDueDate])` to `MaintenanceTicket` schema before shipping PM-10. Wrap cron creation in try/catch on unique violation.
**Warning signs:** Technicians see duplicate PM tickets in their queue

### Pitfall 3: QA Transition Bypass for PM Tickets
**What goes wrong:** Technician uses the status API directly (or another code path) to move a PM ticket to QA without completing the checklist
**Why it happens:** The checklist gate is only checked in the UI, not the server-side transition validator
**How to avoid:** Add checklist validation in `maintenanceTicketService.ts` `performStatusTransition()` — server-side gate is mandatory for PM-07
**Warning signs:** PM tickets in QA/DONE status with `pmChecklistDone` containing `false` values

### Pitfall 4: Asset Cost Calculation Cross-Tickets
**What goes wrong:** Repair cost display on asset detail shows incorrect total because it queries only current ticket's costs
**Why it happens:** Asset cumulative repair cost spans ALL historical tickets linked to the asset, not just the active ticket
**How to avoid:** Asset detail aggregation query must join ALL tickets by `assetId` (including closed/cancelled) and sum their `MaintenanceCostEntry.amount` + computed labor cost
**Warning signs:** Repair gauge shows 0 or only partial costs when tickets have been closed

### Pitfall 5: Asset Photos vs Ticket Photos — Wrong Bucket
**What goes wrong:** Asset photos uploaded to `maintenance-photos` (ticket bucket) and receipt photos to wrong bucket, creating a storage management mess
**Why it happens:** Re-using existing upload URL endpoint without creating dedicated buckets
**How to avoid:** Create separate Supabase Storage buckets:
  - `maintenance-photos` — ticket submission photos (existing)
  - `asset-photos` — asset equipment photos (new)
  - `maintenance-receipts` — cost entry receipt photos (new)
**Warning signs:** Orphaned files in the wrong bucket after asset deletion

### Pitfall 6: react-big-calendar CSS Missing in Production
**What goes wrong:** PM calendar renders without styles — events are invisible or layout breaks
**Why it happens:** react-big-calendar requires explicit CSS import; often works in dev (HMR auto-imports) but fails in production build
**How to avoid:** Add `import 'react-big-calendar/lib/css/react-big-calendar.css'` to the `PmCalendarView.tsx` component, not just the page
**Warning signs:** Calendar events appear as unstyled text blocks in production

### Pitfall 7: PM nextDueDate Calculation — Base Date Confusion
**What goes wrong:** PM schedule generates tickets on the wrong dates — e.g., monthly PM always generates on the 1st instead of the actual completion date
**Why it happens:** Using `scheduledDueDate` (original schedule date) instead of `lastCompletedDate` as the base for the next calculation
**How to avoid:** Per PM-08: "On completion, nextDueDate recalculated from completion date (not scheduled date)." When a PM ticket reaches DONE status, update `PmSchedule.nextDueDate = computeNextDueDate(ticket.completedAt)`
**Warning signs:** PM tickets always generated on calendar month boundaries regardless of when work was actually done

### Pitfall 8: Labor Duration Calculation — Timer vs Manual
**What goes wrong:** Duration inconsistency: timer-created entries have precise millisecond `startTime`/`endTime`, manual entries have user-input strings that produce different rounding
**Why it happens:** Two creation paths with different precision
**How to avoid:** Normalize `durationMinutes` on creation: `Math.round((endTime - startTime) / 60000)`. Store in `durationMinutes` field, not recomputed on display.
**Warning signs:** Total hours jumps by small fractions when switching between timer and manual entries

---

## Code Examples

### Asset Register Table (Reusing WorkOrdersTable Pattern)
```typescript
// Source: Existing WorkOrdersTable.tsx pattern
// AssetRegisterTable.tsx — same structure as WorkOrdersTable
// Column definitions for asset table:
const columns = [
  { key: 'assetNumber', label: 'Asset #', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'category', label: 'Category' },
  { key: 'make', label: 'Make / Model' },
  { key: 'location', label: 'Location' },  // computed: building.name + room
  { key: 'status', label: 'Status' },
  { key: 'warrantyExpiry', label: 'Warranty', sortable: true },
  { key: 'replacementCost', label: 'Replacement Cost', sortable: true },
]
```

### PM Calendar Event Colors
```typescript
// PM calendar status color palette
const PM_STATUS_COLORS = {
  upcoming: '#3b82f6',   // blue-500 — future scheduled
  overdue: '#ef4444',    // red-500 — past due, not completed
  completed: '#22c55e',  // green-500 — completed on time
  inProgress: '#f59e0b', // amber-500 — ticket in progress
} as const
```

### Repair vs Replace Gauge
```typescript
// AssetRepairGauge.tsx
interface AssetRepairGaugeProps {
  cumulativeRepairCost: number  // sum of all labor + material costs across tickets
  replacementCost: number       // asset.replacementCost
  repairThresholdPct: number    // asset.repairThresholdPct (default 0.5)
}

// Gauge fill percentage (capped at 100%):
const fillPct = Math.min(100, (cumulativeRepairCost / replacementCost) * 100)
// Color: green → amber (at threshold) → red (at 100%)
const gaugeColor = fillPct >= 100 ? 'bg-red-500'
  : fillPct >= repairThresholdPct * 100 ? 'bg-amber-500'
  : 'bg-emerald-500'
// Alert banner appears when: cumulativeRepairCost > replacementCost × repairThresholdPct
const showAlert = cumulativeRepairCost > replacementCost * repairThresholdPct
```

### Cost Section Collapsible (AIDiagnosticPanel Pattern)
```typescript
// LaborCostPanel.tsx — mirrors AIDiagnosticPanel structure
// Header button with chevron
// AnimatePresence + motion.div with expandCollapse variants
// Always start expanded (default open) since cost is primary workflow for active tickets
const [isExpanded, setIsExpanded] = useState(true) // default open

// Summary row — 4 compact stat cards
const summaryCards = [
  { label: 'Total Hours', value: `${totalHours.toFixed(1)}h`, icon: Clock },
  { label: 'Labor Cost', value: `$${laborCost.toFixed(2)}`, icon: Users },
  { label: 'Materials', value: `$${materialsCost.toFixed(2)}`, icon: Package },
  { label: 'Grand Total', value: `$${(laborCost + materialsCost).toFixed(2)}`, icon: DollarSign },
]
```

### Vendor Autocomplete API Pattern
```typescript
// GET /api/maintenance/vendors
// Returns distinct vendor strings from org's cost entries, filtered by query
export async function GET(req: NextRequest) {
  const orgId = getOrgIdFromRequest(req)
  const q = new URL(req.url).searchParams.get('q') ?? ''

  return await runWithOrgContext(orgId, async () => {
    const entries = await prisma.maintenanceCostEntry.findMany({
      where: { vendor: { contains: q, mode: 'insensitive' } },
      select: { vendor: true },
      distinct: ['vendor'],
      orderBy: { vendor: 'asc' },
      take: 20,
    })
    return NextResponse.json(ok(entries.map(e => e.vendor).filter(Boolean)))
  })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Barcode-only asset tagging | QR codes encoding full URLs | ~2015–2018 | Native phone camera can scan without app — eliminates scanner hardware |
| Separate PM software (SchoolDude, eMaint) | Integrated CMMS with PM + tickets | 2018–2022 | Technicians work in one system; no data sync between ticket and PM systems |
| Manual time logs on paper | Digital timer on ticket detail | ~2016 | Accurate labor cost tracking, automatic rate calculation |
| Label printers require special software | Browser-based PDF label printing | ~2019 | jsPDF enables printable labels from any browser — Dymo/Brother compatible |
| react-big-calendar older versions | v1.19.4 (already in project) | 2024 | date-fns v4 required for newest version — already matched in this project |

**Deprecated/outdated:**
- `react-qr-reader` (npm): No longer maintained; use `html5-qrcode` or `react-qr-scanner` instead
- Storing QR images as base64 in database: Anti-pattern — always generate on demand from asset ID

---

## Schema Changes Required

The following additions are needed before implementation. These are the ONLY schema gaps:

### 1. Add PM fields to MaintenanceTicket
```prisma
// In MaintenanceTicket model — add these fields:
pmScheduleId        String?
pmScheduledDueDate  DateTime?
pmChecklistItems    String[]  @default([])
pmChecklistDone     Boolean[] @default([])

pmSchedule PmSchedule? @relation(fields: [pmScheduleId], references: [id], onDelete: SetNull)

// Idempotency constraint (PM-10):
@@unique([pmScheduleId, pmScheduledDueDate])
```

### 2. Add estimatedRepairCostUSD to MaintenanceTicket (LABOR-07)
```prisma
// In MaintenanceTicket model:
estimatedRepairCostUSD Float?   // For FCI calculation (Phase 6)
```

### 3. Add assetId link to MaintenanceTicket
```prisma
// In MaintenanceTicket model:
assetId    String?
asset      MaintenanceAsset? @relation(fields: [assetId], references: [id], onDelete: SetNull)
```
> Note: `MaintenanceAsset` will need a `tickets MaintenanceTicket[]` back-relation.

### 4. Supabase Storage Buckets (new)
- `asset-photos` — public bucket for equipment photos
- `maintenance-receipts` — private bucket for receipt photos (signed URL access)

---

## Navigation Changes

The Sidebar `MaintenanceTab` type and Support section need two additions:
```typescript
// Extend MaintenanceTab union in Sidebar.tsx:
export type MaintenanceTab = 'dashboard' | 'work-orders' | 'my-requests' | 'assets' | 'pm-calendar'

// Add to sidebar Support section (canManageMaintenance guard):
// - Assets → /maintenance/assets  (Boxes icon from lucide)
// - PM Calendar → /maintenance?tab=pm-calendar  (CalendarClock icon — already imported in MaintenanceDashboard)
```

---

## Open Questions

1. **Asset status enum values**
   - What we know: Schema uses `status String @default("ACTIVE")` — intentionally flexible
   - What's unclear: Which status values are needed? Common CMMS values: `ACTIVE`, `INACTIVE`, `UNDER_REPAIR`, `RETIRED`, `DISPOSED`
   - Recommendation: Define enum values as `ACTIVE | INACTIVE | UNDER_REPAIR | RETIRED | DISPOSED` — use a plain string union in TypeScript (not Prisma enum) to avoid migration complexity

2. **PM recurrence types — exact enum values**
   - What we know: Schema uses `recurrenceType String` — intentionally flexible
   - What's unclear: Exact values to use in cron calculation
   - Recommendation: `DAILY | WEEKLY | BIWEEKLY | MONTHLY | QUARTERLY | SEMIANNUAL | ANNUAL | CUSTOM` — consistent with common CMMS terminology

3. **avoidSchoolYear flag behavior for now**
   - What we know: STATE.md flags this as blocked (needs SchoolCalendar model); CONTEXT.md defers enforcement
   - What's unclear: Should the flag even appear in the PM wizard UI if it does nothing?
   - Recommendation: Show the toggle in the PM wizard with a tooltip "School-year avoidance will be enforced when the academic calendar is configured" — stores the flag for future Phase 6 use without misleading users

4. **Cumulative repair cost inclusion criteria**
   - What we know: ASSET-05 says "cumulative repair cost tracked and displayed"
   - What's unclear: Include only DONE tickets? Or all tickets including open/in-progress?
   - Recommendation: Include all non-cancelled tickets (BACKLOG, TODO, IN_PROGRESS, QA, DONE, ON_HOLD) — excludes only CANCELLED. This gives the most accurate picture of total spending committed to this asset.

5. **PM calendar — which `react-big-calendar` localizer**
   - What we know: `date-fns` is already installed; `moment` is not
   - Recommendation: Use `dateFnsLocalizer` from `react-big-calendar/lib/localizers/date-fns` — consistent with existing date-fns usage in the project

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (already in devDependencies as `@playwright/test ^1.58.2`) + existing smoke test pattern (.mjs scripts) |
| Config file | `playwright.config.ts` (check if exists) or smoke test scripts |
| Quick run command | `node scripts/smoke-maintenance-assets.mjs` (to be created) |
| Full suite command | `npm run smoke:all` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ASSET-01 | POST /api/maintenance/assets creates asset with correct fields | smoke/integration | `node scripts/smoke-maintenance-assets.mjs` | ❌ Wave 0 |
| ASSET-02 | Asset number auto-generates as AST-0001 | smoke | included in above | ❌ Wave 0 |
| ASSET-03 | Asset linked to building/area/room | smoke | included in above | ❌ Wave 0 |
| ASSET-05 | Cumulative cost sums correctly | smoke | included in above | ❌ Wave 0 |
| ASSET-06 | Threshold alert triggers at correct percentage | smoke | included in above | ❌ Wave 0 |
| QR-01 | GET /api/maintenance/assets/[id]/qr returns SVG | smoke | `node scripts/smoke-maintenance-qr.mjs` | ❌ Wave 0 |
| QR-02 | QR URL resolves correctly | smoke | included in above | ❌ Wave 0 |
| QR-04 | Label PDF endpoint returns PDF content-type | smoke | included in above | ❌ Wave 0 |
| PM-01 | POST /api/maintenance/pm-schedules creates schedule | smoke | `node scripts/smoke-maintenance-pm.mjs` | ❌ Wave 0 |
| PM-06 | Cron generates PM ticket in TODO status | smoke | included in above | ❌ Wave 0 |
| PM-07 | QA transition blocked when checklist incomplete | smoke | included in above | ❌ Wave 0 |
| PM-08 | nextDueDate recalculates from completedAt | smoke | included in above | ❌ Wave 0 |
| PM-10 | Duplicate cron run does NOT create second ticket | smoke | included in above | ❌ Wave 0 |
| LABOR-01 | POST /api/maintenance/tickets/[id]/labor creates entry | smoke | `node scripts/smoke-maintenance-labor.mjs` | ❌ Wave 0 |
| LABOR-03 | Labor cost computed correctly from loadedHourlyRate | smoke | included in above | ❌ Wave 0 |
| LABOR-04 | Cost entry created with receipt URL | smoke | included in above | ❌ Wave 0 |
| LABOR-06 | Cost summary returns correct totals | smoke | included in above | ❌ Wave 0 |
| LABOR-07 | estimatedRepairCostUSD field present on ticket | smoke | included in labor smoke | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node scripts/smoke-maintenance-assets.mjs` (assets API only, ~5s)
- **Per wave merge:** All three new smoke scripts (assets + qr + pm + labor, ~15s)
- **Phase gate:** `npm run smoke:all` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/smoke-maintenance-assets.mjs` — covers ASSET-01 through ASSET-06
- [ ] `scripts/smoke-maintenance-qr.mjs` — covers QR-01, QR-02, QR-04
- [ ] `scripts/smoke-maintenance-pm.mjs` — covers PM-01, PM-06 through PM-10
- [ ] `scripts/smoke-maintenance-labor.mjs` — covers LABOR-01 through LABOR-07

---

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` (this repo) — all schema models inspected directly
- `src/lib/db/index.ts` (this repo) — org-scoped models set confirmed
- `src/lib/permissions.ts` (this repo) — MAINTENANCE_MANAGE_ASSETS, MAINTENANCE_MANAGE_PM confirmed present
- `src/app/api/cron/maintenance-tasks/route.ts` (this repo) — cron extension pattern confirmed
- `package.json` (this repo) — `react-big-calendar ^1.19.4`, `date-fns ^4.1.0` confirmed installed
- [qrcode npm](https://www.npmjs.com/package/qrcode) — server-side QR generation confirmed
- [html5-qrcode npm](https://www.npmjs.com/package/html5-qrcode) — cross-platform camera scanner

### Secondary (MEDIUM confidence)
- [html5-qrcode Next.js SSR issue](https://github.com/briosheje/react-html5-qrcode-reader) — SSR incompatibility confirmed by community wrapper project
- [react-big-calendar npm](https://www.npmjs.com/package/react-big-calendar) — version ^1.19.4 confirmed, dateFnsLocalizer available
- [jsPDF npm](https://www.npmjs.com/package/jspdf) — client-side PDF generation, v4.2.0 current

### Tertiary (LOW confidence — needs validation)
- Avery label layout specifications (2×1 inch label dimensions) — based on common Avery 5160/6879 specs; verify against actual label stock used at Linfield

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core packages verified against npm registry; existing installs confirmed from package.json
- Architecture: HIGH — patterns verified from existing codebase (AIDiagnosticPanel, MaintenanceCounter, WorkOrdersTable, cron route)
- Schema changes: HIGH — schema.prisma read directly; gaps clearly identified
- Pitfalls: HIGH — verified from codebase patterns and library-specific SSR behavior
- PM recurrence algorithm: HIGH — date-fns functions verified; design decision (not use rrule) well-justified

**Research date:** 2026-03-06
**Valid until:** 2026-05-01 (stable libraries; re-verify html5-qrcode if shipping > 2 months out)
