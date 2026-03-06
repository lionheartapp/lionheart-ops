---
phase: 06-compliance-board-reporting
plan: 02
subsystem: compliance
tags: [prisma, postgresql, compliance, pdf-export, supabase-storage, jspdf, tanstack-query, framer-motion, next.js]

# Dependency graph
requires:
  - phase: 06-01
    provides: ComplianceDomainConfig, ComplianceRecord models, complianceService base functions, compliance page shell

provides:
  - generateComplianceTicket() and generateRemediationTicket() in complianceService.ts
  - getComplianceRecordsForExport() for audit PDF generation
  - POST /api/maintenance/compliance/records/[id]/generate-ticket (compliance and remediation types)
  - POST /api/maintenance/compliance/records/[id]/upload-url (Supabase signed URL for compliance-docs bucket)
  - GET /api/maintenance/compliance/export (jsPDF audit report as PDF binary)
  - ComplianceAttachmentPanel React component
  - ComplianceRecordDrawer React component
  - AuditExportDialog React component
  - remediationTicketId field on ComplianceRecord schema

affects: [06-compliance-board-reporting]

# Tech tracking
tech-stack:
  added:
    - jspdf v4.2.0 (already installed, used for server-side PDF generation in API route)
  patterns:
    - Supabase signed upload URL pattern: POST to get signed URL -> PUT file to Supabase -> PATCH record to append fileUrl
    - PDF binary response from Next.js route: Buffer.from(doc.output('arraybuffer')) -> new Response(pdfBuffer, headers)
    - Blob URL download pattern: fetch PDF with Auth header -> res.blob() -> URL.createObjectURL -> anchor.click()

key-files:
  created:
    - src/app/api/maintenance/compliance/records/[id]/generate-ticket/route.ts
    - src/app/api/maintenance/compliance/records/[id]/upload-url/route.ts
    - src/app/api/maintenance/compliance/export/route.ts
    - src/components/maintenance/compliance/ComplianceAttachmentPanel.tsx
    - src/components/maintenance/compliance/ComplianceRecordDrawer.tsx
    - src/components/maintenance/compliance/AuditExportDialog.tsx
  modified:
    - prisma/schema.prisma
    - src/lib/services/complianceService.ts
    - src/components/maintenance/compliance/ComplianceCalendar.tsx
    - src/app/maintenance/compliance/page.tsx

key-decisions:
  - "jsPDF v4 named export: import { jsPDF } from 'jspdf' — v4 uses named export, not default"
  - "Blob URL download for authenticated PDF GET: fetch with Authorization header, res.blob(), URL.createObjectURL avoids exposing token in URL"
  - "remediationTicketId required --accept-data-loss flag for db:push: adding @unique constraint on new nullable field triggers Prisma data-loss warning even though no existing data conflicts"
  - "Schema stash revert: git stash pop on a repo with untracked files can silently revert tracked file changes; schema re-applied and committed separately"

patterns-established:
  - "Three-step document upload: GET signed URL from API -> PUT file directly to Supabase signed URL -> PATCH record to append fileUrl to attachments array"
  - "PDF audit report with manual table layout using jsPDF doc.text() + doc.rect() + doc.line() (no jspdf-autotable dependency needed)"
  - "Compliance ticket generation idempotency: throw if generatedTicketId already set; same for remediationTicketId"

requirements-completed: [COMPLY-05, COMPLY-06, COMPLY-07, COMPLY-08]

# Metrics
duration: 8min
completed: 2026-03-06
---

# Phase 6 Plan 2: Ticket Auto-Generation, Document Upload, and Audit PDF Export Summary

**Ticket auto-generation from compliance records, Supabase signed-URL document attachment, and jsPDF audit report download — closing the loop between compliance calendar and maintenance ticket workflow**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-06T16:45:21Z
- **Completed:** 2026-03-06T16:53:47Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- `generateComplianceTicket()` and `generateRemediationTicket()` added to complianceService with priority logic and ticket number generation
- `remediationTicketId` field added to ComplianceRecord schema (with @unique, back-relation on MaintenanceTicket)
- Three new API routes: ticket generation (compliance/remediation), signed upload URL, and PDF export
- jsPDF audit report with summary table (by domain) and per-domain detail sections with page footers
- ComplianceRecordDrawer: slide-over for editing outcome/inspector/notes with animated entrance
- ComplianceAttachmentPanel: three-step upload flow (signed URL -> PUT -> PATCH), delete, 10-doc limit
- AuditExportDialog: date range, school, and domain filters with authenticated blob download
- Compliance page wired: export button in header, calendar rows open drawer

