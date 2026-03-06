---
status: testing
phase: 04-assets-qr-pm
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md
started: 2026-03-06T23:00:00Z
updated: 2026-03-06T23:10:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 4
name: QR Scanner Modal
expected: |
  On the asset register page, click "Scan QR" button. A modal opens requesting camera access with a viewfinder UI.
awaiting: automated testing

## Tests

### 1. Asset Register Page
expected: Navigate to /maintenance/assets. You should see a table of assets (or empty state if none exist yet) with filter controls for category, building, status, and warranty. Sidebar should show "Assets" and "PM Calendar" nav items.
result: pass

### 2. Create New Asset
expected: Click "+ New Asset" button. A slide-over drawer opens with sections: Identity (name, category, make, model, serial), Location (building/area/room picker), Financials (purchase date, cost, warranty, repair threshold), and Notes. Submit creates an asset with auto-generated AST-XXXX number visible in the table.
result: pass

### 3. Asset Detail Page
expected: Click an asset row or navigate to /maintenance/assets/[id]. See identity section with QR code thumbnail, make/model/serial/location/warranty info. Below: repair cost gauge (green/amber/red based on cumulative cost vs threshold), ticket history table, and PM schedule section. "Report Issue" and "Edit" buttons available.
result: issue
reported: "Everything worked but it's going really slow"
severity: minor

### 4. QR Scanner Modal
expected: On the asset register page (/maintenance/assets), click "Scan QR" button in the header area. A modal opens requesting camera access with a viewfinder UI for scanning QR codes.
result: [pending]

### 5. Asset Search in Ticket Wizard
expected: Start the Submit Request wizard (create a new maintenance ticket). After the Location step, a new "Asset" step appears with a search input. Typing an asset name or AST-XXXX number shows debounced dropdown results. Selecting an asset or clicking "Skip" proceeds to the next step.
result: [pending]

### 6. PM Calendar Page
expected: Navigate to /maintenance/pm-calendar (or click "PM Calendar" in sidebar). See a calendar/list toggle. Calendar view shows a react-big-calendar month view with color-coded events (blue=upcoming, red=overdue). Switching to list view shows a sortable table with status badges and due date highlighting.
result: [pending]

### 7. Create PM Schedule
expected: On the PM calendar page, click "New PM Schedule" button. A 5-step wizard appears: Step 1 (Name/description), Step 2 (Recurrence type — daily/weekly/monthly/etc. with month picker for monthly), Step 3 (Checklist items with reorder arrows), Step 4 (Asset and location), Step 5 (Technician assignment). Completing the wizard creates a PM schedule visible in the calendar/list.
result: [pending]

### 8. PM Checklist on Ticket Detail
expected: Open a ticket that was generated from a PM schedule (has a PM Schedule badge in the header). Below the issue details, see a checklist section with progress bar and per-item checkboxes. Toggling items updates progress. When all items are checked, a green "All items complete" banner appears.
result: [pending]

### 9. QA Gate for PM Tickets
expected: On a PM-linked ticket with at least one unchecked checklist item, attempt to transition the ticket to QA status. The transition should be blocked — you should see an error message indicating the checklist must be complete before QA.
result: [pending]

### 10. Labor Timer on Ticket
expected: Open an IN_PROGRESS maintenance ticket. See a "Start Timer" button in the header area. Clicking it starts a timer with elapsed time display (animated pulse). Clicking "Stop" creates a labor entry and the elapsed time resets. Timer persists if you navigate away and come back.
result: [pending]

### 11. Labor & Cost Panel
expected: On any maintenance ticket detail page, see a collapsible panel on the right side. It shows 4 summary cards (total hours, labor cost, materials cost, grand total). Below the cards, sections for adding labor entries (manual time input) and cost entries (vendor autocomplete, amount, receipt upload option).
result: [pending]

### 12. Label Printing from Asset Detail
expected: On an asset detail page, click the QR code thumbnail. A modal opens with a larger QR view and a "Print Label" button. Clicking it generates and downloads a PDF label (2x1" with asset number and QR code).
result: [pending]

## Summary

total: 12
passed: 2
issues: 1
pending: 9
skipped: 0

## Gaps

- truth: "Asset detail page loads with identity, QR, repair gauge, ticket history, PM section"
  status: failed
  reason: "User reported: Everything worked but it's going really slow"
  severity: minor
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
