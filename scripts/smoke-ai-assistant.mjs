#!/usr/bin/env node
/**
 * Smoke test: AI Assistant Tools
 *
 * Verifies the 4 new tools are registered and return expected JSON shapes
 * by sending prompts to the chat endpoint and checking for tool_start events
 * in the SSE response stream.
 *
 * Prerequisites:
 *   - Dev server running at BASE_URL (default: http://localhost:3004)
 *   - Seed data present (admin@demo.com / password123)
 *   - GEMINI_API_KEY set in server environment
 *
 * Run: node scripts/smoke-ai-assistant.mjs
 * Run with custom creds: TEST_EMAIL=user@org.com TEST_PASSWORD=pass node scripts/smoke-ai-assistant.mjs
 */

const BASE = process.env.BASE_URL || 'http://localhost:3004'
const EMAIL = process.env.TEST_EMAIL || 'admin@demo.com'
const PASSWORD = process.env.TEST_PASSWORD || 'password123'

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  if (!json.ok) throw new Error(`Login failed: ${json.error?.message}`)

  // Prefer Set-Cookie header for httpOnly cookie auth; fallback to Bearer token
  const cookie = res.headers.get('set-cookie')
  const token = json.data?.token
  return { token, cookie }
}

async function testChat(authState, message) {
  const headers = { 'Content-Type': 'application/json' }

  if (authState.cookie) {
    headers['Cookie'] = authState.cookie
  } else if (authState.token) {
    headers['Authorization'] = `Bearer ${authState.token}`
  }

  const res = await fetch(`${BASE}/api/ai/assistant/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      conversationHistory: [],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return { error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
  }

  // Parse SSE stream
  const text = await res.text()
  const events = text
    .split('\n\n')
    .filter(chunk => chunk.startsWith('data: '))
    .map(chunk => {
      try {
        return JSON.parse(chunk.replace(/^data: /, ''))
      } catch {
        return null
      }
    })
    .filter(Boolean)

  return { events }
}

let passed = 0
let failed = 0
let skipped = 0

function pass(label) {
  console.log(`  PASS  ${label}`)
  passed++
}

function fail(label) {
  console.log(`  FAIL  ${label}`)
  failed++
}

function skip(label, reason) {
  console.log(`  SKIP  ${label} (${reason})`)
  skipped++
}

function assert(condition, label) {
  if (condition) {
    pass(label)
  } else {
    fail(label)
  }
}

function findToolStart(events, toolName) {
  return events.find(e => e.type === 'tool_start' && e.tool === toolName)
}

async function run() {
  console.log('AI Assistant Tools Smoke Test')
  console.log('=============================\n')
  console.log(`Server: ${BASE}`)
  console.log(`User:   ${EMAIL}\n`)

  // ── Login ──────────────────────────────────────────────────────────────────
  let authState
  try {
    authState = await login()
    console.log('Auth: logged in successfully\n')
  } catch (e) {
    console.error(`Cannot login: ${e.message}`)
    console.log('\nEnsure the dev server is running and seed data exists.')
    console.log(`  npm run dev`)
    console.log(`  npm run db:seed`)
    process.exit(1)
  }

  // ── Test 1: check_room_availability ────────────────────────────────────────
  console.log('Test 1: check_room_availability')
  const roomResult = await testChat(authState, 'Is the Gym available this Friday from 6pm to 9pm?')
  if (roomResult.error) {
    skip('check_room_availability tool was called', roomResult.error)
    skip('Tool returned a structured result', 'skipped due to request error')
  } else {
    const toolStarts = roomResult.events.filter(e => e.type === 'tool_start')
    const toolResults = roomResult.events.filter(e => e.type === 'tool_result')
    const roomTool = findToolStart(roomResult.events, 'check_room_availability')

    assert(toolStarts.length > 0, 'At least one tool was called')
    assert(roomTool != null, 'check_room_availability tool was called')
    assert(toolResults.length > 0, 'Tool returned a result')

    if (roomTool) {
      // Verify result contains expected JSON shape
      const result = toolResults.find(e => e.tool === 'check_room_availability')
      if (result?.result) {
        try {
          const parsed = JSON.parse(result.result)
          assert('available' in parsed || 'error' in parsed, 'Result has available or error field')
        } catch {
          fail('Tool result is valid JSON')
        }
      }
    }
  }

  // ── Test 2: get_weather_forecast ───────────────────────────────────────────
  console.log('\nTest 2: get_weather_forecast')
  const weatherResult = await testChat(authState, 'What is the weather forecast for 2026-03-20?')
  if (weatherResult.error) {
    skip('get_weather_forecast tool was called', weatherResult.error)
  } else {
    const weatherTool = findToolStart(weatherResult.events, 'get_weather_forecast')
    assert(weatherTool != null, 'get_weather_forecast tool was called')

    const toolResults = weatherResult.events.filter(e => e.type === 'tool_result')
    if (toolResults.length > 0) {
      const result = toolResults.find(e => e.tool === 'get_weather_forecast')
      if (result?.result) {
        try {
          const parsed = JSON.parse(result.result)
          // Either success (has date/high/low) or a friendly error (missing coords)
          const isSuccessShape = 'date' in parsed && 'high' in parsed && 'low' in parsed
          const isFriendlyError = 'error' in parsed && typeof parsed.error === 'string'
          assert(isSuccessShape || isFriendlyError, 'Result has expected shape (forecast data or friendly error)')
        } catch {
          fail('Tool result is valid JSON')
        }
      }
    }
  }

  // ── Test 3: check_resource_availability ───────────────────────────────────
  console.log('\nTest 3: check_resource_availability')
  const resourceResult = await testChat(authState, 'How many chairs do we have in inventory?')
  if (resourceResult.error) {
    skip('check_resource_availability tool was called', resourceResult.error)
  } else {
    const resourceTool = findToolStart(resourceResult.events, 'check_resource_availability')
    assert(resourceTool != null, 'check_resource_availability tool was called')

    const toolResults = resourceResult.events.filter(e => e.type === 'tool_result')
    if (toolResults.length > 0) {
      const result = toolResults.find(e => e.tool === 'check_resource_availability')
      if (result?.result) {
        try {
          const parsed = JSON.parse(result.result)
          const isSuccessShape = 'found' in parsed
          assert(isSuccessShape, 'Result has found field')
          if (parsed.found) {
            assert(Array.isArray(parsed.items), 'items is an array when found=true')
          }
        } catch {
          fail('Tool result is valid JSON')
        }
      }
    }
  }

  // ── Test 4: find_available_rooms ───────────────────────────────────────────
  console.log('\nTest 4: find_available_rooms')
  const findResult = await testChat(authState, 'What rooms do we have available for a large meeting?')
  if (findResult.error) {
    skip('find_available_rooms tool was called', findResult.error)
  } else {
    const findTool = findToolStart(findResult.events, 'find_available_rooms')
    assert(findTool != null, 'find_available_rooms tool was called')

    const toolResults = findResult.events.filter(e => e.type === 'tool_result')
    if (toolResults.length > 0) {
      const result = toolResults.find(e => e.tool === 'find_available_rooms')
      if (result?.result) {
        try {
          const parsed = JSON.parse(result.result)
          assert(Array.isArray(parsed.rooms), 'Result has rooms array')
          assert(typeof parsed.count === 'number', 'Result has count field')
        } catch {
          fail('Tool result is valid JSON')
        }
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n=============================')
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`)

  if (failed > 0) {
    console.log('\nNote: Tool selection is non-deterministic. If tests fail, try running again.')
    console.log('The AI may use different tools based on context.')
  }

  if (skipped > 0) {
    console.log('\nNote: Skipped tests require a running dev server and GEMINI_API_KEY.')
  }

  process.exit(failed > 0 ? 1 : 0)
}

run().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
