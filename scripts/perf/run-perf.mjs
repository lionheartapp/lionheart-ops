#!/usr/bin/env node

/**
 * Lionheart Platform — Performance Test Runner
 *
 * Convenience wrapper around k6 that loads credentials from .env.local
 * (or .env) and passes them as k6 environment variables.
 *
 * Usage:
 *   node scripts/perf/run-perf.mjs [test-type] [options]
 *
 * Test types:
 *   load            Standard load test (default)
 *   stress          Stress test — find breaking points
 *   spike           Spike test — sudden traffic surge
 *   soak            Soak test — sustained load for memory leaks
 *   benchmark       Per-endpoint latency benchmarks
 *   comprehensive   All 55+ endpoints across every module
 *
 * Options:
 *   --json          Output results as JSON to scripts/perf/results/
 *   --endpoint X    (benchmark only) Run a single endpoint
 *   --duration X    (soak only) Override soak duration, e.g., "1h"
 *   --base-url X    Override the target URL
 *   --vus X         Override max VUs (only works with some scenarios)
 *   --help          Show this message
 *
 * Examples:
 *   node scripts/perf/run-perf.mjs load
 *   node scripts/perf/run-perf.mjs benchmark --endpoint search --json
 *   node scripts/perf/run-perf.mjs soak --duration 1h
 */

import { execSync, spawnSync } from 'child_process';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..');

// --- Parse args ---
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(readFileSync(resolve(__dirname, 'run-perf.mjs'), 'utf8').match(/\/\*\*([\s\S]*?)\*\//)?.[1] || '');
  process.exit(0);
}

const testType = (args.find(a => !a.startsWith('--')) || 'load').toLowerCase();
const wantJson = args.includes('--json');
const flagValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
};

const testFiles = {
  load:          'load-test.js',
  stress:        'stress-test.js',
  spike:         'spike-test.js',
  soak:          'soak-test.js',
  benchmark:     'endpoint-benchmark.js',
  comprehensive: 'comprehensive-test.js',
};

if (!testFiles[testType]) {
  console.error(`Unknown test type: ${testType}`);
  console.error(`Valid types: ${Object.keys(testFiles).join(', ')}`);
  process.exit(1);
}

// --- Check k6 is installed ---
try {
  execSync('which k6', { stdio: 'pipe' });
} catch {
  console.error('k6 is not installed. Install it first:');
  console.error('  brew install k6          (macOS)');
  console.error('  https://k6.io/docs/get-started/installation/');
  process.exit(1);
}

// --- Load env from .env.local or .env ---
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf8');
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Remove surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

const envLocal = loadEnvFile(resolve(projectRoot, '.env.local'));
const envFile = loadEnvFile(resolve(projectRoot, '.env'));
const env = { ...envFile, ...envLocal }; // .env.local takes precedence

// --- Resolve test credentials ---
// The runner needs: ORG_ID, AUTH_EMAIL, AUTH_PASSWORD
// These can come from env files as PERF_ORG_ID / PERF_AUTH_EMAIL / PERF_AUTH_PASSWORD
// or from shell environment.
const ORG_ID       = process.env.PERF_ORG_ID       || env.PERF_ORG_ID       || process.env.ORG_ID       || '';
const AUTH_EMAIL   = process.env.PERF_AUTH_EMAIL    || env.PERF_AUTH_EMAIL    || process.env.AUTH_EMAIL   || '';
const AUTH_PASSWORD = process.env.PERF_AUTH_PASSWORD || env.PERF_AUTH_PASSWORD || process.env.AUTH_PASSWORD || '';
const BASE_URL     = flagValue('--base-url') || process.env.PERF_BASE_URL || env.PERF_BASE_URL || 'http://127.0.0.1:3004';

if (!ORG_ID || !AUTH_EMAIL || !AUTH_PASSWORD) {
  console.error('Missing required credentials. Set these in .env.local or as environment variables:');
  console.error('  PERF_ORG_ID=<organization-uuid>');
  console.error('  PERF_AUTH_EMAIL=<test-user-email>');
  console.error('  PERF_AUTH_PASSWORD=<test-user-password>');
  console.error('');
  console.error('Or pass them directly:');
  console.error('  ORG_ID=xxx AUTH_EMAIL=xxx AUTH_PASSWORD=xxx node scripts/perf/run-perf.mjs load');
  process.exit(1);
}

// --- Build k6 command ---
const testFile = resolve(__dirname, testFiles[testType]);

// Build args as a proper array to handle paths with spaces
const k6Args = [
  'run',
  '-e', `BASE_URL=${BASE_URL}`,
  '-e', `ORG_ID=${ORG_ID}`,
  '-e', `AUTH_EMAIL=${AUTH_EMAIL}`,
  '-e', `AUTH_PASSWORD=${AUTH_PASSWORD}`,
];

const endpoint = flagValue('--endpoint');
if (endpoint) k6Args.push('-e', `ENDPOINT=${endpoint}`);

const duration = flagValue('--duration');
if (duration) k6Args.push('-e', `SOAK_DURATION=${duration}`);

let jsonOutPath = '';
if (wantJson) {
  const resultsDir = resolve(__dirname, 'results');
  mkdirSync(resultsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  jsonOutPath = resolve(resultsDir, `${testType}-${ts}.json`);
  k6Args.push('--out', `json=${jsonOutPath}`);
}

k6Args.push(testFile);

console.log(`\n--- Lionheart Performance Test: ${testType.toUpperCase()} ---`);
console.log(`Target: ${BASE_URL}`);
console.log(`Org:    ${ORG_ID.slice(0, 8)}...`);
console.log(`User:   ${AUTH_EMAIL}`);
console.log(`File:   ${testFiles[testType]}`);
if (wantJson) console.log(`JSON:   ${jsonOutPath}`);
console.log('');

const result = spawnSync('k6', k6Args, {
  stdio: 'inherit',
  cwd: projectRoot,
});

process.exit(result.status || 0);