## Task Commits

1. **Task 1: Schema + service functions + API routes** - `9ddee1f` (feat) — service functions
2. **Task 1: Schema changes** - `35f6b27` (feat) — prisma/schema.prisma with remediationTicketId
3. **Task 2: UI components + page wiring** - `5158773` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - remediationTicketId on ComplianceRecord, RemediationTicket back-relation on MaintenanceTicket
- `src/lib/services/complianceService.ts` - generateComplianceTicket, generateRemediationTicket, getComplianceRecordsForExport
- `src/app/api/maintenance/compliance/records/[id]/generate-ticket/route.ts` - POST with type: compliance|remediation
- `src/app/api/maintenance/compliance/records/[id]/upload-url/route.ts` - POST for Supabase signed URL
- `src/app/api/maintenance/compliance/export/route.ts` - GET returning PDF binary via jsPDF
- `src/components/maintenance/compliance/ComplianceAttachmentPanel.tsx` - Upload panel with signed URL flow
- `src/components/maintenance/compliance/ComplianceRecordDrawer.tsx` - Full record editing slide-over
- `src/components/maintenance/compliance/AuditExportDialog.tsx` - PDF export modal with filters
- `src/components/maintenance/compliance/ComplianceCalendar.tsx` - Extended ComplianceRecord type
- `src/app/maintenance/compliance/page.tsx` - Wired drawer + export dialog

## Decisions Made
- jsPDF v4 uses named export `{ jsPDF }` not default — import pattern differs from v3
- Blob URL download approach for authenticated GET: avoids token exposure in URL query string
- `--accept-data-loss` flag required for db:push when adding `@unique` to a new nullable field (no actual data risk)
- Schema was accidentally reverted by git stash pop; re-applied and committed in separate commit `35f6b27`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Schema reverted by git stash pop**
- **Found during:** Task 1 verification
- **Issue:** Used `git stash` to check pre-existing TypeScript errors; `stash pop` reverted both `complianceService.ts` and `prisma/schema.prisma` changes on a repo with untracked files
- **Fix:** Re-applied both sets of changes; committed schema in separate commit (`35f6b27`)
- **Files modified:** prisma/schema.prisma, src/lib/services/complianceService.ts
- **Verification:** `git diff HEAD prisma/schema.prisma` shows no diff; Prisma client regenerated
- **Committed in:** 35f6b27 (schema commit)

**2. [Rule 1 - Bug] ComplianceRecord type mismatch between page and drawer**
- **Found during:** Task 2 TypeScript check
- **Issue:** Page's `ComplianceRecord.attachments` typed as `string[] | undefined` while drawer expected `string[]`
- **Fix:** Changed drawer's `attachments` to `string?` (optional) matching calendar/page types
- **Files modified:** src/components/maintenance/compliance/ComplianceRecordDrawer.tsx
- **Verification:** `npx tsc --noEmit` passes with no new errors
- **Committed in:** 5158773 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 git tooling issue, 1 TypeScript type mismatch)
**Impact on plan:** All auto-fixes were minor; no scope change.

## Issues Encountered
Pre-existing TypeScript errors in `boardReportService.ts` and `board-report/route.ts` (unrelated to this plan; present before any changes confirmed by stash test).

## User Setup Required
Supabase bucket `compliance-docs` must exist with public read access for file attachment upload to work. Create it in Supabase Storage dashboard.

## Next Phase Readiness
- Compliance ticket auto-generation and remediation workflow complete
- Document attachment upload pipeline established
- Audit PDF export ready for board reporting
- Ready for Phase 6 Plan 3 (Board Report Dashboard) if it exists, or Phase 7

---
*Phase: 06-compliance-board-reporting*
*Completed: 2026-03-06*
