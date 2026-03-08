/**
 * Lionheart Platform — Security Incidents API Load Test
 *
 * Comprehensive load test covering all 8 Security Incidents API endpoints.
 * Simulates realistic incident response workflows: create incidents, triage,
 * escalate severity, assign responders, attach evidence, log external
 * notifications, and close with resolution.
 *
 * Endpoints tested:
 *   POST   /api/it/incidents                       — Create incident
 *   GET    /api/it/incidents                        — List incidents (with filters)
 *   GET    /api/it/incidents/[id]                   — Get incident detail
 *   PUT    /api/it/incidents/[id]/status            — Update status
 *   PUT    /api/it/incidents/[id]/severity          — Escalate/change severity
 *   POST   /api/it/incidents/[id]/responders        — Add/remove responders
 *   POST   /api/it/incidents/[id]/evidence          — Attach evidence
 *   POST   /api/it/incidents/[id]/notifications     — Log external notification
 *   POST   /api/it/incidents/[id]/close             — Close incident
 *
 * Usage:
 *   k6 run -e ORG_ID=<uuid> \
 *          -e AUTH_EMAIL=admin@demo.com \
 *          -e AUTH_PASSWORD=password123 \
 *          scripts/perf/incidents-load-test.js
 *
 * Or via the runner:
 *   node scripts/perf/run-perf.mjs incidents-load
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { BASE_URL, ORG_ID, authenticate, authHeaders } from './config.js';

// ── Custom Metrics ──────────────────────────────────────────────────────────

const createIncidentDuration      = new Trend('incident_create_duration', true);
const listIncidentsDuration       = new Trend('incident_list_duration', true);
const listFilteredDuration        = new Trend('incident_list_filtered_duration', true);
const listSearchDuration          = new Trend('incident_list_search_duration', true);
const getIncidentDuration         = new Trend('incident_get_detail_duration', true);
const updateStatusDuration        = new Trend('incident_status_update_duration', true);
const updateSeverityDuration      = new Trend('incident_severity_update_duration', true);
const addResponderDuration        = new Trend('incident_add_responder_duration', true);
const removeResponderDuration     = new Trend('incident_remove_responder_duration', true);
const attachEvidenceDuration      = new Trend('incident_attach_evidence_duration', true);
const logNotificationDuration     = new Trend('incident_log_notification_duration', true);
const closeIncidentDuration       = new Trend('incident_close_duration', true);
const fullWorkflowDuration        = new Trend('incident_full_workflow_duration', true);

const apiErrors   = new Counter('incident_api_errors');
const successRate = new Rate('incident_api_success_rate');

// ── Test Options ────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // Scenario 1: Incident readers — simulate users browsing/searching incidents
    incident_readers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 5 },   // warm-up
        { duration: '30s', target: 15 },  // ramp to target
        { duration: '1m30s', target: 15 }, // steady state
        { duration: '15s', target: 0 },   // cool-down
      ],
      gracefulRampDown: '10s',
      exec: 'readWorkflow',
    },
    // Scenario 2: Incident responders — create, triage, and manage incidents
    incident_responders: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 2 },   // warm-up
        { duration: '30s', target: 8 },   // ramp
        { duration: '1m30s', target: 8 }, // steady state
        { duration: '15s', target: 0 },   // cool-down
      ],
      gracefulRampDown: '10s',
      exec: 'writeWorkflow',
    },
    // Scenario 3: Full lifecycle — create, triage, escalate, close
    incident_lifecycle: {
      executor: 'per-vu-iterations',
      vus: 3,
      iterations: 5,
      maxDuration: '3m',
      exec: 'fullLifecycleWorkflow',
    },
  },
  thresholds: {
    // Global
    http_req_duration:                ['p(95)<1500', 'p(99)<3000'],
    http_req_failed:                  ['rate<0.05'],
    incident_api_success_rate:        ['rate>0.95'],

    // Per-endpoint latency targets (p95)
    incident_create_duration:         ['p(95)<1000'],
    incident_list_duration:           ['p(95)<600'],
    incident_list_filtered_duration:  ['p(95)<600'],
    incident_list_search_duration:    ['p(95)<800'],
    incident_get_detail_duration:     ['p(95)<500'],
    incident_status_update_duration:  ['p(95)<800'],
    incident_severity_update_duration: ['p(95)<800'],
    incident_add_responder_duration:  ['p(95)<800'],
    incident_remove_responder_duration: ['p(95)<800'],
    incident_attach_evidence_duration: ['p(95)<800'],
    incident_log_notification_duration: ['p(95)<800'],
    incident_close_duration:          ['p(95)<1000'],
    incident_full_workflow_duration:  ['p(95)<6000'],
  },
};

// ── Setup ───────────────────────────────────────────────────────────────────

export function setup() {
  if (!ORG_ID) {
    console.error('ORG_ID env var is required.');
    return { token: null, userId: null };
  }

  const token = authenticate(http);
  if (!token) {
    console.error('Authentication failed during setup. Check credentials.');
    return { token: null, userId: null };
  }

  // Fetch current user ID for responder operations
  const profileRes = http.get(`${BASE_URL}/api/auth/permissions`, {
    headers: authHeaders(token),
  });
  let userId = null;
  try {
    const body = JSON.parse(profileRes.body);
    userId = body.data?.userId || null;
  } catch {
    console.warn('Could not fetch user profile for responder tests');
  }

  // Seed a few incidents for read scenarios
  const seedIds = [];
  const types = ['PHISHING', 'MALWARE', 'UNAUTHORIZED_ACCESS', 'DATA_BREACH', 'DEVICE_LOST_STOLEN'];
  const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  for (let i = 0; i < 10; i++) {
    const payload = JSON.stringify({
      type: types[i % types.length],
      severity: severities[i % severities.length],
      title: `Load Test Seed Incident ${i + 1} — ${Date.now()}`,
      description: `Automated load test seed incident #${i + 1}. Created during k6 setup phase for read-scenario testing.`,
      piiInvolved: i % 3 === 0,
      affectedSystems: i % 2 === 0 ? ['Email', 'Active Directory'] : [],
    });

    const res = http.post(`${BASE_URL}/api/it/incidents`, payload, {
      headers: authHeaders(token),
      tags: { endpoint: 'setup_seed' },
    });

    if (res.status === 201) {
      try {
        const body = JSON.parse(res.body);
        if (body.data?.id) seedIds.push(body.data.id);
      } catch {}
    }
  }

  console.log(`Setup complete. Seeded ${seedIds.length} incidents for read scenarios.`);
  return { token, userId, seedIds };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function trackResult(res, metricTrend) {
  const ok = res.status >= 200 && res.status < 400;
  if (metricTrend) metricTrend.add(res.timings.duration);
  if (!ok) apiErrors.add(1);
  successRate.add(ok);
  return ok;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Scenario 1: Read Workflow ───────────────────────────────────────────────

export function readWorkflow(data) {
  if (!data.token) { sleep(1); return; }
  const headers = authHeaders(data.token);

  // 1. List incidents (unfiltered)
  group('incidents: list (unfiltered)', () => {
    const res = http.get(`${BASE_URL}/api/it/incidents?limit=25`, {
      headers,
      tags: { endpoint: 'GET /api/it/incidents' },
    });
    trackResult(res, listIncidentsDuration);
    check(res, {
      'list incidents: 200': (r) => r.status === 200,
      'list incidents: has data': (r) => {
        try { return JSON.parse(r.body).ok === true; } catch { return false; }
      },
    });
  });

  sleep(0.3);

  // 2. List with filters
  group('incidents: list (filtered)', () => {
    const types = ['PHISHING', 'MALWARE', 'UNAUTHORIZED_ACCESS', 'DATA_BREACH'];
    const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const statuses = ['OPEN', 'INVESTIGATING', 'CONTAINED'];

    const filterType = randomChoice(types);
    const filterSeverity = randomChoice(severities);
    const filterStatus = randomChoice(statuses);

    // Randomly pick 1-3 filters
    const filterCount = Math.floor(Math.random() * 3) + 1;
    let qs = '?limit=25';
    if (filterCount >= 1) qs += `&type=${filterType}`;
    if (filterCount >= 2) qs += `&severity=${filterSeverity}`;
    if (filterCount >= 3) qs += `&status=${filterStatus}`;

    const res = http.get(`${BASE_URL}/api/it/incidents${qs}`, {
      headers,
      tags: { endpoint: 'GET /api/it/incidents?filtered' },
    });
    trackResult(res, listFilteredDuration);
    check(res, {
      'filtered list: 200': (r) => r.status === 200,
    });
  });

  sleep(0.3);

  // 3. Search
  group('incidents: search', () => {
    const queries = ['phishing', 'malware', 'SEC-', 'breach', 'load test'];
    const q = randomChoice(queries);
    const res = http.get(`${BASE_URL}/api/it/incidents?search=${encodeURIComponent(q)}&limit=10`, {
      headers,
      tags: { endpoint: 'GET /api/it/incidents?search' },
    });
    trackResult(res, listSearchDuration);
    check(res, {
      'search incidents: 200': (r) => r.status === 200,
    });
  });

  sleep(0.3);

  // 4. Get detail (random seeded incident)
  if (data.seedIds && data.seedIds.length > 0) {
    group('incidents: get detail', () => {
      const id = randomChoice(data.seedIds);
      const res = http.get(`${BASE_URL}/api/it/incidents/${id}`, {
        headers,
        tags: { endpoint: 'GET /api/it/incidents/[id]' },
      });
      trackResult(res, getIncidentDuration);
      check(res, {
        'get detail: 200 or 404': (r) => r.status === 200 || r.status === 404,
      });
    });
  }

  // Think time
  sleep(Math.random() * 1.5 + 0.5);
}

// ── Scenario 2: Write Workflow ──────────────────────────────────────────────

export function writeWorkflow(data) {
  if (!data.token) { sleep(1); return; }
  const headers = authHeaders(data.token);
  const types = ['PHISHING', 'MALWARE', 'UNAUTHORIZED_ACCESS', 'DATA_BREACH', 'DEVICE_LOST_STOLEN', 'ACCOUNT_COMPROMISE', 'RANSOMWARE', 'POLICY_VIOLATION'];
  const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  // 1. Create a new incident
  let incidentId = null;
  group('incidents: create', () => {
    const payload = JSON.stringify({
      type: randomChoice(types),
      severity: randomChoice(severities),
      title: `Perf Test Incident — VU ${__VU} — ${Date.now()}`,
      description: `Automated performance test incident created by k6 VU ${__VU} at iteration ${__ITER}.`,
      piiInvolved: Math.random() > 0.7,
      affectedSystems: Math.random() > 0.5 ? ['Email System', 'Student Portal'] : [],
    });

    const res = http.post(`${BASE_URL}/api/it/incidents`, payload, {
      headers,
      tags: { endpoint: 'POST /api/it/incidents' },
    });
    const ok = trackResult(res, createIncidentDuration);
    check(res, {
      'create incident: 201': (r) => r.status === 201,
      'create incident: has id': (r) => {
        try { return JSON.parse(r.body).data?.id?.length > 0; } catch { return false; }
      },
    });

    if (ok) {
      try {
        incidentId = JSON.parse(res.body).data?.id;
      } catch {}
    }
  });

  if (!incidentId) {
    sleep(1);
    return;
  }

  sleep(0.3);

  // 2. Transition status: OPEN -> INVESTIGATING
  group('incidents: status -> INVESTIGATING', () => {
    const payload = JSON.stringify({
      status: 'INVESTIGATING',
      note: 'Initial triage begun by load test VU',
    });
    const res = http.put(`${BASE_URL}/api/it/incidents/${incidentId}/status`, payload, {
      headers,
      tags: { endpoint: 'PUT /api/it/incidents/[id]/status' },
    });
    trackResult(res, updateStatusDuration);
    check(res, {
      'status INVESTIGATING: 200': (r) => r.status === 200,
    });
  });

  sleep(0.2);

  // 3. Escalate severity
  group('incidents: escalate severity', () => {
    const payload = JSON.stringify({
      severity: 'HIGH',
      justification: 'Escalated during load test triage',
    });
    const res = http.put(`${BASE_URL}/api/it/incidents/${incidentId}/severity`, payload, {
      headers,
      tags: { endpoint: 'PUT /api/it/incidents/[id]/severity' },
    });
    trackResult(res, updateSeverityDuration);
    check(res, {
      'escalate severity: 200 or 400': (r) => r.status === 200 || r.status === 400,
    });
  });

  sleep(0.2);

  // 4. Add responder (use userId from setup if available)
  if (data.userId) {
    group('incidents: add responder', () => {
      const payload = JSON.stringify({
        responderId: data.userId,
        action: 'add',
      });
      const res = http.post(`${BASE_URL}/api/it/incidents/${incidentId}/responders`, payload, {
        headers,
        tags: { endpoint: 'POST /api/it/incidents/[id]/responders' },
      });
      trackResult(res, addResponderDuration);
      check(res, {
        'add responder: 200': (r) => r.status === 200,
      });
    });

    sleep(0.2);

    // 4b. Remove responder
    group('incidents: remove responder', () => {
      const payload = JSON.stringify({
        responderId: data.userId,
        action: 'remove',
      });
      const res = http.post(`${BASE_URL}/api/it/incidents/${incidentId}/responders`, payload, {
        headers,
        tags: { endpoint: 'POST /api/it/incidents/[id]/responders (remove)' },
      });
      trackResult(res, removeResponderDuration);
      check(res, {
        'remove responder: 200': (r) => r.status === 200,
      });
    });
  }

  sleep(0.2);

  // 5. Attach evidence
  group('incidents: attach evidence', () => {
    const payload = JSON.stringify({
      url: `https://storage.example.com/evidence/perf-test-${Date.now()}.png`,
      fileName: `screenshot-${Date.now()}.png`,
      fileHash: `sha256-${Math.random().toString(36).substring(2, 15)}`,
    });
    const res = http.post(`${BASE_URL}/api/it/incidents/${incidentId}/evidence`, payload, {
      headers,
      tags: { endpoint: 'POST /api/it/incidents/[id]/evidence' },
    });
    trackResult(res, attachEvidenceDuration);
    check(res, {
      'attach evidence: 200': (r) => r.status === 200,
    });
  });

  sleep(0.2);

  // 6. Log external notification
  group('incidents: log notification', () => {
    const payload = JSON.stringify({
      recipientType: 'School Board',
      method: 'Email',
      notes: 'Notified board chair per incident response policy',
    });
    const res = http.post(`${BASE_URL}/api/it/incidents/${incidentId}/notifications`, payload, {
      headers,
      tags: { endpoint: 'POST /api/it/incidents/[id]/notifications' },
    });
    trackResult(res, logNotificationDuration);
    check(res, {
      'log notification: 200': (r) => r.status === 200,
    });
  });

  // Think time between workflow batches
  sleep(Math.random() * 1.5 + 0.5);
}

// ── Scenario 3: Full Lifecycle Workflow ─────────────────────────────────────

export function fullLifecycleWorkflow(data) {
  if (!data.token) { sleep(1); return; }
  const headers = authHeaders(data.token);
  const workflowStart = Date.now();

  const types = ['PHISHING', 'MALWARE', 'UNAUTHORIZED_ACCESS', 'DATA_BREACH'];
  const severities = ['LOW', 'MEDIUM'];

  // 1. Create
  let incidentId = null;
  group('lifecycle: create', () => {
    const payload = JSON.stringify({
      type: randomChoice(types),
      severity: randomChoice(severities),
      title: `Lifecycle Test — VU ${__VU} Iter ${__ITER} — ${Date.now()}`,
      description: 'Full lifecycle performance test: create -> investigate -> contain -> remediate -> close.',
      piiInvolved: true,
      affectedSystems: ['Student Information System', 'Email'],
      affectedDeviceIds: [],
      affectedUserIds: [],
    });

    const res = http.post(`${BASE_URL}/api/it/incidents`, payload, {
      headers,
      tags: { endpoint: 'lifecycle: POST create' },
    });
    trackResult(res, createIncidentDuration);
    check(res, { 'lifecycle create: 201': (r) => r.status === 201 });

    try {
      incidentId = JSON.parse(res.body).data?.id;
    } catch {}
  });

  if (!incidentId) { sleep(1); return; }
  sleep(0.2);

  // 2. Get detail
  group('lifecycle: get detail', () => {
    const res = http.get(`${BASE_URL}/api/it/incidents/${incidentId}`, {
      headers,
      tags: { endpoint: 'lifecycle: GET detail' },
    });
    trackResult(res, getIncidentDuration);
    check(res, { 'lifecycle detail: 200': (r) => r.status === 200 });
  });

  sleep(0.2);

  // 3. Status: OPEN -> INVESTIGATING
  group('lifecycle: status INVESTIGATING', () => {
    const res = http.put(
      `${BASE_URL}/api/it/incidents/${incidentId}/status`,
      JSON.stringify({ status: 'INVESTIGATING', note: 'Triage started' }),
      { headers, tags: { endpoint: 'lifecycle: PUT status INVESTIGATING' } }
    );
    trackResult(res, updateStatusDuration);
    check(res, { 'lifecycle investigating: 200': (r) => r.status === 200 });
  });

  sleep(0.2);

  // 4. Escalate severity: LOW/MEDIUM -> HIGH
  group('lifecycle: escalate to HIGH', () => {
    const res = http.put(
      `${BASE_URL}/api/it/incidents/${incidentId}/severity`,
      JSON.stringify({ severity: 'HIGH', justification: 'PII confirmed involved' }),
      { headers, tags: { endpoint: 'lifecycle: PUT severity HIGH' } }
    );
    trackResult(res, updateSeverityDuration);
    check(res, { 'lifecycle escalate: 200': (r) => r.status === 200 });
  });

  sleep(0.2);

  // 5. Add responder
  if (data.userId) {
    group('lifecycle: add responder', () => {
      const res = http.post(
        `${BASE_URL}/api/it/incidents/${incidentId}/responders`,
        JSON.stringify({ responderId: data.userId, action: 'add' }),
        { headers, tags: { endpoint: 'lifecycle: POST responder add' } }
      );
      trackResult(res, addResponderDuration);
      check(res, { 'lifecycle add responder: 200': (r) => r.status === 200 });
    });
  }

  sleep(0.2);

  // 6. Attach evidence (x2 for realism)
  for (let i = 0; i < 2; i++) {
    group(`lifecycle: attach evidence #${i + 1}`, () => {
      const res = http.post(
        `${BASE_URL}/api/it/incidents/${incidentId}/evidence`,
        JSON.stringify({
          url: `https://storage.example.com/evidence/lifecycle-${incidentId}-${i}.png`,
          fileName: `evidence-${i + 1}.png`,
          fileHash: `sha256-lifecycle-${Math.random().toString(36).substring(2)}`,
        }),
        { headers, tags: { endpoint: 'lifecycle: POST evidence' } }
      );
      trackResult(res, attachEvidenceDuration);
      check(res, { [`lifecycle evidence #${i + 1}: 200`]: (r) => r.status === 200 });
    });
    sleep(0.1);
  }

  // 7. Log external notification
  group('lifecycle: log notification', () => {
    const res = http.post(
      `${BASE_URL}/api/it/incidents/${incidentId}/notifications`,
      JSON.stringify({
        recipientType: 'Insurance Provider',
        method: 'Phone Call',
        notes: 'Notified cyber insurance carrier',
      }),
      { headers, tags: { endpoint: 'lifecycle: POST notification' } }
    );
    trackResult(res, logNotificationDuration);
    check(res, { 'lifecycle notification: 200': (r) => r.status === 200 });
  });

  sleep(0.2);

  // 8. Status: INVESTIGATING -> CONTAINED
  group('lifecycle: status CONTAINED', () => {
    const res = http.put(
      `${BASE_URL}/api/it/incidents/${incidentId}/status`,
      JSON.stringify({ status: 'CONTAINED', note: 'Threat contained' }),
      { headers, tags: { endpoint: 'lifecycle: PUT status CONTAINED' } }
    );
    trackResult(res, updateStatusDuration);
    check(res, { 'lifecycle contained: 200': (r) => r.status === 200 });
  });

  sleep(0.2);

  // 9. Status: CONTAINED -> REMEDIATING
  group('lifecycle: status REMEDIATING', () => {
    const res = http.put(
      `${BASE_URL}/api/it/incidents/${incidentId}/status`,
      JSON.stringify({ status: 'REMEDIATING', note: 'Remediation in progress' }),
      { headers, tags: { endpoint: 'lifecycle: PUT status REMEDIATING' } }
    );
    trackResult(res, updateStatusDuration);
    check(res, { 'lifecycle remediating: 200': (r) => r.status === 200 });
  });

  sleep(0.2);

  // 10. Close incident
  group('lifecycle: close', () => {
    const res = http.post(
      `${BASE_URL}/api/it/incidents/${incidentId}/close`,
      JSON.stringify({
        resolutionSummary: 'Phishing email quarantined, affected credentials rotated, monitoring enhanced.',
        lessonsLearned: 'Need additional email filtering rules and staff phishing awareness training.',
      }),
      { headers, tags: { endpoint: 'lifecycle: POST close' } }
    );
    trackResult(res, closeIncidentDuration);
    check(res, { 'lifecycle close: 200': (r) => r.status === 200 });
  });

  // Track full workflow duration
  fullWorkflowDuration.add(Date.now() - workflowStart);

  // 11. Verify final state
  group('lifecycle: verify closed', () => {
    const res = http.get(`${BASE_URL}/api/it/incidents/${incidentId}`, {
      headers,
      tags: { endpoint: 'lifecycle: GET verify closed' },
    });
    check(res, {
      'lifecycle closed verified: 200': (r) => r.status === 200,
      'lifecycle status is CLOSED': (r) => {
        try { return JSON.parse(r.body).data?.status === 'CLOSED'; } catch { return false; }
      },
      'lifecycle has resolution': (r) => {
        try { return JSON.parse(r.body).data?.resolutionSummary?.length > 0; } catch { return false; }
      },
    });
  });

  sleep(1);
}

// ── Teardown ────────────────────────────────────────────────────────────────

export function teardown(data) {
  if (!data.token) {
    console.warn('No auth token was available — all requests may have been skipped.');
    return;
  }

  console.log('');
  console.log('=== Security Incidents Load Test Complete ===');
  console.log('');
  console.log('Key metrics to review:');
  console.log('  incident_create_duration     — POST /api/it/incidents');
  console.log('  incident_list_duration       — GET  /api/it/incidents');
  console.log('  incident_list_filtered_duration — GET with type/severity/status filters');
  console.log('  incident_list_search_duration — GET with text search');
  console.log('  incident_get_detail_duration — GET  /api/it/incidents/[id]');
  console.log('  incident_status_update_duration — PUT status transitions');
  console.log('  incident_severity_update_duration — PUT severity changes');
  console.log('  incident_add_responder_duration — POST add responder');
  console.log('  incident_attach_evidence_duration — POST evidence attachment');
  console.log('  incident_log_notification_duration — POST external notification');
  console.log('  incident_close_duration     — POST close incident');
  console.log('  incident_full_workflow_duration — End-to-end lifecycle time');
  console.log('');
  console.log('Bottleneck indicators:');
  console.log('  - p95 > 1000ms on any endpoint = investigate DB queries');
  console.log('  - incident_create_duration high = check incidentNumber counter upsert');
  console.log('  - incident_list_search_duration high = add full-text index');
  console.log('  - incident_full_workflow_duration > 6s = cumulative latency issue');
  console.log('');
}
