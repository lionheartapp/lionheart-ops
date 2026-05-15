/**
 * GET /api/status — Aggregated service health check
 *
 * Public endpoint. Checks all core dependencies and returns a unified
 * status response. Each check has a 3-second timeout so a single slow
 * service doesn't block the entire response.
 *
 * Used by the public /status page and external uptime monitors.
 */

import { NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { ok } from '@/lib/api-response'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ServiceStatus = 'operational' | 'degraded' | 'outage'

interface ServiceCheck {
  name: string
  status: ServiceStatus
  latencyMs?: number
  message?: string
}

const CHECK_TIMEOUT_MS = 3000

/** Run a health check with a timeout. Returns degraded/outage on failure. */
async function runCheck(
  name: string,
  check: () => Promise<{ status: ServiceStatus; latencyMs?: number }>
): Promise<ServiceCheck> {
  try {
    const result = await Promise.race([
      check(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Health check timed out')), CHECK_TIMEOUT_MS)
      ),
    ])
    return { name, ...result }
  } catch (err) {
    return {
      name,
      status: 'outage',
      message: err instanceof Error ? err.message : 'Check failed',
    }
  }
}

// ─── Individual checks ───────────────────────────────────────────────

async function checkDatabase(): Promise<{ status: ServiceStatus; latencyMs: number }> {
  const start = Date.now()
  await rawPrisma.$queryRaw`SELECT 1`
  return { status: 'operational', latencyMs: Date.now() - start }
}

async function checkRedis(): Promise<{ status: ServiceStatus; latencyMs: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    return { status: 'operational', latencyMs: 0 } // Not configured = not a dependency
  }

  const start = Date.now()
  const res = await fetch(`${url}/ping`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Redis ping returned ${res.status}`)
  return { status: 'operational', latencyMs: Date.now() - start }
}

async function checkEmail(): Promise<{ status: ServiceStatus }> {
  // Resend: check API reachability with a lightweight domains list call
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Fall back to SMTP config check
    const smtpHost = process.env.SMTP_HOST
    return { status: smtpHost ? 'operational' : 'degraded' }
  }

  const res = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Resend API returned ${res.status}`)
  return { status: 'operational' }
}

async function checkStorage(): Promise<{ status: ServiceStatus; latencyMs: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return { status: 'degraded', latencyMs: 0 }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const start = Date.now()
  // Use the Supabase health endpoint — doesn't require auth
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'HEAD',
    headers: {
      apikey: serviceKey || anonKey || '',
    },
    cache: 'no-store',
  })
  // 401 with no key just means the key isn't configured — Supabase itself is reachable
  // 406 is expected for HEAD on the REST root
  if (!res.ok && res.status !== 406 && res.status !== 401) {
    throw new Error(`Supabase returned ${res.status}`)
  }
  return { status: 'operational', latencyMs: Date.now() - start }
}

async function checkAI(): Promise<{ status: ServiceStatus }> {
  // Gemini: env var presence only (no live ping — costs money per call)
  const key = process.env.GEMINI_API_KEY
  return { status: key ? 'operational' : 'degraded' }
}

// ─── Main handler ────────────────────────────────────────────────────

export async function GET() {
  const start = Date.now()

  const services = await Promise.all([
    runCheck('Database', checkDatabase),
    runCheck('Cache', checkRedis),
    runCheck('Email', checkEmail),
    runCheck('Storage', checkStorage),
    runCheck('AI', checkAI),
  ])

  // API is operational if we got this far
  const apiCheck: ServiceCheck = {
    name: 'API',
    status: 'operational',
    latencyMs: Date.now() - start,
  }

  const allServices = [apiCheck, ...services]

  // Overall status: worst of all services
  const hasOutage = allServices.some((s) => s.status === 'outage')
  const hasDegraded = allServices.some((s) => s.status === 'degraded')
  const overall: ServiceStatus = hasOutage ? 'outage' : hasDegraded ? 'degraded' : 'operational'

  return NextResponse.json(
    ok({
      overall,
      services: allServices,
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  )
}
