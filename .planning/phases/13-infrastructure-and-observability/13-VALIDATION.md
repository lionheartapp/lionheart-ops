---
phase: 13
slug: infrastructure-and-observability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (to be installed in Wave 0) |
| **Config file** | `vitest.config.mts` — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | INFRA-01 | unit | `npx vitest run __tests__/lib/auth.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | INFRA-01 | unit | `npx vitest run __tests__/lib/permissions.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | INFRA-01 | unit | `npx vitest run __tests__/lib/org-context.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-04 | 01 | 1 | INFRA-01 | unit | `npx vitest run __tests__/api/tickets.test.ts` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | INFRA-02 | CI | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 1 | INFRA-02 | CI | `npm run lint` | ❌ W0 | ⬜ pending |
| 13-02-03 | 02 | 1 | INFRA-02 | CI | `npx vitest run` | ❌ W0 | ⬜ pending |
| 13-03-01 | 03 | 2 | INFRA-03 | unit | `npx vitest run __tests__/lib/logger.test.ts` | ❌ W0 | ⬜ pending |
| 13-04-01 | 04 | 2 | INFRA-04 | manual-only | Trigger 500 in staging, verify Sentry dashboard | N/A | ⬜ pending |
| 13-05-01 | 05 | 3 | INFRA-05 | unit | `npx vitest run __tests__/api/tickets.test.ts` | ❌ W0 | ⬜ pending |
| 13-06-01 | 06 | 3 | INFRA-06 | unit | `npx vitest run __tests__/api/roles.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.mts` — root config file
- [ ] `src/lib/__mocks__/db.ts` — Prisma mock singleton
- [ ] `__tests__/lib/auth.test.ts` — stubs for INFRA-01 (auth module)
- [ ] `__tests__/lib/permissions.test.ts` — stubs for INFRA-01 (permissions)
- [ ] `__tests__/lib/org-context.test.ts` — stubs for INFRA-01 (multi-tenancy)
- [ ] `__tests__/lib/logger.test.ts` — stubs for INFRA-03 (logger output)
- [ ] `__tests__/api/tickets.test.ts` — stubs for INFRA-01 + INFRA-05 (tickets route)
- [ ] `__tests__/api/roles.test.ts` — stubs for INFRA-06 (transaction wrapping)
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths vitest-mock-extended @testing-library/react @testing-library/dom jsdom`
- [ ] Pino install: `npm install pino pino-pretty`
- [ ] Sentry install: `npm install @sentry/nextjs`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sentry captures runtime errors with org ID context | INFRA-04 | Requires live Sentry project and deployed app | Trigger intentional 500 error in staging API route, verify error appears in Sentry dashboard within 5 minutes with org ID tag |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
