/**
 * Lionheart Platform — k6 Endpoint Benchmark
 *
 * Targeted latency benchmarking for individual endpoints. Runs each
 * endpoint in isolation with a fixed number of VUs so you can compare
 * before/after performance when optimizing.
 *
 * Usage:
 *   k6 run -e ORG_ID=<uuid> \
 *          -e AUTH_EMAIL=admin@demo.com \
 *          -e AUTH_PASSWORD=password123 \
 *          scripts/perf/endpoint-benchmark.js
 *
 * To benchmark a single endpoint, pass ENDPOINT env:
 *   k6 run -e ENDPOINT=search ... scripts/perf/endpoint-benchmark.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL, ORG_ID, authenticate, authHeaders } from './config.js';

// Per-endpoint latency trends
const metrics = {
  login:         new Trend('bench_login', true),
  branding:      new Trend('bench_branding', true),
  search:        new Trend('bench_search', true),
  tickets:       new Trend('bench_tickets', true),
  calendar:      new Trend('bench_calendar_events', true),
  users:         new Trend('bench_users', true),
  roles:         new Trend('bench_roles', true),
  campus:        new Trend('bench_campus', true),
  notifications: new Trend('bench_notifications', true),
  athletics:     new Trend('bench_athletics_dashboard', true),
  calendars:     new Trend('bench_calendars', true),
  incidentsList:  new Trend('bench_incidents_list', true),
  incidentsCreate: new Trend('bench_incidents_create', true),
  incidentsDetail: new Trend('bench_incidents_detail', true),
  incidentsStatus: new Trend('bench_incidents_status', true),
  incidentsSearch: new Trend('bench_incidents_search', true),
};

const SELECTED_ENDPOINT = __ENV.ENDPOINT || 'all';

export const options = {
  scenarios: {
    benchmark: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
    },
  },
  thresholds: {
    bench_login:                ['p(50)<300', 'p(95)<600'],
    bench_branding:             ['p(50)<100', 'p(95)<300'],
    bench_search:               ['p(50)<200', 'p(95)<500'],
    bench_tickets:              ['p(50)<200', 'p(95)<500'],
    bench_calendar_events:      ['p(50)<300', 'p(95)<700'],
    bench_users:                ['p(50)<200', 'p(95)<500'],
    bench_roles:                ['p(50)<100', 'p(95)<300'],
    bench_campus:               ['p(50)<150', 'p(95)<400'],
    bench_notifications:        ['p(50)<100', 'p(95)<250'],
    bench_athletics_dashboard:  ['p(50)<300', 'p(95)<800'],
    bench_calendars:            ['p(50)<150', 'p(95)<400'],
    bench_incidents_list:       ['p(50)<200', 'p(95)<600'],
    bench_incidents_create:     ['p(50)<300', 'p(95)<800'],
    bench_incidents_detail:     ['p(50)<150', 'p(95)<500'],
    bench_incidents_status:     ['p(50)<200', 'p(95)<600'],
    bench_incidents_search:     ['p(50)<250', 'p(95)<700'],
  },
};

export function setup() {
  if (!ORG_ID) {
    console.error('ORG_ID env var is required.');
    return { token: null, incidentId: null };
  }
  const token = authenticate(http);
  if (!token) {
    console.error('Setup auth failed.');
    return { token: null, incidentId: null };
  }

  // Seed one incident for detail/status benchmarks
  let incidentId = null;
  if (SELECTED_ENDPOINT === 'all' || ['incidentsList', 'incidentsDetail', 'incidentsStatus', 'incidentsSearch', 'incidentsCreate'].includes(SELECTED_ENDPOINT)) {
    const payload = JSON.stringify({
      type: 'PHISHING',
      severity: 'MEDIUM',
      title: `Benchmark Seed Incident — ${Date.now()}`,
      description: 'Seeded for endpoint benchmark detail/status tests.',
    });
    const res = http.post(`${BASE_URL}/api/it/incidents`, payload, {
      headers: authHeaders(token),
    });
    if (res.status === 201) {
      try { incidentId = JSON.parse(res.body).data?.id; } catch {}
    }
  }

  return { token, incidentId };
}

function shouldRun(name) {
  return SELECTED_ENDPOINT === 'all' || SELECTED_ENDPOINT === name;
}

export default function (data) {
  if (!data.token) { sleep(1); return; }
  const token = data.token;
  const headers = authHeaders(token);

  if (shouldRun('login')) {
    group('bench: login', () => {
      const payload = JSON.stringify({
        email: __ENV.AUTH_EMAIL || '',
        password: __ENV.AUTH_PASSWORD || '',
        organizationId: ORG_ID,
      });
      const r = http.post(`${BASE_URL}/api/auth/login`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      metrics.login.add(r.timings.duration);
      check(r, { 'login 200': (r) => r.status === 200 });
    });
  }

  if (shouldRun('branding')) {
    group('bench: branding', () => {
      const r = http.get(`${BASE_URL}/api/branding`, {
        headers: { 'x-org-subdomain': 'demo' },
      });
      metrics.branding.add(r.timings.duration);
      check(r, { 'branding ok': (r) => r.status === 200 });
    });
  }

  if (shouldRun('search')) {
    group('bench: search', () => {
      const r = http.get(`${BASE_URL}/api/search?q=admin&limit=5`, { headers });
      metrics.search.add(r.timings.duration);
      check(r, { 'search 200': (r) => r.status === 200 });
    });
  }

  if (shouldRun('tickets')) {
    group('bench: tickets', () => {
      const r = http.get(`${BASE_URL}/api/tickets?limit=20`, { headers });
      metrics.tickets.add(r.timings.duration);
      check(r, { 'tickets ok': (r) => r.status < 500 });
    });
  }

  if (shouldRun('calendar')) {
    group('bench: calendar events', () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const r = http.get(`${BASE_URL}/api/calendar-events?start=${start}&end=${end}`, { headers });
      metrics.calendar.add(r.timings.duration);
      check(r, { 'calendar not error': (r) => r.status < 500 });
    });
  }

  if (shouldRun('users')) {
    group('bench: users', () => {
      const r = http.get(`${BASE_URL}/api/settings/users`, { headers });
      metrics.users.add(r.timings.duration);
      check(r, { 'users not error': (r) => r.status < 500 });
    });
  }

  if (shouldRun('roles')) {
    group('bench: roles', () => {
      const r = http.get(`${BASE_URL}/api/settings/roles`, { headers });
      metrics.roles.add(r.timings.duration);
      check(r, { 'roles not error': (r) => r.status < 500 });
    });
  }

  if (shouldRun('campus')) {
    group('bench: campus', () => {
      const r = http.get(`${BASE_URL}/api/settings/campus`, { headers });
      metrics.campus.add(r.timings.duration);
      check(r, { 'campus not error': (r) => r.status < 500 });
    });
  }

  if (shouldRun('notifications')) {
    group('bench: notifications', () => {
      const r = http.get(`${BASE_URL}/api/notifications/unread-count`, { headers });
      metrics.notifications.add(r.timings.duration);
      check(r, { 'notif 200': (r) => r.status === 200 });
    });
  }

  if (shouldRun('athletics')) {
    group('bench: athletics dashboard', () => {
      const r = http.get(`${BASE_URL}/api/athletics/dashboard`, { headers });
      metrics.athletics.add(r.timings.duration);
      check(r, { 'athletics not error': (r) => r.status < 500 });
    });
  }

  if (shouldRun('calendars')) {
    group('bench: calendars list', () => {
      const r = http.get(`${BASE_URL}/api/calendars`, { headers });
      metrics.calendars.add(r.timings.duration);
      check(r, { 'calendars not error': (r) => r.status < 500 });
    });
  }

  // --- Security Incidents Benchmarks ---

  if (shouldRun('incidentsList')) {
    group('bench: incidents list', () => {
      const r = http.get(`${BASE_URL}/api/it/incidents?limit=25`, { headers });
      metrics.incidentsList.add(r.timings.duration);
      check(r, { 'incidents list not error': (r) => r.status < 500 });
    });
  }

  if (shouldRun('incidentsCreate')) {
    group('bench: incidents create', () => {
      const types = ['PHISHING', 'MALWARE', 'UNAUTHORIZED_ACCESS', 'DATA_BREACH'];
      const type = types[Math.floor(Math.random() * types.length)];
      const r = http.post(`${BASE_URL}/api/it/incidents`, JSON.stringify({
        type,
        severity: 'LOW',
        title: `Bench Incident — ${Date.now()}`,
        description: 'Benchmark test incident.',
      }), { headers });
      metrics.incidentsCreate.add(r.timings.duration);
      check(r, { 'incidents create ok': (r) => r.status === 201 });
    });
  }

  if (shouldRun('incidentsDetail') && data.incidentId) {
    group('bench: incidents detail', () => {
      const r = http.get(`${BASE_URL}/api/it/incidents/${data.incidentId}`, { headers });
      metrics.incidentsDetail.add(r.timings.duration);
      check(r, { 'incidents detail not error': (r) => r.status < 500 });
    });
  }

  if (shouldRun('incidentsStatus') && data.incidentId) {
    group('bench: incidents status update', () => {
      // Toggle between INVESTIGATING and back by creating a fresh incident each time
      const createRes = http.post(`${BASE_URL}/api/it/incidents`, JSON.stringify({
        type: 'POLICY_VIOLATION',
        severity: 'LOW',
        title: `Bench Status Test — ${Date.now()}`,
        description: 'Created for status benchmark.',
      }), { headers });
      if (createRes.status === 201) {
        let newId = null;
        try { newId = JSON.parse(createRes.body).data?.id; } catch {}
        if (newId) {
          const r = http.put(`${BASE_URL}/api/it/incidents/${newId}/status`, JSON.stringify({
            status: 'INVESTIGATING',
          }), { headers });
          metrics.incidentsStatus.add(r.timings.duration);
          check(r, { 'incidents status update ok': (r) => r.status === 200 });
        }
      }
    });
  }

  if (shouldRun('incidentsSearch')) {
    group('bench: incidents search', () => {
      const queries = ['phishing', 'SEC-', 'bench', 'malware'];
      const q = queries[Math.floor(Math.random() * queries.length)];
      const r = http.get(`${BASE_URL}/api/it/incidents?search=${encodeURIComponent(q)}&limit=10`, { headers });
      metrics.incidentsSearch.add(r.timings.duration);
      check(r, { 'incidents search not error': (r) => r.status < 500 });
    });
  }

  sleep(0.5);
}

export function teardown() {
  console.log('Benchmark complete. Compare p50/p95 values across runs.');
}
