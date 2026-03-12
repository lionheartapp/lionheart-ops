---
phase: 18
slug: integration-gap-closure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (vitest.config.mts) |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run __tests__/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run __tests__/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | SET-05, INV-04 | unit | `npx vitest run __tests__/lib/notificationService.test.ts` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | INFRA-03, INFRA-04 | unit | `npx vitest run __tests__/api/ai-routes.test.ts` | ❌ W0 | ⬜ pending |
| 18-01-03 | 01 | 1 | AUTH-03 | manual | Code review of middleware.ts | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/lib/notificationService.test.ts` — stubs for SET-05/INV-04 bulk preference filtering
- [ ] `__tests__/api/ai-routes.test.ts` — stubs for INFRA-03/INFRA-04 generate-description and parse-event instrumentation

*Existing infrastructure covers rate-limiting verification (AUTH-03) via code review.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Middleware applies `publicApiRateLimiter` to `resend-verification` | AUTH-03 | 1-line config addition, code review sufficient | Inspect middleware.ts for `resend-verification` in rate limiter branch |
| E2E Inventory Checkout → Low-Stock → Preference Check → Delivery flow | INV-04, SET-05 | Cross-service flow requiring runtime state | Walkthrough via `/gsd:verify-work` UAT |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
