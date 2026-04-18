import { defineConfig, devices } from '@playwright/test'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load staging config from .env.e2e if present, otherwise .env.local / .env
// E2E tests target a deployed environment (staging) by default per project policy.
dotenv.config({ path: path.resolve(__dirname, '.env.e2e') })
dotenv.config({ path: path.resolve(__dirname, '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '.env') })

/**
 * Required env for E2E:
 *   E2E_BASE_URL         — e.g. https://staging.lionheartapp.com
 *   E2E_ORG_A_SLUG       — primary org slug under test (e.g. "linfield")
 *   E2E_ORG_A_ID         — UUID of org A
 *   E2E_ADMIN_EMAIL      — super-admin / admin user in org A
 *   E2E_ADMIN_PASSWORD   — password for above
 *   E2E_MEMBER_EMAIL     — member-role user in org A (for RBAC tests)
 *   E2E_MEMBER_PASSWORD  — password for above
 *
 * Required for multi-tenant isolation tests:
 *   E2E_ORG_B_SLUG       — second org slug
 *   E2E_ORG_B_ID         — UUID of org B
 *   E2E_ORG_B_ADMIN_EMAIL
 *   E2E_ORG_B_ADMIN_PASSWORD
 *
 * Optional:
 *   E2E_WORKERS          — number of parallel workers (default: 4)
 *   CI                   — when true, retries failed tests & fails on .only
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3004'
const isCI = !!process.env.CI

// Opt-in visual inventory: E2E_SCREENSHOTS=all flips screenshots + video on
// for every test, producing a walkable visual record in CI artifacts.
// E2E_SCREENSHOTS=trace additionally forces trace recording on all runs.
const screenshotMode = process.env.E2E_SCREENSHOTS === 'all' ? 'on' : 'only-on-failure'
const videoMode = process.env.E2E_SCREENSHOTS === 'all' ? 'on' : 'retain-on-failure'
const traceMode = process.env.E2E_SCREENSHOTS === 'trace' ? 'on' : 'retain-on-failure'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : isCI ? 2 : 4,

  reporter: isCI
    ? [['html', { outputFolder: 'playwright-report', open: 'never' }], ['github'], ['list']]
    : [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: traceMode,
    screenshot: screenshotMode,
    video: videoMode,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    extraHTTPHeaders: {
      // Tag requests so server logs can filter e2e noise.
      'x-e2e-run': process.env.GITHUB_RUN_ID || 'local',
    },
  },

  projects: [
    // -------------------------------------------------------------------
    // API-only tests — run first so UI suites don't block on infra issues
    // -------------------------------------------------------------------
    {
      name: 'api',
      testMatch: /e2e\/api\/.*\.spec\.ts$/,
      use: {
        // API tests don't need a browser UA, but we still hit baseURL.
        baseURL: BASE_URL,
      },
    },
    {
      name: 'permissions',
      testMatch: /e2e\/permissions\/.*\.spec\.ts$/,
      use: { baseURL: BASE_URL },
      dependencies: ['api'],
    },

    // -------------------------------------------------------------------
    // Browser-based UI tests
    // -------------------------------------------------------------------
    {
      name: 'chromium',
      testMatch: /e2e\/ui\/.*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['api'],
    },
    {
      name: 'firefox',
      testMatch: /e2e\/ui\/.*\.spec\.ts$/,
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['api'],
    },
    {
      name: 'webkit',
      testMatch: /e2e\/ui\/.*\.spec\.ts$/,
      use: { ...devices['Desktop Safari'] },
      dependencies: ['api'],
    },
    {
      name: 'mobile-chrome',
      testMatch: /e2e\/ui\/.*\.spec\.ts$/,
      use: { ...devices['Pixel 7'] },
      dependencies: ['api'],
    },

    // -------------------------------------------------------------------
    // Accessibility — runs against chromium only, slower so isolated
    // -------------------------------------------------------------------
    {
      name: 'a11y',
      testMatch: /e2e\/a11y\/.*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // When running locally without E2E_BASE_URL, spin up `npm run dev` first.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3004',
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
})
