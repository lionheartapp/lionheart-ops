---
phase: 06-compliance-board-reporting
plan: 03
subsystem: reporting
tags: [jspdf, anthropic, tanstack-query, framer-motion, next.js, prisma, typescript, cron, email]

# Dependency graph
requires:
  - phase: 06-compliance-board-reporting
    plan: 01
    provides: ComplianceRecord model, complianceService, compliance permissions
  - phase: 04-assets-qr-pm
    provides: MaintenanceAsset, MaintenanceCostEntry, MaintenanceLaborEntry, TechnicianProfile models
  - phase: 02-core-tickets
    provides: MaintenanceTicket model with estimatedRepairCostUSD, pmScheduleId, status fields
  - phase: 05-analytics-repair-intelligence
    provides: rawPrisma cross-org patterns, emailService with attachment patterns

provides:
  - boardReportService.ts with calculateFCI, getBoardReportMetrics (8 metric groups), generateAINarrative (Claude Sonnet 4.5), exportBoardReportPDF (6-page jsPDF)
  - GET /api/maintenance/board-report metrics endpoint with date range and campus filters
  - POST /api/maintenance/board-report/export PDF binary endpoint with AI narrative
  - GET /api/cron/board-report-delivery cross-org weekly/monthly PDF delivery cron
  - sendBoardReportEmail added to emailService.ts with PDF attachment support
  - FCIScoreCard, BoardMetricsGrid, ComplianceStatusPanel, AssetForecastPanel React components
  - GenerateReportDialog for month/year selection, AI toggle, and PDF download
  - BoardReportPage orchestrator with period picker, YoY comparison row
  - /maintenance/board-report page with ModuleGate
  - Board Report nav link in maintenance sidebar

