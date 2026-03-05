/**
 * Lionheart Platform — k6 Soak Test
 *
 * Sustained moderate load over an extended period to detect:
 *   - Memory leaks
 *   - Connection pool exhaustion (Prisma/Supabase)
 *   - Permission cache bloat
 *   - Gradual response time degradation
 *
 * Recommended: run for 30+ minutes (default) or longer for real soak
 * validation. Set SOAK_DURATION env to override.
 *
 * Usage:
 *   k6 run -e ORG_ID=<uuid> \
 *          -e AUTH_EMAIL=admin@demo.com \
 *          -e AUTH_PASSWORD=password123 \
 *          -e SOAK_DURATION=30m \
 *          scripts/perf/soak-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { BASE_URL, ORG_ID, authenticate, authHeaders } from './config.js';

const apiLatency  = new Trend('api_latency', true);
const apiErrors   = new Counter('api_errors');
const successRate = new Rate('api_success_rate');

const soakDuration = __ENV.SOAK_DURATION || '30m';

export const options = {
  scenarios: {
    soak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m',          target: 15 },  // ramp up
        { duration: soakDuration,   target: 15 },  // sustained load
        { duration: '1m',          target: 0  },  // ramp down
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    http_req_failed:   ['rate<0.02'],
    api_success_rate:  ['rate>0.98'],
  },
};

export function setup() {
  if (!ORG_ID) {
    console.error('ORG_ID env var is required.');
    return { token: null };
  }
  const token = authenticate(http);
  if (!token) console.error('Setup auth failed.');
  console.log(`Soak test: ${soakDuration} sustained load at 15 VUs.`);
  return { token };
}

function track(res) {
  const ok = res.status >= 200 && res.status < 400;
  apiLatency.add(res.timings.duration);
  if (!ok) apiErrors.add(1);
  successRate.add(ok);
}

export default function (data) {
  if (!data.token) { sleep(1); return; }
  const token = data.token;
  const headers = authHeaders(token);

  // Rotate through typical user actions to exercise all major code paths
  const iteration = __ITER;
  const action = iteration % 8;

  switch (action) {
    case 0: { // Notification poll (most frequent in real usage)
      const r = http.get(`${BASE_URL}/api/notifications/unread-count`, { headers, tags: { endpoint: 'notif-count' } });
      track(r);
      check(r, { 'notif: 200': (r) => r.status === 200 });
      break;
    }
    case 1: { // Search
      const terms = ['room', 'admin', 'event', 'math', 'gym', 'office', 'test'];
      const q = terms[Math.floor(Math.random() * terms.length)];
      const r = http.get(`${BASE_URL}/api/search?q=${q}&limit=5`, { headers, tags: { endpoint: 'search' } });
      track(r);
      check(r, { 'search: ok': (r) => r.status === 200 });
      break;
    }
    case 2: { // Tickets
      const r = http.get(`${BASE_URL}/api/tickets?limit=20`, { headers, tags: { endpoint: 'tickets' } });
      track(r);
      check(r, { 'tickets: ok': (r) => r.status === 200 });
      break;
    }
    case 3: { // Calendar events — current week
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 6, 23, 59, 59).toISOString();
      const r = http.get(`${BASE_URL}/api/calendar-events?start=${start}&end=${end}`, { headers, tags: { endpoint: 'calendar' } });
      track(r);
      check(r, { 'calendar: not 5xx': (r) => r.status < 500 });
      break;
    }
    case 4: { // Users list
      const r = http.get(`${BASE_URL}/api/settings/users`, { headers, tags: { endpoint: 'users' } });
      track(r);
      check(r, { 'users: not 5xx': (r) => r.status < 500 });
      break;
    }
    case 5: { // Athletics dashboard
      const r = http.get(`${BASE_URL}/api/athletics/dashboard`, { headers, tags: { endpoint: 'athletics' } });
      track(r);
      check(r, { 'athletics: not 5xx': (r) => r.status < 500 });
      break;
    }
    case 6: { // Branding (public, no auth)
      const r = http.get(`${BASE_URL}/api/branding`, { headers: { 'x-org-subdomain': 'demo' }, tags: { endpoint: 'branding' } });
      track(r);
      break;
    }
    case 7: { // Notifications list
      const r = http.get(`${BASE_URL}/api/notifications?limit=10`, { headers, tags: { endpoint: 'notif-list' } });
      track(r);
      check(r, { 'notif-list: ok': (r) => r.status === 200 });
      break;
    }
  }

  // Simulate realistic pacing between actions
  sleep(Math.random() * 3 + 2);
}

export function teardown() {
  console.log('Soak test complete. Compare early vs. late p95 latency for regression.');
}
