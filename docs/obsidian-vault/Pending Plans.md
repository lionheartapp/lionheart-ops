---
aliases: [Future Work, TODO, Backlog]
tags: [development, planning, backlog]
created: 2026-04-08
---

# Pending Plans & Future Work

## Event People Tab — COMPLETE

Shipped with EventTeamMember model, CRUD API, eventTeamService, and full People tab UI with team management, role labels, and integration with schedule/task pickers.

See [[Completed Features]] and [[Components#Events (~60 files)]].

## Add-ons Pricing (Future)

Athletics (and future add-on modules) should be paid extras, not free toggles. Current `AddOnsTab` and `POST /api/modules` are simple enable/disable — will need pricing tiers, Stripe integration, and purchase/upgrade flow when ready.

See [[Completed Features#Add-ons System]].

## Known Issues

_None currently._

## Resolved

- **Turbopack + Pino** — Fixed. Dev uses lightweight console logger (no pino import), prod uses real pino via dynamic `require()`. `--turbopack` enabled in dev script. (`src/lib/logger.ts`, `next.config.ts`, `package.json`)
