/**
 * Lionheart Platform — k6 Load Test
 *
 * Simulates realistic user traffic across the most frequently used API
 * endpoints. Mimics what the dashboard, calendar, tickets, settings, search,
 * notifications, and athletics modules do when a typical staff member is
 * actively using the app.
 *
 * Prerequisites:
 *   1. k6 installed: https://k6.io/docs/get-started/installation/
 *   2. Dev server running on port 3004 (or set BASE_URL)
 *   3. A seeded org with at least one active user
 *
 * Usage:
 *   k6 run -e ORG_ID=<uuid> \
 *          -e AUTH_EMAIL=admin@demo.com \
 *          -e AUTH_PASSWORD=password123 \
 *          scripts/perf/load-test.js
 *
 * Override thresholds with --config or env vars as needed.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { BASE_URL, ORG_ID, authenticate, authHeaders } from './config.js';

// ----- Custom metrics -----
const loginDuration    = new Trend('login_duration', true);
const searchDuration   = new Trend('search_duration', true);
const ticketsDuration  = new Trend('tickets_list_duration', true);
const calendarDuration = new Trend('calendar_events_duration', true);
const usersDuration    = new Trend('users_list_duration', true);
const notifDuration    = new Trend('notifications_duration', true);
const athleticsDuration = new Trend('athletics_dashboard_duration', true);
const apiErrors        = new Counter('api_errors');
const successRate      = new Rate('api_success_rate');

// ----- Test options -----
export const options = {
  scenarios: {
    // Ramp-up load test: start small, climb to target, hold, then ramp down
    standard_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },  // warm-up
        { duration: '1m',  target: 20 },  // ramp to target
        { duration: '2m',  target: 20 },  // steady state
        { duration: '30s', target: 0  },  // cool-down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // Global latency: 95th percentile under 1 second
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    // Error rate below 2%
    http_req_failed: ['rate<0.02'],
    // Custom thresholds per endpoint group
    login_duration:             ['p(95)<800'],
    search_duration:            ['p(95)<500'],
    tickets_list_duration:      ['p(95)<600'],
    calendar_events_duration:   ['p(95)<800'],
    users_list_duration:        ['p(95)<600'],
    notifications_duration:     ['p(95)<300'],
    athletics_dashboard_duration: ['p(95)<1000'],
    api_success_rate:           ['rate>0.98'],
  },
};

// ----- Setup: authenticate once, share token across VUs -----
export function setup() {
  if (!ORG_ID) {
    console.error('ORG_ID env var is required. Pass it via: k6 run -e ORG_ID=<uuid> ...');
    return { token: null };
  }

  const token = authenticate(http);
  if (!token) {
    console.error('Authentication failed during setup. Check credentials.');
  }
  return { token };
}

// ----- Helpers -----
function trackResult(res, metricTrend) {
  const ok = res.status >= 200 && res.status < 400;
  if (metricTrend) metricTrend.add(res.timings.duration);
  if (!ok) apiErrors.add(1);
  successRate.add(ok);
  return ok;
}

function apiGet(token, path, metricTrend, tag) {
  const res = http.get(`${BASE_URL}${path}`, {
    headers: authHeaders(token),
    tags: { endpoint: tag || path },
  });
  trackResult(res, metricTrend);
  return res;
}

// ----- Main VU function -----
export default function (data) {
  if (!data.token) {
    sleep(1);
    return;
  }
  const token = data.token;

  // Each VU iteration simulates a user session touching multiple features.

  group('Login', () => {
    const payload = JSON.stringify({
      email: __ENV.AUTH_EMAIL || '',
      password: __ENV.AUTH_PASSWORD || '',
      organizationId: ORG_ID,
    });
    const res = http.post(`${BASE_URL}/api/auth/login`, payload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'POST /api/auth/login' },
    });
    loginDuration.add(res.timings.duration);
    check(res, {
      'login: status 200': (r) => r.status === 200,
      'login: has token': (r) => {
        try { return JSON.parse(r.body).data?.token?.length > 0; } catch { return false; }
      },
    });
    trackResult(res, null);
  });

  sleep(0.5);

  group('Notifications — unread count', () => {
    const res = apiGet(token, '/api/notifications/unread-count', notifDuration, 'GET /api/notifications/unread-count');
    check(res, {
      'notifications: status 200': (r) => r.status === 200,
    });
  });

  sleep(0.3);

  group('Search', () => {
    // Simulate typing a search query
    const queries = ['admin', 'room', 'test', 'event', 'math'];
    const q = queries[Math.floor(Math.random() * queries.length)];
    const res = apiGet(token, `/api/search?q=${q}&limit=5`, searchDuration, 'GET /api/search');
    check(res, {
      'search: status 200': (r) => r.status === 200,
      'search: has results object': (r) => {
        try { const b = JSON.parse(r.body); return b.ok && b.data !== undefined; } catch { return false; }
      },
    });
  });

  sleep(0.5);

  group('Tickets — list', () => {
    const res = apiGet(token, '/api/tickets?limit=20&offset=0', ticketsDuration, 'GET /api/tickets');
    check(res, {
      'tickets: status 200': (r) => r.status === 200,
    });
  });

  sleep(0.3);

  group('Calendar events — current month', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const res = apiGet(
      token,
      `/api/calendar-events?start=${start}&end=${end}`,
      calendarDuration,
      'GET /api/calendar-events'
    );
    check(res, {
      'calendar: status 200 or 400': (r) => r.status === 200 || r.status === 400,
    });
  });

  sleep(0.3);

  group('Settings — users list', () => {
    const res = apiGet(token, '/api/settings/users', usersDuration, 'GET /api/settings/users');
    check(res, {
      'users: status 200 or 403': (r) => r.status === 200 || r.status === 403,
    });
  });

  sleep(0.3);

  group('Athletics — dashboard', () => {
    const res = apiGet(token, '/api/athletics/dashboard', athleticsDuration, 'GET /api/athletics/dashboard');
    check(res, {
      'athletics: status 200 or 403': (r) => r.status === 200 || r.status === 403,
    });
  });

  sleep(0.5);

  group('Notifications — list', () => {
    const res = apiGet(token, '/api/notifications?limit=10', notifDuration, 'GET /api/notifications');
    check(res, {
      'notifications list: status 200': (r) => r.status === 200,
    });
  });

  // Pause between iterations to simulate think time
  sleep(Math.random() * 2 + 1);
}

// ----- Teardown -----
export function teardown(data) {
  if (!data.token) {
    console.warn('No auth token was available — all requests may have been skipped.');
  }
  console.log('Load test complete.');
}
