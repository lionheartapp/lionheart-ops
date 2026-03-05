/**
 * Lionheart Platform — k6 Stress Test
 *
 * Pushes the system well beyond expected load to find breaking points.
 * Ramps from 10 to 100+ concurrent users over several minutes, then
 * continues climbing to identify where errors spike or latency degrades.
 *
 * Usage:
 *   k6 run -e ORG_ID=<uuid> \
 *          -e AUTH_EMAIL=admin@demo.com \
 *          -e AUTH_PASSWORD=password123 \
 *          scripts/perf/stress-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { BASE_URL, ORG_ID, authenticate, authHeaders } from './config.js';

// ----- Custom metrics -----
const apiLatency  = new Trend('api_latency', true);
const apiErrors   = new Counter('api_errors');
const successRate = new Rate('api_success_rate');

// ----- Test options -----
export const options = {
  scenarios: {
    stress_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m',  target: 20  },   // warm-up
        { duration: '2m',  target: 50  },   // moderate
        { duration: '2m',  target: 100 },   // high
        { duration: '2m',  target: 150 },   // very high
        { duration: '1m',  target: 200 },   // peak
        { duration: '2m',  target: 200 },   // hold at peak
        { duration: '1m',  target: 0   },   // ramp down
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    // Stress thresholds are more lenient — we expect degradation
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed:   ['rate<0.10'],  // up to 10% errors accepted
    api_success_rate:  ['rate>0.90'],
  },
};

// ----- Setup -----
export function setup() {
  if (!ORG_ID) {
    console.error('ORG_ID env var is required.');
    return { token: null };
  }
  const token = authenticate(http);
  if (!token) console.error('Setup auth failed.');
  return { token };
}

// ----- Helpers -----
function track(res) {
  const ok = res.status >= 200 && res.status < 400;
  apiLatency.add(res.timings.duration);
  if (!ok) apiErrors.add(1);
  successRate.add(ok);
  return ok;
}

function get(token, path, tag) {
  const hdrs = tag === 'branding'
    ? { 'x-org-subdomain': 'demo' }
    : authHeaders(token);
  const res = http.get(`${BASE_URL}${path}`, {
    headers: hdrs,
    tags: { endpoint: tag || path },
  });
  track(res);
  return res;
}

// ----- Main VU function -----
export default function (data) {
  if (!data.token) { sleep(1); return; }
  const token = data.token;

  // Hit a random mix of endpoints to stress all code paths.
  const endpoints = [
    { path: '/api/notifications/unread-count',  tag: 'notifications-count',  weight: 25 },
    { path: '/api/search?q=test&limit=5',       tag: 'search',              weight: 15 },
    { path: '/api/tickets?limit=20',            tag: 'tickets',             weight: 15 },
    { path: '/api/settings/users',              tag: 'users',               weight: 10 },
    { path: '/api/athletics/dashboard',         tag: 'athletics-dashboard', weight: 10 },
    { path: '/api/calendars',                   tag: 'calendars',           weight: 10 },
    { path: '/api/settings/roles',              tag: 'roles',               weight: 5  },
    { path: '/api/settings/campus',             tag: 'campus',              weight: 5  },
    { path: '/api/branding',                    tag: 'branding',            weight: 5  },
  ];

  // Weighted random selection
  const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
  let pick = Math.random() * totalWeight;
  let selected = endpoints[0];
  for (const ep of endpoints) {
    pick -= ep.weight;
    if (pick <= 0) { selected = ep; break; }
  }

  group(selected.tag, () => {
    const res = get(token, selected.path, selected.tag);
    check(res, {
      [`${selected.tag}: not 5xx`]: (r) => r.status < 500,
    });
  });

  // Minimal think time under stress
  sleep(Math.random() * 0.5 + 0.2);
}

export function teardown(data) {
  console.log('Stress test complete. Review results for degradation patterns.');
}
