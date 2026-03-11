# Phase 13: Infrastructure and Observability - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the platform observable, testable, and safe to continuously deploy. This phase adds Vitest unit tests, upgrades GitHub Actions CI/CD, replaces console.* with Pino structured logging, integrates Sentry error tracking, adds offset pagination to high-volume list endpoints, and wraps complex multi-model operations in database transactions.

Requirements: INFRA-01 through INFRA-06.

</domain>

<decisions>
## Implementation Decisions

### Test Coverage Priorities
- Priority order: auth & permissions → multi-tenancy layer → core CRUD routes (tickets, events, calendar, inventory)
- Testing depth: unit tests + light integration tests
- Integration tests use a local Docker Postgres container in CI (not Supabase dev DB)
- Existing smoke tests (`scripts/smoke-*.mjs`) stay separate — not migrated into Vitest
- Vitest is the test runner (already decided in PROJECT.md)

### Pagination Defaults
- Offset-based pagination: `?page=2&limit=25` using Prisma `skip`/`take`
- Default page size: 25 items
- Responses include `totalCount` and `totalPages` (enables "Page 2 of 8" UI)
- Retrofit high-volume endpoints first: tickets, events, users, audit logs, inventory, calendar-events
- Lower-volume endpoints can be paginated later

### Error Tracking (Sentry)
- Sentry for error tracking (confirmed over Vercel-only monitoring)
- Email digest notifications (not real-time per-error alerts)
- Error context captured: org ID, route, user role — no PII (no emails, names)
- Performance monitoring enabled (trace slow API routes and page loads)
- Sentry runs alongside Vercel — Vercel for hosting/deployment, Sentry for error/performance monitoring

### Structured Logging (Pino)
- Pino structured JSON logging replacing all `console.error/warn/log` calls in route handlers (68 calls across 30 files)
- Log fields per request: org ID, route, response timing — no user-level PII
- Log destination: Vercel's built-in log drain (Pino outputs JSON to stdout, Vercel captures automatically)
- Default log level: `info` in production, `debug` in development
- Never log request/response bodies — K-12 platform with FERPA-adjacent data sensitivity
- Use Sentry (not logs) for detailed error context and stack traces

### Claude's Discretion
- Vitest configuration details (setup files, module mocking strategy, coverage thresholds)
- Pino logger initialization pattern (singleton, per-request, middleware)
- Sentry SDK configuration (sample rates, ignored errors, environment tagging)
- Which specific routes qualify as "high-volume" for pagination priority
- Transaction wrapping strategy for existing sequential-await patterns
- CI pipeline step ordering and caching strategy
- Test file organization (`__tests__/` vs co-located `.test.ts`)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CI workflow exists**: `.github/workflows/ci.yml` — currently runs build + architecture check. Needs test, lint, and type-check steps added.
- **CodeQL workflow**: `.github/workflows/codeql.yml` — security scanning already in place.
- **`$transaction` usage**: 11 files already use Prisma transactions — established pattern to follow for new transaction wrapping.
- **Partial pagination**: 19 API files already use `take`/`skip`/`cursor` — can reference these as the pattern to standardize.

### Established Patterns
- **Route handler pattern**: All routes follow `getOrgIdFromRequest → getUserContext → assertCan → runWithOrgContext → prisma.*` boilerplate.
- **Response envelope**: `ok(data)` / `fail('CODE', 'message')` from `src/lib/api-response.ts` — pagination metadata should extend this envelope.
- **Error handling**: Catch blocks currently use `console.error` + generic `fail('INTERNAL_ERROR')` — Pino + Sentry replace the console.error part.

### Integration Points
- **68 console.* calls in 30 route files** need replacing with Pino logger calls
- **CI pipeline** needs Vitest test step, ESLint step, TypeScript type-check step added to existing `ci.yml`
- **Sentry SDK** wraps Next.js config (`next.config.js`) and adds error boundary
- **Pagination helper** should be a shared utility used by all paginated routes

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for all infrastructure tooling.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-infrastructure-and-observability*
*Context gathered: 2026-03-11*
