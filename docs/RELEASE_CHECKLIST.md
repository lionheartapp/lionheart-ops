# Release Checklist

## Pre-merge (Required)

- CI is green for both app builds:
  - `CI / Build (root)`
  - `CI / Build (platform)`
- Security scan is green:
  - `CodeQL / Analyze (javascript-typescript)`
- At least one approving review from code owners.
- No unresolved review comments on the PR.

## Pre-deploy

- Confirm production env vars exist for root app and `platform` app.
- Confirm Prisma schema migrations are up to date and reviewed.
- Verify login flow and `/app/settings` navigation in a preview deployment.
- Verify one API endpoint from each critical area: auth, billing, events, inventory.

## Deploy

- Merge to `main`.
- Watch GitHub Actions for `CI` and `CodeQL` completion.
- Watch Vercel deployment status and verify health endpoint/app load.

## Post-deploy smoke test

- Sign in as Admin and confirm Dashboard loads.
- Open Settings and confirm it stays on `/app/settings` (no dashboard redirect).
- Create and view one Event.
- Open Inventory tab and verify list renders.
- Confirm no new runtime errors in browser console.

## Rollback trigger

- Roll back immediately if auth, settings navigation, or data writes regress.
