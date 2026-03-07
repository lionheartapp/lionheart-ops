/**
 * Lionheart Platform — k6 Comprehensive Performance Test
 *
 * Tests ALL major API endpoints and page loads across every module:
 *   - Auth (login, profile)
 *   - Settings (users, roles, permissions, campus, schools, school-info, principals, audit-logs, approval-config)
 *   - Tickets / Maintenance (tickets, assets, analytics, knowledge-base, compliance, PM schedules, vendors, dashboard, board-report)
 *   - Events & Draft Events
 *   - Calendar (calendars, calendar-events, calendar-categories, people-search)
 *   - Athletics (dashboard, teams, sports, seasons, games, practices, roster, standings, tournaments)
 *   - Inventory
 *   - Notifications (list, unread-count)
 *   - Search
 *   - Academic (years, terms, bell-schedules, day-schedules, special-days)
 *   - Planning (planning-seasons)
 *   - Modules
 *   - Public endpoints (branding, slug-check)
 *
 * Usage:
 *   k6 run -e ORG_ID=<uuid> \
 *          -e AUTH_EMAIL=admin@demo.com \
 *          -e AUTH_PASSWORD=perftest123 \
 *          scripts/perf/comprehensive-test.js
 *
 * Or use the runner:
 *   ORG_ID=xxx AUTH_EMAIL=xxx AUTH_PASSWORD=xxx node scripts/perf/run-perf.mjs comprehensive
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { BASE_URL, ORG_ID, authenticate, authHeaders } from './config.js';

// ─── Custom Metrics ────────────────────────────────────────────────────────────

// Auth
const loginDuration        = new Trend('auth_login', true);
const profileDuration      = new Trend('auth_profile', true);

// Settings
const usersDuration        = new Trend('settings_users', true);
const rolesDuration        = new Trend('settings_roles', true);
const permissionsDuration  = new Trend('settings_permissions', true);
const campusDuration       = new Trend('settings_campus', true);
const buildingsDuration    = new Trend('settings_buildings', true);
const roomsDuration        = new Trend('settings_rooms', true);
const areasDuration        = new Trend('settings_areas', true);
const schoolsDuration      = new Trend('settings_schools', true);
const schoolInfoDuration   = new Trend('settings_school_info', true);
const principalsDuration   = new Trend('settings_principals', true);
const auditLogsDuration    = new Trend('settings_audit_logs', true);
const approvalCfgDuration  = new Trend('settings_approval_config', true);
const campusesDuration     = new Trend('settings_campuses', true);

// Maintenance / Tickets
const ticketsDuration      = new Trend('maintenance_tickets', true);
const mainTicketsDuration  = new Trend('maintenance_tickets_v2', true);
const assetsDuration       = new Trend('maintenance_assets', true);
const analyticsDuration    = new Trend('maintenance_analytics', true);
const kbDuration           = new Trend('maintenance_knowledge_base', true);
const complianceDuration   = new Trend('maintenance_compliance_domains', true);
const compRecordsDuration  = new Trend('maintenance_compliance_records', true);
const pmSchedulesDuration  = new Trend('maintenance_pm_schedules', true);
const vendorsDuration      = new Trend('maintenance_vendors', true);
const mainDashDuration     = new Trend('maintenance_dashboard', true);
const boardReportDuration  = new Trend('maintenance_board_report', true);

// Events
const eventsDuration       = new Trend('events', true);
const draftEventsDuration  = new Trend('draft_events', true);

// Calendar
const calendarsDuration    = new Trend('calendars', true);
const calEventsDuration    = new Trend('calendar_events', true);
const calCategoriesDuration = new Trend('calendar_categories', true);

// Athletics
const athDashDuration      = new Trend('athletics_dashboard', true);
const athTeamsDuration     = new Trend('athletics_teams', true);
const athSportsDuration    = new Trend('athletics_sports', true);
const athSeasonsDuration   = new Trend('athletics_seasons', true);
const athGamesDuration     = new Trend('athletics_games', true);
const athPracticesDuration = new Trend('athletics_practices', true);
const athRosterDuration    = new Trend('athletics_roster', true);
const athStandingsDuration = new Trend('athletics_standings', true);
const athTournamentsDuration = new Trend('athletics_tournaments', true);

// Other
const inventoryDuration    = new Trend('inventory', true);
const notifListDuration    = new Trend('notifications_list', true);
const notifCountDuration   = new Trend('notifications_count', true);
const searchDuration       = new Trend('search', true);
const modulesDuration      = new Trend('modules', true);

// Academic
const acadYearsDuration    = new Trend('academic_years', true);
const acadTermsDuration    = new Trend('academic_terms', true);
const acadBellDuration     = new Trend('academic_bell_schedules', true);
const acadDayDuration      = new Trend('academic_day_schedules', true);
const acadSpecialDuration  = new Trend('academic_special_days', true);

// Planning
const planningDuration     = new Trend('planning_seasons', true);

// Public
const brandingDuration     = new Trend('public_branding', true);
const slugCheckDuration    = new Trend('public_slug_check', true);

// Aggregate
const apiErrors            = new Counter('api_errors');
const successRate          = new Rate('api_success_rate');
const endpointCount        = new Counter('endpoints_tested');

// ─── Test Options ──────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    comprehensive: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 5  },  // warm-up
        { duration: '30s', target: 10 },  // ramp to moderate
        { duration: '2m',  target: 10 },  // steady state — exercise all endpoints
        { duration: '15s', target: 0  },  // cool-down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // Global
    http_req_duration:              ['p(95)<2000', 'p(99)<4000'],
    http_req_failed:                ['rate<0.05'],
    api_success_rate:               ['rate>0.95'],

    // Auth
    auth_login:                     ['p(95)<1000'],
    auth_profile:                   ['p(95)<500'],

    // Settings
    settings_users:                 ['p(95)<800'],
    settings_roles:                 ['p(95)<500'],
    settings_permissions:           ['p(95)<500'],
    settings_campus:                ['p(95)<800'],
    settings_buildings:             ['p(95)<600'],
    settings_rooms:                 ['p(95)<600'],
    settings_areas:                 ['p(95)<600'],
    settings_schools:               ['p(95)<600'],
    settings_school_info:           ['p(95)<600'],
    settings_principals:            ['p(95)<600'],
    settings_audit_logs:            ['p(95)<800'],
    settings_approval_config:       ['p(95)<500'],
    settings_campuses:              ['p(95)<600'],

    // Maintenance
    maintenance_tickets:            ['p(95)<800'],
    maintenance_tickets_v2:         ['p(95)<800'],
    maintenance_assets:             ['p(95)<800'],
    maintenance_analytics:          ['p(95)<1500'],
    maintenance_knowledge_base:     ['p(95)<800'],
    maintenance_compliance_domains: ['p(95)<800'],
    maintenance_compliance_records: ['p(95)<800'],
    maintenance_pm_schedules:       ['p(95)<800'],
    maintenance_vendors:            ['p(95)<600'],
    maintenance_dashboard:          ['p(95)<1000'],
    maintenance_board_report:       ['p(95)<1500'],

    // Events
    events:                         ['p(95)<800'],
    draft_events:                   ['p(95)<800'],

    // Calendar
    calendars:                      ['p(95)<600'],
    calendar_events:                ['p(95)<1000'],
    calendar_categories:            ['p(95)<500'],

    // Athletics
    athletics_dashboard:            ['p(95)<1500'],
    athletics_teams:                ['p(95)<800'],
    athletics_sports:               ['p(95)<600'],
    athletics_seasons:              ['p(95)<600'],
    athletics_games:                ['p(95)<800'],
    athletics_practices:            ['p(95)<800'],
    athletics_roster:               ['p(95)<800'],
    athletics_standings:            ['p(95)<800'],
    athletics_tournaments:          ['p(95)<800'],

    // Other
    inventory:                      ['p(95)<800'],
    notifications_list:             ['p(95)<500'],
    notifications_count:            ['p(95)<300'],
    search:                         ['p(95)<600'],
    modules:                        ['p(95)<500'],

    // Academic
    academic_years:                 ['p(95)<600'],
    academic_terms:                 ['p(95)<600'],
    academic_bell_schedules:        ['p(95)<600'],
    academic_day_schedules:         ['p(95)<600'],
    academic_special_days:          ['p(95)<600'],

    // Planning
    planning_seasons:               ['p(95)<800'],

    // Public
    public_branding:                ['p(95)<500'],
    public_slug_check:              ['p(95)<500'],
  },
};

// ─── Setup ─────────────────────────────────────────────────────────────────────

export function setup() {
  if (!ORG_ID) {
    console.error('ORG_ID env var is required. Pass it via: k6 run -e ORG_ID=<uuid> ...');
    return { token: null };
  }

  const token = authenticate(http);
  if (!token) {
    console.error('Authentication failed during setup. Check credentials.');
  }

  console.log(`\n=== Comprehensive Performance Test ===`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Org:    ${ORG_ID}`);
  console.log(`Testing 55+ endpoints across all modules\n`);

  return { token };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function trackResult(res, metricTrend) {
  const ok = res.status >= 200 && res.status < 400;
  if (metricTrend) metricTrend.add(res.timings.duration);
  if (!ok) apiErrors.add(1);
  successRate.add(ok);
  endpointCount.add(1);
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

function apiGetPublic(path, extraHeaders, metricTrend, tag) {
  const res = http.get(`${BASE_URL}${path}`, {
    headers: extraHeaders || {},
    tags: { endpoint: tag || path },
  });
  trackResult(res, metricTrend);
  return res;
}

// ─── Endpoint Test Groups ──────────────────────────────────────────────────────

function testAuth(token) {
  group('01 — Auth: Login', () => {
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
    check(res, { 'login: 200': (r) => r.status === 200 });
    trackResult(res, null);
  });

  group('01 — Auth: Profile', () => {
    const res = apiGet(token, '/api/auth/profile', profileDuration, 'GET /api/auth/profile');
    check(res, { 'profile: status ok': (r) => r.status < 500 });
  });
}

function testPublic() {
  group('02 — Public: Branding', () => {
    const res = apiGetPublic('/api/branding', { 'x-org-subdomain': 'demo' }, brandingDuration, 'GET /api/branding');
    check(res, { 'branding: ok': (r) => r.status === 200 || r.status === 400 });
  });

  group('02 — Public: Slug Check', () => {
    const res = apiGetPublic('/api/organizations/slug-check?slug=demo', {}, slugCheckDuration, 'GET /api/organizations/slug-check');
    check(res, { 'slug-check: ok': (r) => r.status < 500 });
  });
}

function testNotifications(token) {
  group('03 — Notifications: Unread Count', () => {
    const res = apiGet(token, '/api/notifications/unread-count', notifCountDuration, 'GET /api/notifications/unread-count');
    check(res, { 'notif count: 200': (r) => r.status === 200 });
  });

  group('03 — Notifications: List', () => {
    const res = apiGet(token, '/api/notifications?limit=10', notifListDuration, 'GET /api/notifications');
    check(res, { 'notif list: 200': (r) => r.status === 200 });
  });
}

function testSearch(token) {
  group('04 — Search', () => {
    const queries = ['admin', 'room', 'test', 'event', 'math', 'building', 'ticket'];
    const q = queries[Math.floor(Math.random() * queries.length)];
    const res = apiGet(token, `/api/search?q=${q}&limit=5`, searchDuration, 'GET /api/search');
    check(res, {
      'search: 200': (r) => r.status === 200,
      'search: has data': (r) => {
        try { return JSON.parse(r.body).ok; } catch { return false; }
      },
    });
  });
}

function testSettingsUsers(token) {
  group('05 — Settings: Users', () => {
    const res = apiGet(token, '/api/settings/users', usersDuration, 'GET /api/settings/users');
    check(res, { 'users: not error': (r) => r.status < 500 });
  });
}

function testSettingsRoles(token) {
  group('05 — Settings: Roles', () => {
    const res = apiGet(token, '/api/settings/roles', rolesDuration, 'GET /api/settings/roles');
    check(res, { 'roles: not error': (r) => r.status < 500 });
  });
}

function testSettingsPermissions(token) {
  group('05 — Settings: Permissions', () => {
    const res = apiGet(token, '/api/settings/permissions', permissionsDuration, 'GET /api/settings/permissions');
    check(res, { 'permissions: not error': (r) => r.status < 500 });
  });
}

function testSettingsCampus(token) {
  group('05 — Settings: Campus', () => {
    const res = apiGet(token, '/api/settings/campus', campusDuration, 'GET /api/settings/campus');
    check(res, { 'campus: not error': (r) => r.status < 500 });
  });

  group('05 — Settings: Buildings', () => {
    const res = apiGet(token, '/api/settings/campus/buildings', buildingsDuration, 'GET /api/settings/campus/buildings');
    check(res, { 'buildings: not error': (r) => r.status < 500 });
  });

  group('05 — Settings: Rooms', () => {
    const res = apiGet(token, '/api/settings/campus/rooms', roomsDuration, 'GET /api/settings/campus/rooms');
    check(res, { 'rooms: not error': (r) => r.status < 500 });
  });

  group('05 — Settings: Areas', () => {
    const res = apiGet(token, '/api/settings/campus/areas', areasDuration, 'GET /api/settings/campus/areas');
    check(res, { 'areas: not error': (r) => r.status < 500 });
  });

  group('05 — Settings: Campuses', () => {
    const res = apiGet(token, '/api/settings/campus/campuses', campusesDuration, 'GET /api/settings/campus/campuses');
    check(res, { 'campuses: not error': (r) => r.status < 500 });
  });
}

function testSettingsSchools(token) {
  group('05 — Settings: Schools', () => {
    const res = apiGet(token, '/api/settings/schools', schoolsDuration, 'GET /api/settings/schools');
    check(res, { 'schools: not error': (r) => r.status < 500 });
  });

  group('05 — Settings: School Info', () => {
    const res = apiGet(token, '/api/settings/school-info', schoolInfoDuration, 'GET /api/settings/school-info');
    check(res, { 'school-info: not error': (r) => r.status < 500 });
  });

  group('05 — Settings: Principals', () => {
    const res = apiGet(token, '/api/settings/principals', principalsDuration, 'GET /api/settings/principals');
    check(res, { 'principals: not error': (r) => r.status < 500 });
  });
}

function testSettingsAudit(token) {
  group('05 — Settings: Audit Logs', () => {
    const res = apiGet(token, '/api/settings/audit-logs?limit=20', auditLogsDuration, 'GET /api/settings/audit-logs');
    check(res, { 'audit-logs: not error': (r) => r.status < 500 });
  });

  group('05 — Settings: Approval Config', () => {
    const res = apiGet(token, '/api/settings/approval-config', approvalCfgDuration, 'GET /api/settings/approval-config');
    check(res, { 'approval-config: not error': (r) => r.status < 500 });
  });
}

function testTickets(token) {
  group('06 — Tickets (legacy)', () => {
    const res = apiGet(token, '/api/tickets?limit=20&offset=0', ticketsDuration, 'GET /api/tickets');
    check(res, { 'tickets: not error': (r) => r.status < 500 });
  });
}

function testMaintenance(token) {
  group('07 — Maintenance: Tickets', () => {
    const res = apiGet(token, '/api/maintenance/tickets?limit=20', mainTicketsDuration, 'GET /api/maintenance/tickets');
    check(res, { 'maint tickets: not error': (r) => r.status < 500 });
  });

  group('07 — Maintenance: Assets', () => {
    const res = apiGet(token, '/api/maintenance/assets', assetsDuration, 'GET /api/maintenance/assets');
    check(res, { 'assets: not error': (r) => r.status < 500 });
  });

  group('07 — Maintenance: Analytics', () => {
    const res = apiGet(token, '/api/maintenance/analytics', analyticsDuration, 'GET /api/maintenance/analytics');
    check(res, { 'analytics: not error': (r) => r.status < 500 });
  });

  group('07 — Maintenance: Knowledge Base', () => {
    const res = apiGet(token, '/api/maintenance/knowledge-base', kbDuration, 'GET /api/maintenance/knowledge-base');
    check(res, { 'kb: not error': (r) => r.status < 500 });
  });

  group('07 — Maintenance: Compliance Domains', () => {
    const res = apiGet(token, '/api/maintenance/compliance/domains', complianceDuration, 'GET /api/maintenance/compliance/domains');
    check(res, { 'compliance domains: not error': (r) => r.status < 500 });
  });

  group('07 — Maintenance: Compliance Records', () => {
    const res = apiGet(token, '/api/maintenance/compliance/records', compRecordsDuration, 'GET /api/maintenance/compliance/records');
    check(res, { 'compliance records: not error': (r) => r.status < 500 });
  });

  group('07 — Maintenance: PM Schedules', () => {
    const res = apiGet(token, '/api/maintenance/pm-schedules', pmSchedulesDuration, 'GET /api/maintenance/pm-schedules');
    check(res, { 'pm-schedules: not error': (r) => r.status < 500 });
  });

  group('07 — Maintenance: Vendors', () => {
    const res = apiGet(token, '/api/maintenance/vendors', vendorsDuration, 'GET /api/maintenance/vendors');
    check(res, { 'vendors: not error': (r) => r.status < 500 });
  });

  group('07 — Maintenance: Dashboard', () => {
    const res = apiGet(token, '/api/maintenance/dashboard', mainDashDuration, 'GET /api/maintenance/dashboard');
    check(res, { 'maint dashboard: not error': (r) => r.status < 500 });
  });

  group('07 — Maintenance: Board Report', () => {
    const res = apiGet(token, '/api/maintenance/board-report', boardReportDuration, 'GET /api/maintenance/board-report');
    check(res, { 'board-report: not error': (r) => r.status < 500 });
  });
}

function testEvents(token) {
  group('08 — Events', () => {
    const res = apiGet(token, '/api/events', eventsDuration, 'GET /api/events');
    check(res, { 'events: not error': (r) => r.status < 500 });
  });

  group('08 — Draft Events', () => {
    const res = apiGet(token, '/api/draft-events', draftEventsDuration, 'GET /api/draft-events');
    check(res, { 'draft-events: not error': (r) => r.status < 500 });
  });
}

function testCalendar(token) {
  group('09 — Calendars: List', () => {
    const res = apiGet(token, '/api/calendars', calendarsDuration, 'GET /api/calendars');
    check(res, { 'calendars: not error': (r) => r.status < 500 });
  });

  group('09 — Calendar Events: Month', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const res = apiGet(
      token,
      `/api/calendar-events?start=${start}&end=${end}`,
      calEventsDuration,
      'GET /api/calendar-events'
    );
    check(res, { 'cal-events: not error': (r) => r.status < 500 });
  });

  group('09 — Calendar Categories', () => {
    const res = apiGet(token, '/api/calendar-categories', calCategoriesDuration, 'GET /api/calendar-categories');
    check(res, { 'cal-categories: not error': (r) => r.status < 500 });
  });
}

function testAthletics(token) {
  group('10 — Athletics: Dashboard', () => {
    const res = apiGet(token, '/api/athletics/dashboard', athDashDuration, 'GET /api/athletics/dashboard');
    check(res, { 'ath dashboard: not error': (r) => r.status < 500 });
  });

  group('10 — Athletics: Teams', () => {
    const res = apiGet(token, '/api/athletics/teams', athTeamsDuration, 'GET /api/athletics/teams');
    check(res, { 'ath teams: not error': (r) => r.status < 500 });
  });

  group('10 — Athletics: Sports', () => {
    const res = apiGet(token, '/api/athletics/sports', athSportsDuration, 'GET /api/athletics/sports');
    check(res, { 'ath sports: not error': (r) => r.status < 500 });
  });

  group('10 — Athletics: Seasons', () => {
    const res = apiGet(token, '/api/athletics/seasons', athSeasonsDuration, 'GET /api/athletics/seasons');
    check(res, { 'ath seasons: not error': (r) => r.status < 500 });
  });

  group('10 — Athletics: Games', () => {
    const res = apiGet(token, '/api/athletics/games', athGamesDuration, 'GET /api/athletics/games');
    check(res, { 'ath games: not error': (r) => r.status < 500 });
  });

  group('10 — Athletics: Practices', () => {
    const res = apiGet(token, '/api/athletics/practices', athPracticesDuration, 'GET /api/athletics/practices');
    check(res, { 'ath practices: not error': (r) => r.status < 500 });
  });

  group('10 — Athletics: Roster', () => {
    const res = apiGet(token, '/api/athletics/roster', athRosterDuration, 'GET /api/athletics/roster');
    check(res, { 'ath roster: not error': (r) => r.status < 500 });
  });

  group('10 — Athletics: Standings', () => {
    const res = apiGet(token, '/api/athletics/standings', athStandingsDuration, 'GET /api/athletics/standings');
    check(res, { 'ath standings: not error': (r) => r.status < 500 });
  });

  group('10 — Athletics: Tournaments', () => {
    const res = apiGet(token, '/api/athletics/tournaments', athTournamentsDuration, 'GET /api/athletics/tournaments');
    check(res, { 'ath tournaments: not error': (r) => r.status < 500 });
  });
}

function testInventory(token) {
  group('11 — Inventory', () => {
    const res = apiGet(token, '/api/inventory', inventoryDuration, 'GET /api/inventory');
    check(res, { 'inventory: not error': (r) => r.status < 500 });
  });
}

function testModules(token) {
  group('12 — Modules', () => {
    const res = apiGet(token, '/api/modules', modulesDuration, 'GET /api/modules');
    check(res, { 'modules: not error': (r) => r.status < 500 });
  });
}

function testAcademic(token) {
  group('13 — Academic: Years', () => {
    const res = apiGet(token, '/api/academic/years', acadYearsDuration, 'GET /api/academic/years');
    check(res, { 'academic years: not error': (r) => r.status < 500 });
  });

  group('13 — Academic: Terms', () => {
    const res = apiGet(token, '/api/academic/terms', acadTermsDuration, 'GET /api/academic/terms');
    check(res, { 'academic terms: not error': (r) => r.status < 500 });
  });

  group('13 — Academic: Bell Schedules', () => {
    const res = apiGet(token, '/api/academic/bell-schedules', acadBellDuration, 'GET /api/academic/bell-schedules');
    check(res, { 'bell schedules: not error': (r) => r.status < 500 });
  });

  group('13 — Academic: Day Schedules', () => {
    const res = apiGet(token, '/api/academic/day-schedules', acadDayDuration, 'GET /api/academic/day-schedules');
    check(res, { 'day schedules: not error': (r) => r.status < 500 });
  });

  group('13 — Academic: Special Days', () => {
    const res = apiGet(token, '/api/academic/special-days', acadSpecialDuration, 'GET /api/academic/special-days');
    check(res, { 'special days: not error': (r) => r.status < 500 });
  });
}

function testPlanning(token) {
  group('14 — Planning: Seasons', () => {
    const res = apiGet(token, '/api/planning-seasons', planningDuration, 'GET /api/planning-seasons');
    check(res, { 'planning: not error': (r) => r.status < 500 });
  });
}

// ─── Main VU Function ──────────────────────────────────────────────────────────

export default function (data) {
  if (!data.token) {
    sleep(1);
    return;
  }
  const token = data.token;

  // Each VU iteration exercises every endpoint group.
  // Groups are numbered for easy sorting in output.

  testAuth(token);
  sleep(0.2);

  testPublic();
  sleep(0.2);

  testNotifications(token);
  sleep(0.2);

  testSearch(token);
  sleep(0.2);

  testSettingsUsers(token);
  testSettingsRoles(token);
  testSettingsPermissions(token);
  sleep(0.2);

  testSettingsCampus(token);
  sleep(0.2);

  testSettingsSchools(token);
  sleep(0.2);

  testSettingsAudit(token);
  sleep(0.2);

  testTickets(token);
  sleep(0.2);

  testMaintenance(token);
  sleep(0.3);

  testEvents(token);
  sleep(0.2);

  testCalendar(token);
  sleep(0.2);

  testAthletics(token);
  sleep(0.3);

  testInventory(token);
  sleep(0.2);

  testModules(token);
  sleep(0.2);

  testAcademic(token);
  sleep(0.2);

  testPlanning(token);

  // Think time between full iterations
  sleep(Math.random() * 2 + 1);
}

// ─── Teardown ──────────────────────────────────────────────────────────────────

export function teardown(data) {
  if (!data.token) {
    console.warn('No auth token was available — all requests were skipped.');
  }
  console.log('\n=== Comprehensive Performance Test Complete ===');
  console.log('Review p50/p95/p99 values per endpoint above.');
  console.log('Endpoints with p95 > 500ms may need optimization.');
}
