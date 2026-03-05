/**
 * Lionheart Platform — k6 Spike Test
 *
 * Simulates a sudden surge of traffic (e.g., all-school announcement, start
 * of day login rush). Baseline is low, then VUs spike dramatically for a
 * short burst, then return to baseline.
 *
 * Usage:
 *   k6 run -e ORG_ID=<uuid> \
 *          -e AUTH_EMAIL=admin@demo.com \
 *          -e AUTH_PASSWORD=password123 \
 *          scripts/perf/spike-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { BASE_URL, ORG_ID, authenticate, authHeaders } from './config.js';

const apiLatency  = new Trend('api_latency', true);
const apiErrors   = new Counter('api_errors');
const successRate = new Rate('api_success_rate');

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5   },  // baseline
        { duration: '10s', target: 100 },  // spike up
        { duration: '1m',  target: 100 },  // hold spike
        { duration: '10s', target: 5   },  // spike down
        { duration: '30s', target: 5   },  // recovery
        { duration: '10s', target: 0   },  // done
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed:   ['rate<0.05'],  // 5% error budget during spike
    api_success_rate:  ['rate>0.95'],
  },
};

export function setup() {
  if (!ORG_ID) {
    console.error('ORG_ID env var is required.');
    return { token: null };
  }
  const token = authenticate(http);
  if (!token) console.error('Setup auth failed.');
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

  // Simulate the "morning rush" — every user loads dashboard + notifications
  // + calendar simultaneously.

  // 1. Notification check (every page load)
  const notifRes = http.get(`${BASE_URL}/api/notifications/unread-count`, {
    headers,
    tags: { endpoint: 'notifications-count' },
  });
  track(notifRes);
  check(notifRes, { 'notif: ok': (r) => r.status === 200 });

  // 2. Branding (loaded on every page for logo/theme)
  const brandRes = http.get(`${BASE_URL}/api/branding`, {
    headers: { 'x-org-subdomain': 'demo' },
    tags: { endpoint: 'branding' },
  });
  track(brandRes);

  // 3. Calendar events for today
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  const calRes = http.get(
    `${BASE_URL}/api/calendar-events?start=${dayStart}&end=${dayEnd}`,
    { headers, tags: { endpoint: 'calendar-events-today' } }
  );
  track(calRes);
  check(calRes, { 'cal: not error': (r) => r.status < 500 });

  // 4. Tickets list
  const ticketRes = http.get(`${BASE_URL}/api/tickets?limit=10`, {
    headers,
    tags: { endpoint: 'tickets' },
  });
  track(ticketRes);
  check(ticketRes, { 'tickets: ok': (r) => r.status === 200 });

  sleep(Math.random() * 0.5 + 0.3);
}

export function teardown() {
  console.log('Spike test complete. Check recovery behavior after the spike subsided.');
}