affects: [07-knowledge-base-offline-pwa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - jsPDF 6-page report with cover, narrative, metrics, compliance table, asset intelligence, YoY
    - Anthropic dynamic import pattern to avoid SSR issues with SDK
    - Cross-org cron pattern: rawPrisma.tenantModule → per-org PDF generation → sendBoardReportEmail
    - BoardReportMetrics type shared between service and React components via service import

key-files:
  created:
    - src/lib/services/boardReportService.ts
    - src/app/api/maintenance/board-report/route.ts
    - src/app/api/maintenance/board-report/export/route.ts
    - src/app/api/cron/board-report-delivery/route.ts
    - src/components/maintenance/board-report/FCIScoreCard.tsx
    - src/components/maintenance/board-report/BoardMetricsGrid.tsx
    - src/components/maintenance/board-report/ComplianceStatusPanel.tsx
    - src/components/maintenance/board-report/AssetForecastPanel.tsx
    - src/components/maintenance/board-report/GenerateReportDialog.tsx
    - src/components/maintenance/board-report/BoardReportPage.tsx
    - src/app/maintenance/board-report/page.tsx
  modified:
    - src/lib/services/emailService.ts
    - src/components/Sidebar.tsx

key-decisions:
  - "Asset cost queries nest through tickets: MaintenanceAsset.tickets[].costEntries and laborEntries — no direct cost/labor relation on asset"
  - "Anthropic SDK loaded via dynamic import in generateAINarrative to prevent server-side bundle issues and support graceful fallback"
  - "Zod v4 uses .issues not .errors on ZodError — fixed in all route handlers"
  - "CRON_SECRET permission query uses RolePermission join instead of User.role relation filter — Prisma UserWhereInput does not expose role as a filterable relation"
  - "Fallback narrative template used when ANTHROPIC_API_KEY not set — key metrics embedded in prose format"
  - "jsPDF queries totalCost for costPerStudent from allTickets (not separate query) — tickets include costEntries/laborEntries for FCI and cost-per-student in single query"

patterns-established:
  - "Board report metrics run in a single Promise.all with 7 parallel query groups for performance"
  - "PDF export returns ArrayBuffer — converted to Buffer for email attachment, returned directly as Response binary for download"
  - "FCI = deferred maintenance (BACKLOG+TODO+IN_PROGRESS+ON_HOLD tickets with estimatedRepairCostUSD) / total replacement value (ACTIVE assets with replacementCost set)"

requirements-completed: [REPORT-01, REPORT-02, REPORT-03, REPORT-04, REPORT-05, REPORT-06, REPORT-07, REPORT-08, REPORT-09, REPORT-10]

# Metrics
duration: 11min
completed: 2026-03-06
---

# Phase 6 Plan 3: Board Report Service, PDF Export, and Board Report Page Summary

**FCI calculation service with 8-metric board report, 6-page jsPDF export with Claude Sonnet AI narrative, live dashboard page with all metric panels, and weekly/monthly cron delivery**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-06T16:45:01Z
- **Completed:** 2026-03-06T16:55:41Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- boardReportService.ts with FCI calculation, 8-metric aggregation (PM ratio, deferred backlog, response/resolution time, compliance, EOL forecast, top repair costs, YoY), AI narrative, and 6-page PDF export
- Three new API endpoints: GET metrics, POST PDF export, GET cron delivery — all TypeScript clean
- Board report page with FCIScoreCard (animated score, color-coded APPA rating), BoardMetricsGrid (4 stat cards), ComplianceStatusPanel (10-domain table), AssetForecastPanel (EOL chips + top repair table)
- GenerateReportDialog with month/year picker, AI toggle, loading state, and auto-download trigger
- sendBoardReportEmail added to emailService.ts with PDF attachment via Resend and SMTP fallback
- Board Report nav link added to maintenance sidebar (FileText icon)

## Task Commits

1. **Task 1: Board report service, metrics API, export endpoint, and cron delivery** - `c989d02` (feat)
2. **Task 2: Board report page with live metric panels and generate report dialog** - `0eeaf92` (feat)

## Files Created/Modified
- `src/lib/services/boardReportService.ts` - calculateFCI, getBoardReportMetrics (8 groups), generateAINarrative, exportBoardReportPDF
- `src/app/api/maintenance/board-report/route.ts` - GET metrics with date range + campus filters
- `src/app/api/maintenance/board-report/export/route.ts` - POST PDF binary endpoint
- `src/app/api/cron/board-report-delivery/route.ts` - weekly/monthly cross-org cron
- `src/lib/services/emailService.ts` - sendBoardReportEmail with PDF attachment
- `src/components/maintenance/board-report/FCIScoreCard.tsx` - animated FCI with APPA tooltip
- `src/components/maintenance/board-report/BoardMetricsGrid.tsx` - 4-up stat cards with PM ratio bar
- `src/components/maintenance/board-report/ComplianceStatusPanel.tsx` - 10-domain compliance table
- `src/components/maintenance/board-report/AssetForecastPanel.tsx` - EOL chips + top repair assets
- `src/components/maintenance/board-report/GenerateReportDialog.tsx` - PDF generation modal
- `src/components/maintenance/board-report/BoardReportPage.tsx` - orchestrator with YoY row
- `src/app/maintenance/board-report/page.tsx` - page wrapper with ModuleGate
- `src/components/Sidebar.tsx` - Board Report nav link added

## Decisions Made
- Asset cost queries nest through tickets (MaintenanceAsset.tickets[].costEntries) — no direct relation between assets and cost/labor entries
- Anthropic SDK loaded with dynamic import in generateAINarrative — prevents potential SSR bundle issues and enables graceful fallback
- Zod v4 uses `.issues` not `.errors` on ZodError — auto-fixed in route handlers
- CRON_SECRET permission query uses RolePermission join rather than `User.role` relation filter — Prisma UserWhereInput does not support relation filters directly
- FCI formula uses open tickets (BACKLOG+TODO+IN_PROGRESS+ON_HOLD) with estimatedRepairCostUSD for deferred maintenance numerator

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed asset cost query structure**
- **Found during:** Task 1 (boardReportService.ts)
- **Issue:** Plan specified MaintenanceAsset.costEntries and laborEntries directly, but the schema has these on MaintenanceTicket — assets link to tickets, tickets link to costs
- **Fix:** Changed asset query to include `tickets.costEntries` and `tickets.laborEntries` nested structure
- **Files modified:** src/lib/services/boardReportService.ts
- **Verification:** TypeScript --noEmit passes
- **Committed in:** c989d02 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Zod v4 error API**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** `parsed.error.errors` does not exist in Zod v4 — the correct property is `parsed.error.issues`
- **Fix:** Changed `.errors.map(e => e.message)` to `.issues.map(e => e.message)` in both route handlers
- **Files modified:** src/app/api/maintenance/board-report/route.ts, export/route.ts
- **Verification:** TypeScript --noEmit passes
- **Committed in:** c989d02 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed Prisma UserWhereInput relation filter**
- **Found during:** Task 1 (TypeScript check on cron route)
- **Issue:** `{ role: { permissions: { some: { permissionId } } } }` is not valid in UserWhereInput — Prisma doesn't expose `role` as a filterable relation here
- **Fix:** Two-step query: first find roleIds with the permission via RolePermission table, then filter users by `roleId: { in: roleIds }`
- **Files modified:** src/app/api/cron/board-report-delivery/route.ts
- **Verification:** TypeScript --noEmit passes
- **Committed in:** c989d02 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 schema/API bugs, 1 Prisma query pattern bug)
**Impact on plan:** All auto-fixes required for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
- `ANTHROPIC_API_KEY` env var — required for AI narrative generation in PDF export. If not set, fallback template narrative is used automatically. Already configured for Phase 3 AI diagnostics.
- `CRON_SECRET` env var — required for cron delivery endpoint. Already configured for existing cron jobs.

## Next Phase Readiness
- Board report complete: live FCI dashboard, 1-click PDF export with AI narrative, weekly/monthly cron delivery
- Phase 6 compliance and reporting track is complete (Plans 01, 02, 03)
- REPORT-01 through REPORT-10 requirements fulfilled
- Ready for Phase 7: Knowledge Base and Offline PWA

---
*Phase: 06-compliance-board-reporting*
*Completed: 2026-03-06*
