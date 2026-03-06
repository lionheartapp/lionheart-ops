---
phase: 05-analytics-repair-intelligence
plan: 01
subsystem: maintenance-analytics
tags: [analytics, recharts, dashboard, maintenance]
dependency_graph:
  requires: [04-assets-qr-pm, prisma/schema.prisma]
  provides: [maintenance-analytics-service, analytics-api-route, analytics-dashboard-page]
  affects: [sidebar-nav, maintenance-module]
tech_stack:
  added: [recharts@2.x]
  patterns:
    - TanStack Query with refetchInterval 60s for live-refresh
    - rawPrisma in analytics service (cross-entity aggregations, manual org scoping)
    - Recharts ResponsiveContainer for all charts
    - Glassmorphism ui-glass cards with Framer Motion stagger entrance
key_files:
  created:
    - src/lib/services/maintenanceAnalyticsService.ts
    - src/app/api/maintenance/analytics/route.ts
    - src/components/maintenance/AnalyticsDashboard.tsx
    - src/components/maintenance/charts/TicketsByStatusChart.tsx
    - src/components/maintenance/charts/ResolutionTimeChart.tsx
    - src/components/maintenance/charts/TechnicianWorkloadChart.tsx
    - src/components/maintenance/charts/LaborHoursChart.tsx
    - src/components/maintenance/charts/CostByBuildingChart.tsx
    - src/components/maintenance/charts/CategoryBreakdownChart.tsx
    - src/app/maintenance/analytics/page.tsx
  modified:
    - src/components/Sidebar.tsx
    - package.json
decisions:
  - "rawPrisma used in analytics service for cross-entity aggregations; orgId passed explicitly to avoid runWithOrgContext requirement"
  - "PM Compliance rendered inline in AnalyticsDashboard rather than separate chart component — stat cards are more useful than a pie chart for 3 values"
  - "Campus filter resolves via school.campusId join — analytics service fetches schoolIds for given campusId then applies IN filter"
  - "Top 10 locations grouped by [buildingId, areaId, roomId] composite — resolves names in batch after groupBy to minimize DB round trips"
  - "Pre-existing html5-qrcode build failure is out of scope — build was already broken before this plan"
metrics:
  duration: 8min
  completed: "2026-03-06T16:10:00Z"
  tasks: 2
  files_created: 10
  files_modified: 2
---

# Phase 05 Plan 01: Maintenance Analytics Dashboard Summary

**One-liner:** Recharts analytics dashboard with 8 live-refreshing chart sections covering ticket volume, resolution time, technician workload, PM compliance, labor hours, cost, locations, and category breakdown.

## What Was Built

### Task 1: Analytics Service + API Route (commit 48f0ba9)

Created `src/lib/services/maintenanceAnalyticsService.ts` with 8 typed aggregation functions:

| Function | Requirement | Data |
|----------|-------------|------|
| `getTicketsByStatus` | ANALYTICS-01 | Grouped by status + schoolId, joined to campus |
| `getResolutionTimeByCategory` | ANALYTICS-02 | DONE tickets: (updatedAt - createdAt) / 3.6M, avg by category |
| `getTechnicianWorkload` | ANALYTICS-03 | Active ticket counts + labor hours this week/month per tech |
| `getPmComplianceRate` | ANALYTICS-04 | PM tickets: completedOnTime / overdue / pending with rate |
| `getLaborHoursByMonth` | ANALYTICS-05 | Labor minutes → hours grouped by month and building |
| `getCostByBuilding` | ANALYTICS-06 | Labor cost (duration × loadedHourlyRate) + material costs by month/building |
| `getTopTicketLocations` | ANALYTICS-07 | groupBy [buildingId, areaId, roomId], top 10 with batch name joins |
| `getCategoryBreakdown` | ANALYTICS-08 | groupBy category with count + percentage |

`getAllAnalytics` calls all 8 in parallel via `Promise.all`.

API route at `GET /api/maintenance/analytics` uses `MAINTENANCE_VIEW_ANALYTICS` permission, accepts `campusId`, `schoolId`, `months` params, returns `Cache-Control: no-cache`.

### Task 2: Dashboard + Charts (commit ce267ff)

**6 chart components** in `src/components/maintenance/charts/`:
- `TicketsByStatusChart` — stacked BarChart, X=campus, segments=status, 8 colors
- `ResolutionTimeChart` — horizontal BarChart, Y=category, X=avgHours, category colors
- `TechnicianWorkloadChart` — grouped BarChart, X=tech name (truncated), bars=active tickets + hours/month
- `LaborHoursChart` — stacked AreaChart with gradient fills, X=month, one series per building
- `CostByBuildingChart` — grouped BarChart top-5 buildings, custom tooltip shows labor/materials split
- `CategoryBreakdownChart` — donut PieChart with outer labels showing category + count

**AnalyticsDashboard.tsx** orchestrator:
- TanStack Query with `refetchInterval: 60_000` for live updates
- Campus selector dropdown (All Campuses + individual campuses from queryOptions.campuses())
- 5-row layout: status (full), resolution+PM (2-col), workload (full), labor+cost (2-col), locations+category (2-col)
- PM Compliance rendered inline with 3 gradient stat cards + compliance rate number + progress bar
- Top 10 Locations rendered as ranked list with CSS-width progress bars
- `animate-pulse` skeleton matching final layout shape during loading
- Framer Motion staggerContainer + cardEntrance for entrance animations
- `ui-glass p-6` cards with emerald-themed accent for maintenance module

**Page** at `/maintenance/analytics` follows exact same pattern as other maintenance pages (DashboardLayout + ModuleGate + Suspense).

**Sidebar** updated with Analytics nav item (BarChart2 icon, `canManageMaintenance` gated).

## Deviations from Plan

### Auto-fixed Issues

None.

### Out-of-Scope Items (logged, not fixed)

**Pre-existing build failure:** `html5-qrcode` module not found in `QRScannerInner.tsx`. This caused `npm run build` to fail before this plan was started (confirmed via `git stash` + build test). Logged to deferred-items.md. TypeScript (`npx tsc --noEmit`) passes cleanly for all new files.

## Self-Check: PASSED

All 10 created files verified present. Both commits (48f0ba9, ce267ff) verified in git log. Key patterns confirmed: refetchInterval 60_000, getAllAnalytics export, MAINTENANCE_VIEW_ANALYTICS permission check.
