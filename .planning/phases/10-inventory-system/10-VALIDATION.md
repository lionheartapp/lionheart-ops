---
phase: 10
slug: inventory-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Smoke tests via `.mjs` scripts (existing pattern) |
| **Config file** | No Jest/Vitest config — project uses smoke scripts against live API |
| **Quick run command** | `npm run smoke:all` |
| **Full suite command** | `npm run smoke:all` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run smoke:all`
- **After every plan wave:** Run `npm run smoke:all`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | INV-01 | smoke | `node scripts/smoke-inventory.mjs` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | INV-02 | smoke | `node scripts/smoke-inventory.mjs` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | INV-03 | smoke | `node scripts/smoke-inventory.mjs` | ❌ W0 | ⬜ pending |
| 10-01-04 | 01 | 1 | INV-04 | smoke | `node scripts/smoke-inventory.mjs` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | INV-05 | manual | Manual: check NotificationBell after checkout below threshold | N/A | ⬜ pending |
| 10-03-01 | 03 | 2 | INV-06 | manual | Manual: visual inspection in browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/smoke-inventory.mjs` — stubs for INV-01, INV-02, INV-03, INV-04

*Smoke script covers CRUD + checkout + checkin + transaction log.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reorder alert notification | INV-05 | Requires UI inspection of NotificationBell component | 1. Set item reorderThreshold=5, quantityOnHand=3. 2. Checkout 1 unit. 3. Verify NotificationBell shows low-stock alert. |
| Inventory UI page with search/filters/drawer | INV-06 | Visual UI — no headless browser in test suite | 1. Navigate to /inventory. 2. Verify search bar, category filter, stock filter work. 3. Click item → verify transaction drawer opens. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
