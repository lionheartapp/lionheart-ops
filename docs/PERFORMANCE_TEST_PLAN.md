# Lionheart Performance Test Plan

Goal: prove the app feels fast for real staff workflows, especially IT and maintenance.

## What We Measure

- API speed: p50, p95, and p99 response times.
- Error rate: failed or 5xx requests.
- Worker flow speed: IT and maintenance queues, dashboards, details, assets, and schedules.
- Page speed: login, dashboard, IT, maintenance, ticket detail, and mobile views.
- Load behavior: normal school-day traffic, peak morning traffic, and longer soak tests.

## Target Numbers

- Common list/detail API calls: p95 under 800 ms.
- Dashboards and analytics: p95 under 1,500 ms.
- Search: p95 under 600 ms.
- Error rate: under 2% during normal load.
- Login: p95 under 1,000 ms.

## Test Phases

1. Baseline read-only test.
   Run a light test against the hosted app. No records are created.

2. IT and maintenance worker test.
   Hit the endpoints that power daily work: queues, dashboards, tickets, assets, devices, incidents, schedules, vendors, and knowledge base.

3. Full app API test.
   Run the existing comprehensive k6 test against a seeded local or staging environment.

4. Browser page-speed test.
   Use Playwright to measure load and interaction times for desktop and mobile.

5. Stress test.
   Use staging only. Increase users until p95 latency or errors break the target.

6. Fix and retest.
   Re-run the same scripts after changes so results are comparable.

## Commands

Read-only IT and maintenance baseline:

```bash
node scripts/perf/run-perf.mjs worker-readiness --json
```

Existing app-wide benchmark:

```bash
node scripts/perf/run-perf.mjs comprehensive --json
```

Existing normal load test:

```bash
node scripts/perf/run-perf.mjs load --json
```

Use staging or local for write-heavy tests like incident load/stress tests.

