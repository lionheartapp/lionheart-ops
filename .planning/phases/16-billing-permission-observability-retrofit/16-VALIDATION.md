---
phase: 16
slug: billing-permission-observability-retrofit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (installed in Phase 13) |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | SET-02 | unit | `npx vitest run __tests__/lib/permissions.test.ts` | Partial — needs new test case | ⬜ pending |
| 16-01-02 | 01 | 1 | SET-02 | smoke | `node scripts/backfill-billing-permission.mjs` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | INFRA-03 | grep check | `grep -rL "from '@/lib/logger'" [21 files] \| wc -l` (expect 0) | N/A | ⬜ pending |
| 16-02-02 | 02 | 1 | INFRA-04 | grep check | `grep -rL "Sentry.captureException" [21 files] \| wc -l` (expect 0) | N/A | ⬜ pending |
| 16-01-03 | 01 | 1 | SET-02 | smoke/manual | Admin user GET /api/settings/billing returns 200 | Existing smoke tests | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/backfill-billing-permission.mjs` — DB backfill script for admin role permission
- [ ] New test case in `__tests__/lib/permissions.test.ts` — verify `DEFAULT_ROLES.ADMIN.permissions` includes `PERMISSIONS.SETTINGS_BILLING`

*Existing infrastructure covers framework — only the backfill script and one new test case are missing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin billing API access (200 not 403) | SET-02 | Requires authenticated session with admin role | 1. Login as admin user 2. GET /api/settings/billing 3. Verify 200 response |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
