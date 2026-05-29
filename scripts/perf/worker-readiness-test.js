/**
 * Read-only performance test for IT and maintenance worker workflows.
 *
 * This intentionally avoids POST/PUT/DELETE so it can be used as a light
 * production baseline without creating test records.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, ORG_ID, authenticate, authHeaders } from './config.js';

const apiErrors = new Counter('worker_api_errors');
const successRate = new Rate('worker_success_rate');

const itDashboard = new Trend('it_dashboard', true);
const itBoard = new Trend('it_board', true);
const itTickets = new Trend('it_tickets', true);
const itDevices = new Trend('it_devices', true);
const itIncidents = new Trend('it_incidents', true);

const maintenanceDashboard = new Trend('maintenance_dashboard', true);
const maintenanceTickets = new Trend('maintenance_tickets', true);
const maintenanceAssets = new Trend('maintenance_assets', true);
const maintenanceSchedules = new Trend('maintenance_pm_schedules', true);
const maintenanceVendors = new Trend('maintenance_vendors', true);
const maintenanceKnowledge = new Trend('maintenance_knowledge_base', true);

export const options = {
  scenarios: {
    worker_readiness: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 5),
      duration: __ENV.DURATION || '45s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    http_req_failed: ['rate<0.02'],
    worker_success_rate: ['rate>0.98'],

    it_dashboard: ['p(95)<1200'],
    it_board: ['p(95)<1200'],
    it_tickets: ['p(95)<1000'],
    it_devices: ['p(95)<1000'],
    it_incidents: ['p(95)<1000'],

    maintenance_dashboard: ['p(95)<1200'],
    maintenance_tickets: ['p(95)<1000'],
    maintenance_assets: ['p(95)<1000'],
    maintenance_pm_schedules: ['p(95)<1000'],
    maintenance_vendors: ['p(95)<800'],
    maintenance_knowledge_base: ['p(95)<1000'],
  },
};

export function setup() {
  if (!ORG_ID) {
    console.error('ORG_ID env var is required.');
    return { token: null };
  }

  return { token: authenticate(http) };
}

function apiGet(token, path, trend, tag) {
  const res = http.get(`${BASE_URL}${path}`, {
    headers: authHeaders(token),
    tags: { endpoint: tag },
  });

  trend.add(res.timings.duration);

  const ok = res.status >= 200 && res.status < 500;
  successRate.add(ok);
  if (!ok) apiErrors.add(1);

  check(res, {
    [`${tag}: no server error`]: (r) => r.status < 500,
  });

  return res;
}

export default function (data) {
  if (!data.token) {
    sleep(1);
    return;
  }

  const token = data.token;

  group('IT worker screens', () => {
    apiGet(token, '/api/it/dashboard', itDashboard, 'GET /api/it/dashboard');
    sleep(0.2);
    apiGet(token, '/api/it/board', itBoard, 'GET /api/it/board');
    sleep(0.2);
    apiGet(token, '/api/it/tickets?limit=20', itTickets, 'GET /api/it/tickets');
    sleep(0.2);
    apiGet(token, '/api/it/devices?limit=20', itDevices, 'GET /api/it/devices');
    sleep(0.2);
    apiGet(token, '/api/it/incidents?limit=20', itIncidents, 'GET /api/it/incidents');
  });

  sleep(0.5);

  group('Maintenance worker screens', () => {
    apiGet(token, '/api/maintenance/dashboard', maintenanceDashboard, 'GET /api/maintenance/dashboard');
    sleep(0.2);
    apiGet(token, '/api/maintenance/tickets?limit=20', maintenanceTickets, 'GET /api/maintenance/tickets');
    sleep(0.2);
    apiGet(token, '/api/maintenance/assets?limit=20', maintenanceAssets, 'GET /api/maintenance/assets');
    sleep(0.2);
    apiGet(token, '/api/maintenance/pm-schedules', maintenanceSchedules, 'GET /api/maintenance/pm-schedules');
    sleep(0.2);
    apiGet(token, '/api/maintenance/vendors', maintenanceVendors, 'GET /api/maintenance/vendors');
    sleep(0.2);
    apiGet(token, '/api/maintenance/knowledge-base?limit=20', maintenanceKnowledge, 'GET /api/maintenance/knowledge-base');
  });

  sleep(1);
}

