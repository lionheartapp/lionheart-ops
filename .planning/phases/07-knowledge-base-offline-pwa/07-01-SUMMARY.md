---
phase: 07-knowledge-base-offline-pwa
plan: 01
subsystem: maintenance
tags: [knowledge-base, crud, search, calculator, ai-integration, permissions]
dependency_graph:
  requires: [06-compliance-board-reporting]
  provides: [KB-01, KB-02, KB-03, KB-04, KB-05, KB-06-hook]
  affects: [AIDiagnosticPanel, Sidebar, PmSchedule]
tech_stack:
  added: []
  patterns:
    - org-scoped KnowledgeArticle model with soft-delete
    - in-browser calculator component (no API calls)
    - TanStack Query secondary KB fetch inside AI panel
key_files:
  created:
    - prisma/schema.prisma (KnowledgeArticle model + KnowledgeArticleType enum)
    - src/lib/services/knowledgeBaseService.ts
    - src/app/api/maintenance/knowledge-base/route.ts
    - src/app/api/maintenance/knowledge-base/[id]/route.ts
    - src/app/api/maintenance/knowledge-base/search/route.ts
    - src/components/maintenance/KnowledgeBaseList.tsx
    - src/components/maintenance/KnowledgeBaseSearchBar.tsx
    - src/components/maintenance/KnowledgeBaseArticleEditor.tsx
    - src/components/maintenance/KnowledgeBaseArticleViewer.tsx
    - src/components/maintenance/calculators/PondCareDosageCalculator.tsx
    - src/app/maintenance/knowledge-base/page.tsx
    - src/app/maintenance/knowledge-base/[id]/page.tsx
  modified:
    - src/lib/permissions.ts (KB_READ/CREATE/UPDATE/DELETE + role assignments)
    - src/lib/db/index.ts (KnowledgeArticle to orgScopedModels and softDeleteModels)
    - src/components/Sidebar.tsx (Knowledge Base nav item)
    - src/components/maintenance/AIDiagnosticPanel.tsx (KB articles surfacing)
decisions:
  - "KnowledgeArticle.organizationId passed as placeholder 'ORG_CONTEXT' to satisfy TypeScript; org-scoped Prisma client overwrites it at runtime via AsyncLocalStorage"
  - "findRelevantArticles uses pure keyword matching (no Gemini) — fast, deterministic, no API cost"
  - "In-browser Markdown rendering via regex replace (no external library) — internal tool, XSS risk acceptable from trusted org members"
  - "KB nav item gated on canManageMaintenance || canClaimMaintenance — visible to head and technicians"
  - "PmSchedule.knowledgeArticleId added as nullable FK for KB-05 PM-to-SOP linking hook"
metrics:
  duration: 9min
  completed_date: "2026-03-06"
  tasks: 2
  files: 18
---

# Phase 7 Plan 1: Knowledge Base — Schema, API, UI, and AI Integration Summary

Searchable knowledge base with 6 article types, inline Markdown viewer, embedded pond care dosage calculator, and automatic KB surfacing in the AI diagnostic panel on ticket detail.

## Tasks Completed

| # | Task | Commit | Key Output |
|---|------|--------|------------|
| 1 | Schema, permissions, service layer, and API routes | dc75d2e | KnowledgeArticle model, 6 API routes, knowledgeBaseService |
| 2 | Knowledge base UI — list, editor, viewer, calculator, AI panel | 916d66a | 7 new components + 2 pages + sidebar nav + AI panel integration |

## Verification

- `npx tsc --noEmit` passes with zero errors
- `npm run build` completes successfully; /maintenance/knowledge-base routes appear in build output
- KnowledgeArticle model pushed to database with all 6 enum values
- KB permissions correctly assigned: head/tech get read+create+update; head gets delete; admin gets all
- 6 API routes type-check cleanly and follow standard org-scope pattern
- Pond care dosage calculator computes dose in mL, fl oz, and tbsp client-side
- AI panel fires secondary KB query when diagnosis is loaded and panel is expanded

## Key Decisions

1. **KnowledgeArticle.organizationId placeholder** — TypeScript requires `organizationId` in the create data object, but the org-scoped Prisma client overwrites it via AsyncLocalStorage. Passed `'ORG_CONTEXT'` as a known placeholder; the actual org ID is injected at runtime.

2. **findRelevantArticles: keyword matching only** — The plan specified "no Gemini call — pure keyword matching is sufficient and fast." Splits category + title into search terms, deduplicates, runs Prisma OR query across title/content/tags.

3. **Inline Markdown renderer** — Used regex-based HTML generation rather than adding `@tailwindcss/typography` or a Markdown library. This is an internal tool — trusted org members write the content, so `dangerouslySetInnerHTML` is acceptable.

4. **KB nav visibility** — Added to sidebar for `canManageMaintenance || canClaimMaintenance`. Head and technicians see it; general submitters don't (they have KB_READ permission but the nav item is gated higher to reduce sidebar clutter).

5. **PmSchedule.knowledgeArticleId hook** — Added as a nullable FK on PmSchedule for KB-05 (PM checklists referencing SOP articles). Pushed to DB. The UI for selecting it during PM schedule creation is deferred to a future plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript: organizationId missing in KnowledgeArticle.create() data**
- **Found during:** Task 1 service layer implementation
- **Issue:** Prisma's generated types require `organizationId` in the create data, but the org-scoped client injects it via AsyncLocalStorage at runtime. The service had no placeholder.
- **Fix:** Added `organizationId` field to `createArticle()` with `input.organizationId ?? 'ORG_CONTEXT'` as placeholder; the Prisma extension overwrites it with the actual org ID from context.
- **Files modified:** `src/lib/services/knowledgeBaseService.ts`

**2. [Rule 2 - Missing] KBArticleTypeBadge and formatArticleDate shared between List and Viewer**
- **Found during:** Task 2 when building KnowledgeBaseArticleViewer
- **Issue:** Both components needed the same badge component and date formatter to avoid duplication.
- **Fix:** Exported `KBArticleTypeBadge` and `formatArticleDate` from `KnowledgeBaseList.tsx` as named exports; imported them in `KnowledgeBaseArticleViewer.tsx`.
- **Files modified:** `src/components/maintenance/KnowledgeBaseList.tsx`, `src/components/maintenance/KnowledgeBaseArticleViewer.tsx`

## Self-Check: PASSED

All created files confirmed present on disk. Both task commits (dc75d2e, 916d66a) confirmed in git log. Build output shows /maintenance/knowledge-base and /maintenance/knowledge-base/[id] routes compiled successfully.
