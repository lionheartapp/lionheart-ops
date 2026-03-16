---
phase: 20
slug: registration-and-public-pages
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Smoke tests via `scripts/smoke-*.mjs` (no unit test framework) |
| **Config file** | None — Wave 0 creates `scripts/smoke-registration.mjs` |
| **Quick run command** | `node scripts/smoke-registration.mjs --test=<name>` |
| **Full suite command** | `npm run smoke:all` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/smoke-registration.mjs --test=<relevant-test>`
- **After every plan wave:** Run `npm run smoke:all`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | REG-01 | smoke | `node scripts/smoke-registration.mjs --test=form-config` | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | REG-02 | smoke | `node scripts/smoke-registration.mjs --test=custom-fields` | ❌ W0 | ⬜ pending |
| 20-01-03 | 01 | 1 | REG-03 | manual | n/a — visual inspection | manual-only | ⬜ pending |
| 20-02-01 | 02 | 1 | REG-04 | manual | n/a — visual inspection | manual-only | ⬜ pending |
| 20-02-02 | 02 | 1 | REG-05 | smoke | `node scripts/smoke-registration.mjs --test=payment-intent` | ❌ W0 | ⬜ pending |
| 20-02-03 | 02 | 1 | REG-06 | smoke | `node scripts/smoke-registration.mjs --test=signature` | ❌ W0 | ⬜ pending |
| 20-02-04 | 02 | 1 | REG-07 | smoke | `node scripts/smoke-registration.mjs --test=confirmation-email` | ❌ W0 | ⬜ pending |
| 20-03-01 | 03 | 2 | REG-08 | smoke | `node scripts/smoke-registration.mjs --test=magic-link` | ❌ W0 | ⬜ pending |
| 20-03-02 | 03 | 2 | REG-09 | smoke | `node scripts/smoke-registration.mjs --test=share-hub` | ❌ W0 | ⬜ pending |
| 20-03-03 | 03 | 2 | REG-10 | smoke | `node scripts/smoke-registration.mjs --test=waitlist-promotion` | ❌ W0 | ⬜ pending |
| 20-03-04 | 03 | 2 | REG-11 | smoke | `node scripts/smoke-registration.mjs --test=photo-upload` | ❌ W0 | ⬜ pending |
| 20-04-01 | 04 | 2 | REG-12 | smoke | `node scripts/smoke-registration.mjs --test=captcha-reject` | ❌ W0 | ⬜ pending |
| 20-04-02 | 04 | 2 | REG-13 | smoke | `node scripts/smoke-registration.mjs --test=medical-permission` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/smoke-registration.mjs` — stubs for all REG requirements
- [ ] Prisma schema additions (RegistrationForm, EventRegistration, RegistrationSensitiveData, RegistrationMagicLink, RegistrationPayment, RegistrationSignature, RegistrationFormSection, RegistrationFormField, RegistrationResponse)
- [ ] `npm run db:push` after schema additions
- [ ] New permission constant: `PERMISSIONS.EVENTS_MEDICAL_READ = 'events:medical:read'`
- [ ] Seed `Permission` row for `events:medical:read` via `seedOrgDefaults`
- [ ] New env vars documented: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] Middleware: add `/events/` and `/api/events/register/` and `/api/registration/` to `isPublicPath`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sections render as wizard steps with progress indicator | REG-03 | Visual layout verification | Create form with 3+ sections; open public page; verify step indicator shows, pages advance/go back |
| Public page shows school branding, no Lionheart chrome | REG-04 | Visual branding verification | Open public event page; verify org logo, cover image, no sidebar/header from dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
