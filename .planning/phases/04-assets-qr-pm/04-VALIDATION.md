---
phase: 04
slug: assets-qr-pm
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Smoke test scripts (.mjs) + existing Playwright |
| **Config file** | `scripts/smoke-maintenance-assets.mjs` (Wave 0) |
| **Quick run command** | `node scripts/smoke-maintenance-assets.mjs` |
| **Full suite command** | `npm run smoke:all` |
| **Estimated runtime** | ~15 seconds (all 4 new scripts) |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/smoke-maintenance-assets.mjs`
- **After every plan wave:** Run all 4 new smoke scripts
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | ASSET-01, ASSET-02, ASSET-03 | smoke | `node scripts/smoke-maintenance-assets.mjs` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | ASSET-04, ASSET-05, ASSET-06, QR-01, QR-02, QR-03, QR-04, QR-05 | smoke | `node scripts/smoke-maintenance-qr.mjs` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | PM-01, PM-02, PM-03, PM-04, PM-05, PM-06, PM-10 | smoke | `node scripts/smoke-maintenance-pm.mjs` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | PM-07, PM-08, PM-09 | smoke | `node scripts/smoke-maintenance-pm.mjs` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 1 | LABOR-01, LABOR-02, LABOR-03, LABOR-04, LABOR-05, LABOR-06, LABOR-07 | smoke | `node scripts/smoke-maintenance-labor.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/smoke-maintenance-assets.mjs` — covers ASSET-01 through ASSET-06
- [ ] `scripts/smoke-maintenance-qr.mjs` — covers QR-01, QR-02, QR-04
- [ ] `scripts/smoke-maintenance-pm.mjs` — covers PM-01, PM-06, PM-07, PM-08, PM-10
- [ ] `scripts/smoke-maintenance-labor.mjs` — covers LABOR-01, LABOR-03, LABOR-04, LABOR-06, LABOR-07

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QR scan with phone camera | QR-02, QR-03 | Requires physical device camera | 1. Print QR label 2. Scan with iPhone/Android camera 3. Verify lands on asset detail page |
| QR scan with in-app scanner | QR-03 | Requires browser camera access | 1. Open in-app scanner 2. Point at QR code 3. Verify navigation to asset detail |
| PM calendar visual display | PM-09 | Visual layout verification | 1. Create PM schedule 2. Open PM Calendar 3. Verify color-coded events on correct dates |
| Timer start/stop UX | LABOR-01 | Interactive timing behavior | 1. Open ticket detail 2. Click Start Timer 3. Wait 30s 4. Click Stop 5. Verify labor entry created |
| Repair threshold alert visual | ASSET-06 | Visual gauge + banner display | 1. Create asset with $1000 replacement cost 2. Add tickets with cumulative $600 repairs 3. Verify gauge and alert banner |
| Receipt photo upload | LABOR-04 | File upload via browser | 1. Add cost entry 2. Click Attach Receipt 3. Upload photo 4. Verify thumbnail and full-size view |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
