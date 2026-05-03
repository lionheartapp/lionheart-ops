# Per-Role Flow Specs

These specs walk through the most common user journeys for each role. They're
deliberately forgiving with selectors so a small UI rename doesn't break the
suite — when a journey *changes*, update the spec to match the new flow.

## What's here

| File | Role | What it covers |
|------|------|----------------|
| `super-admin.spec.ts` | Org owner / super-admin | Sidebar visibility, Invite User modal, Create Role flow, Campus tab |
| `member.spec.ts` | Standard member | Dashboard hides admin widgets, ticket creation, denied from /settings/roles |
| `ticket-lifecycle.spec.ts` | member ↔ admin | Cross-role: member creates → admin sees + closes; member has no delete |

## Adding a role

If you add a new role (e.g. `viewer`, `parent`, `student`), do this:

1. Add a test user for the role to `scripts/setup-e2e-users.mjs` and re-seed staging.
2. Add the credentials to `.env.e2e` (`E2E_VIEWER_EMAIL` etc.) and `helpers/env.ts`.
3. Add a `viewerPage` fixture in `e2e/fixtures/index.ts` that calls `apiLogin` with those creds.
4. Create `e2e/ui/flows/viewer.spec.ts` and exercise the read-only journeys
   (list pages render, no Add/Edit/Delete buttons visible, hits to mutating
   URLs return 403).

## What these specs are NOT

- **Not exhaustive coverage** — that's `buttons-smoke`, `forms-smoke`, the link
  crawler, and the permission matrix.
- **Not pixel-perfect** — visual regression is Storybook + Chromatic territory
  (queued for Week 3).
- **Not load tests** — `npm run perf:load` covers that.

These are the human-shaped journeys: log in, do the thing the role exists to
do, log out. If a role's specs all pass, the product is at least minimally
usable for that persona.
