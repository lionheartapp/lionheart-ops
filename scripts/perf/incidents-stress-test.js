/**
 * Lionheart Platform — Security Incidents API Stress Test
 *
 * Pushes the incidents API to its breaking point by ramping VUs from 10 to
 * 100+. Identifies failure thresholds, connection pool exhaustion, and
 * serialization bottlenecks (especially the incident-number counter upsert).
 *
 * This test will deliberately push past expected capacity to find where
 * things break. High error rates at peak load are expected and informative.
 *
 * Usage:
 *   k6 run -e ORG_ID=<uuid> \
 *          -e AUTH_EMAIL=admin@demo.com \
 *          -e AUTH_PASSWORD=password123 \
 *          scripts/perf/incidents-stress-test.js
 *
 * Or via the runner:
 *   node scripts/perf/run-perf.mjs incidents-stress
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter, Rate, Gauge } from 'k6/metrics';
import { BASE_URL, ORG_ID, authenticate, authHeaders } from './config.js';

// ── Custom Metrics ──────────────────────────────────────────────────────────

const createDuration       = new Trend('stress_incident_create', true);
const listDuration         = new Trend('stress_incident_list', true);
const detailDuration       = new Trend('stress_incident_detail', true);
const statusDuration       = new Trend('stress_incident_status', true);
const severityDuration     = new Trend('stress_incident_severity', true);
const responderDuration    = new Trend('stress_incident_responder', true);
const evidenceDuration     = new Trend('stress_incident_evidence', true);
const notificationDuration = new Trend('stress_incident_notification', true);
const closeDuration        = new Trend('stress_incident_close', true);

const apiErrors       = new Counter('stress_api_errors');
const createErrors    = new Counter('stress_create_errors');
const concurrencyErrors = new Counter('stress_concurrency_errors');
const successRate     = new Rate('stress_success_rate');
const activeIncidents = new Gauge('stress_active_incidents');

// ── Test Options ────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // Scenario 1: Write-heavy stress — concurrent incident creation
    concurrent_creates: {
      executor: 'ramping-vus',
      startVUs: 2,
      stages: [
        { duration: '30s', target: 10 },   // warm-up
        { duration: '30s', target: 25 },   // medium load
        { duration: '30s', target: 50 },   // heavy load
        { duration: '30s', target: 75 },   // very heavy
        { duration: '30s', target: 100 },  // peak stress
        { duration: '30s', target: 0 },    // cool-down
      ],
      gracefulRampDown: '15s',
      exec: 'concurrentCreateStress',
    },
    // Scenario 2: Read-heavy stress — concurrent list/detail queries
    concurrent_reads: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 80 },
        { duration: '30s', target: 120 },
        { duration: '30s', target: 150 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
      exec: 'concurrentReadStress',
    },
    // Scenario 3: Mixed read/write stress — realistic worst-case
    mixed_operations: {
      executor: 'ramping-vus',
      startVUs: 2,
      stages: [
        { duration: '30s', target: 15 },
        { duration: '30s', target: 40 },
        { duration: '30s', target: 60 },
        { duration: '30s', target: 80 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
      exec: 'mixedStress',
    },
  },
  thresholds: {
    // These are informational — we expect them to break at peak load.
    // The purpose is to identify WHEN they break (at what VU count).
    stress_incident_create:   ['p(50)<500', 'p(95)<2000'],
    stress_incident_list:     ['p(50)<300', 'p(95)<1500'],
    stress_incident_detail:   ['p(50)<200', 'p(95)<1000'],
    stress_incident_status:   ['p(50)<300', 'p(95)<1500'],
    stress_incident_severity: ['p(50)<300', 'p(95)<1500'],
    stress_incident_responder: ['p(50)<300', 'p(95)<1500'],
    stress_incident_evidence: ['p(50)<300', 'p(95)<1500'],
    stress_incident_close:    ['p(50)<400', 'p(95)<2000'],

    // Error tracking thresholds
    http_req_failed: ['rate<0.10'],  // Allow up to 10% error rate at peak
    stress_success_rate: ['rate>0.90'],
  },
};

// ── Setup ───────────────────────────────────────────────────────────────────

export function setup() {
  if (!ORG_ID) {
    console.error('ORG_ID required.');
    return { token: null };
  }

  const token = authenticate(http);
  if (!token) {
    console.error('Auth failed.');
    return { token: null };
  }

  // Get user ID
  let userId = null;
  const profileRes = http.get(`${BASE_URL}/api/auth/permissions`, {
    headers: authHeaders(token),
  });
  try {
    userId = JSON.parse(profileRes.body).data?.userId || null;
  } catch {}

  // Seed some incidents for read tests
  const seedIds = [];
  for (let i = 0; i < 20; i++) {
    const types = ['PHISHING', 'MALWARE', 'UNAUTHORIZED_ACCESS', 'DATA_BREACH', 'DEVICE_LOST_STOLEN'];
    const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const payload = JSON.stringify({
      type: types[i % types.length],
      severity: severities[i % severities.length],
      title: `Stress Seed #${i + 1} — ${Date.now()}`,
      description: `Stress test seed incident ${i + 1}`,
    });

    const res = http.post(`${BASE_URL}/api/it/incidents`, payload, {
      headers: authHeaders(token),
    });
    if (res.status === 201) {
      try { seedIds.push(JSON.parse(res.body).data?.id); } catch {}
    }
  }

  console.log(`Stress test setup: seeded ${seedIds.length} incidents.`);
  return { token, userId, seedIds };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function trackResult(res, metric) {
  const ok = res.status >= 200 && res.status < 400;
  if (metric) metric.add(res.timings.duration);
  if (!ok) apiErrors.add(1);
  successRate.add(ok);
  return ok;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Scenario 1: Concurrent Creates ─────────────────────────────────────────
// Tests the incident number counter upsert under contention.

export function concurrentCreateStress(data) {
  if (!data.token) { sleep(1); return; }
  const headers = authHeaders(data.token);

  const types = ['PHISHING', 'MALWARE', 'UNAUTHORIZED_ACCESS', 'DATA_BREACH', 'DEVICE_LOST_STOLEN', 'ACCOUNT_COMPROMISE', 'RANSOMWARE', 'POLICY_VIOLATION', 'OTHER'];
  const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  // Create incident
  group('stress: create incident', () => {
    const payload = JSON.stringify({
      type: randomChoice(types),
      severity: randomChoice(severities),
      title: `Stress Create VU${__VU} Iter${__ITER} — ${Date.now()}`,
      description: `Stress test: concurrent incident creation. VU ${__VU}, iteration ${__ITER}.`,
      piiInvolved: Math.random() > 0.7,
      affectedSystems: ['Test System'],
    });

    const res = http.post(`${BASE_URL}/api/it/incidents`, payload, {
      headers,
      tags: { endpoint: 'stress: POST create' },
    });

    const ok = trackResult(res, createDuration);
    if (!ok) createErrors.add(1);

    check(res, {
      'stress create: 201': (r) => r.status === 201,
      'stress create: response < 2s': (r) => r.timings.duration < 2000,
    });

    // If we successfully created, try to also update its status
    if (ok) {
      try {
        const id = JSON.parse(res.body).data?.id;
        if (id) {
          // Quick status update
          const statusRes = http.put(
            `${BASE_URL}/api/it/incidents/${id}/status`,
            JSON.stringify({ status: 'INVESTIGATING' }),
            { headers, tags: { endpoint: 'stress: PUT status' } }
          );
          trackResult(statusRes, statusDuration);
        }
      } catch {}
    }
  });

  // Minimal think time to maximize contention
  sleep(Math.random() * 0.3);
}

// ── Scenario 2: Concurrent Reads ────────────────────────────────────────────
// Tests query performance under heavy read load.

export function concurrentReadStress(data) {
  if (!data.token || !data.seedIds?.length) { sleep(1); return; }
  const headers = authHeaders(data.token);

  // Mix of list and detail queries
  const opChoice = Math.random();

  if (opChoice < 0.4) {
    // List with no filters
    group('stress: list incidents', () => {
      const res = http.get(`${BASE_URL}/api/it/incidents?limit=25`, {
        headers,
        tags: { endpoint: 'stress: GET list' },
      });
      trackResult(res, listDuration);
      check(res, {
        'stress list: 200': (r) => r.status === 200,
        'stress list: response < 1.5s': (r) => r.timings.duration < 1500,
      });
    });
  } else if (opChoice < 0.7) {
    // List with filters
    group('stress: list filtered', () => {
      const types = ['PHISHING', 'MALWARE', 'DATA_BREACH'];
      const severities = ['HIGH', 'CRITICAL'];
      const res = http.get(
        `${BASE_URL}/api/it/incidents?type=${randomChoice(types)}&severity=${randomChoice(severities)}&limit=25`,
        { headers, tags: { endpoint: 'stress: GET filtered' } }
      );
      trackResult(res, listDuration);
      check(res, {
        'stress filtered: 200': (r) => r.status === 200,
      });
    });
  } else if (opChoice < 0.9) {
    // Detail view
    group('stress: get detail', () => {
      const id = randomChoice(data.seedIds);
      const res = http.get(`${BASE_URL}/api/it/incidents/${id}`, {
        headers,
        tags: { endpoint: 'stress: GET detail' },
      });
      trackResult(res, detailDuration);
      check(res, {
        'stress detail: 200': (r) => r.status === 200 || r.status === 404,
        'stress detail: response < 1s': (r) => r.timings.duration < 1000,
      });
    });
  } else {
    // Search query
    group('stress: search', () => {
      const queries = ['SEC-', 'phishing', 'stress', 'breach', 'malware'];
      const res = http.get(
        `${BASE_URL}/api/it/incidents?search=${randomChoice(queries)}&limit=10`,
        { headers, tags: { endpoint: 'stress: GET search' } }
      );
      trackResult(res, listDuration);
      check(res, {
        'stress search: 200': (r) => r.status === 200,
      });
    });
  }

  // Very short think time to maximize concurrent queries
  sleep(Math.random() * 0.2);
}

// ── Scenario 3: Mixed Operations ────────────────────────────────────────────
// Simulates a busy incident response situation with mixed reads and writes.

export function mixedStress(data) {
  if (!data.token) { sleep(1); return; }
  const headers = authHeaders(data.token);
  const types = ['PHISHING', 'MALWARE', 'UNAUTHORIZED_ACCESS', 'DATA_BREACH'];
  const severities = ['LOW', 'MEDIUM', 'HIGH'];

  // 40% chance of write operation, 60% read
  if (Math.random() < 0.4) {
    // Write path: create + modify
    let incidentId = null;

    group('mixed: create', () => {
      const payload = JSON.stringify({
        type: randomChoice(types),
        severity: randomChoice(severities),
        title: `Mixed Stress VU${__VU} — ${Date.now()}`,
        description: 'Mixed stress test incident.',
      });

      const res = http.post(`${BASE_URL}/api/it/incidents`, payload, {
        headers,
        tags: { endpoint: 'mixed: POST create' },
      });
      const ok = trackResult(res, createDuration);
      if (ok) {
        try { incidentId = JSON.parse(res.body).data?.id; } catch {}
      }
    });

    if (incidentId) {
      sleep(0.1);

      // Randomly pick a write operation
      const writeOp = Math.random();

      if (writeOp < 0.25) {
        group('mixed: update status', () => {
          const res = http.put(
            `${BASE_URL}/api/it/incidents/${incidentId}/status`,
            JSON.stringify({ status: 'INVESTIGATING' }),
            { headers, tags: { endpoint: 'mixed: PUT status' } }
          );
          trackResult(res, statusDuration);
        });
      } else if (writeOp < 0.5) {
        group('mixed: escalate severity', () => {
          const res = http.put(
            `${BASE_URL}/api/it/incidents/${incidentId}/severity`,
            JSON.stringify({ severity: 'CRITICAL', justification: 'Stress test escalation' }),
            { headers, tags: { endpoint: 'mixed: PUT severity' } }
          );
          trackResult(res, severityDuration);
        });
      } else if (writeOp < 0.7 && data.userId) {
        group('mixed: add responder', () => {
          const res = http.post(
            `${BASE_URL}/api/it/incidents/${incidentId}/responders`,
            JSON.stringify({ responderId: data.userId, action: 'add' }),
            { headers, tags: { endpoint: 'mixed: POST responder' } }
          );
          trackResult(res, responderDuration);
        });
      } else if (writeOp < 0.85) {
        group('mixed: attach evidence', () => {
          const res = http.post(
            `${BASE_URL}/api/it/incidents/${incidentId}/evidence`,
            JSON.stringify({
              url: `https://storage.example.com/stress-${Date.now()}.png`,
              fileName: `stress-evidence-${Date.now()}.png`,
              fileHash: `sha256-${Math.random().toString(36).substring(2)}`,
            }),
            { headers, tags: { endpoint: 'mixed: POST evidence' } }
          );
          trackResult(res, evidenceDuration);
        });
      } else {
        group('mixed: log notification', () => {
          const res = http.post(
            `${BASE_URL}/api/it/incidents/${incidentId}/notifications`,
            JSON.stringify({
              recipientType: 'Administration',
              method: 'Email',
              notes: 'Stress test notification',
            }),
            { headers, tags: { endpoint: 'mixed: POST notification' } }
          );
          trackResult(res, notificationDuration);
        });
      }
    }
  } else {
    // Read path
    if (data.seedIds?.length > 0 && Math.random() < 0.5) {
      group('mixed: get detail', () => {
        const id = randomChoice(data.seedIds);
        const res = http.get(`${BASE_URL}/api/it/incidents/${id}`, {
          headers,
          tags: { endpoint: 'mixed: GET detail' },
        });
        trackResult(res, detailDuration);
      });
    } else {
      group('mixed: list incidents', () => {
        const page = Math.floor(Math.random() * 3) + 1;
        const res = http.get(`${BASE_URL}/api/it/incidents?limit=25&page=${page}`, {
          headers,
          tags: { endpoint: 'mixed: GET list' },
        });
        trackResult(res, listDuration);
      });
    }
  }

  sleep(Math.random() * 0.3 + 0.1);
}

// ── Teardown ────────────────────────────────────────────────────────────────

export function teardown(data) {
  console.log('');
  console.log('=== Security Incidents STRESS Test Complete ===');
  console.log('');
  console.log('Interpretation guide:');
  console.log('');
  console.log('  1. CONCURRENT CREATES (scenario: concurrent_creates)');
  console.log('     - Tests the SecurityIncidentCounter upsert under contention.');
  console.log('     - If stress_create_errors is high, the counter may need');
  console.log('       a retry loop or advisory lock.');
  console.log('     - Watch for p95 > 2s — indicates DB connection pool exhaustion.');
  console.log('');
  console.log('  2. CONCURRENT READS (scenario: concurrent_reads)');
  console.log('     - Tests query performance on SecurityIncident table.');
  console.log('     - If stress_incident_list p95 > 1.5s, check indexes on:');
  console.log('       (organizationId, status), (organizationId, severity),');
  console.log('       (organizationId, createdAt).');
  console.log('     - Search queries (text contains) may degrade fastest.');
  console.log('');
  console.log('  3. MIXED OPERATIONS (scenario: mixed_operations)');
  console.log('     - Simulates a real incident response scenario.');
  console.log('     - Write/read contention shows as elevated p95 on reads.');
  console.log('     - Connection pool saturation shows as errors across all ops.');
  console.log('');
  console.log('  Look at the VU-vs-latency relationship to find the inflection');
  console.log('  point. p95 usually degrades linearly until hitting a cliff.');
  console.log('');
}
