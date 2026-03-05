/**
 * Shared configuration for k6 performance tests.
 *
 * Environment variables (pass via k6 --env or -e):
 *   BASE_URL       - Target server (default: http://127.0.0.1:3004)
 *   ORG_ID         - Organization UUID for multi-tenant scoping (required)
 *   AUTH_EMAIL     - Login email for the test user (required)
 *   AUTH_PASSWORD   - Login password for the test user (required)
 *
 * Example:
 *   k6 run -e BASE_URL=http://127.0.0.1:3004 \
 *          -e ORG_ID=<uuid> \
 *          -e AUTH_EMAIL=admin@demo.com \
 *          -e AUTH_PASSWORD=password123 \
 *          scripts/perf/load-test.js
 */

export const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3004';
export const ORG_ID = __ENV.ORG_ID || '';
export const AUTH_EMAIL = __ENV.AUTH_EMAIL || '';
export const AUTH_PASSWORD = __ENV.AUTH_PASSWORD || '';

/**
 * Authenticate and return an auth token.
 * Call this in setup() so all VUs share the same token.
 */
export function authenticate(http) {
  const loginPayload = JSON.stringify({
    email: AUTH_EMAIL,
    password: AUTH_PASSWORD,
    organizationId: ORG_ID,
  });

  const res = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status !== 200) {
    console.error(`Login failed: ${res.status} — ${res.body}`);
    return null;
  }

  const body = JSON.parse(res.body);
  if (!body.ok || !body.data?.token) {
    console.error(`Login response missing token: ${JSON.stringify(body)}`);
    return null;
  }

  return body.data.token;
}

/**
 * Build standard auth headers for API requests.
 */
export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}
