import { APIRequestContext, expect, request as pwRequest } from '@playwright/test'
import { env } from './env'

/**
 * ApiClient — thin wrapper over Playwright's APIRequestContext that:
 *   - bakes in the base URL
 *   - injects the JWT auth cookie once you call `login()`
 *   - injects the x-org-id header (set automatically from the JWT by middleware,
 *     but we also pass it explicitly for belt-and-suspenders)
 *   - asserts the { ok, data } / { ok:false, error } envelope shape
 *
 * The Lionheart app uses httpOnly cookies for the JWT (see cookie-options.ts).
 * Playwright's APIRequestContext stores cookies automatically, so a login call
 * implicitly authenticates every subsequent request on the same client.
 */

export type Envelope<T> =
  | { ok: true; data: T; meta?: Record<string, unknown> }
  | { ok: false; error: { code: string; message: string; details?: unknown } }

export interface LoginCredentials {
  email: string
  password: string
  organizationId: string
}

export class ApiClient {
  private csrfToken: string | null = null

  private constructor(private ctx: APIRequestContext, public organizationId: string) {}

  /** Create a fresh, unauthenticated API client. */
  static async anonymous(organizationId: string = env.orgA.id): Promise<ApiClient> {
    const ctx = await pwRequest.newContext({
      baseURL: env.baseUrl,
      extraHTTPHeaders: {
        'content-type': 'application/json',
      },
    })
    return new ApiClient(ctx, organizationId)
  }

  /**
   * Log in and return an authenticated client.
   * Retries up to 3 times on 429 (rate limited) with exponential backoff,
   * since the IP-based rate limiter may still have tokens from a prior run.
   */
  static async login(creds: LoginCredentials): Promise<ApiClient> {
    const client = await ApiClient.anonymous(creds.organizationId)

    let res: Awaited<ReturnType<APIRequestContext['post']>> | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await client.ctx.post('/api/auth/login', {
        data: {
          email: creds.email,
          password: creds.password,
          organizationId: creds.organizationId,
        },
      })
      if (res.status() !== 429) break
      // Rate limited — wait and retry
      const delay = (attempt + 1) * 5_000 // 5s, 10s, 15s
      await new Promise((r) => setTimeout(r, delay))
    }

    expect(res!.status(), `login failed for ${creds.email}`).toBe(200)
    const body = (await res!.json()) as Envelope<unknown>
    expect(body.ok, `login envelope.ok should be true, got ${JSON.stringify(body)}`).toBe(true)

    // Extract CSRF token from Set-Cookie response header.
    // The double-submit pattern requires echoing this back via x-csrf-token
    // on every state-changing request (POST / PUT / PATCH / DELETE).
    const setCookie = res!.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie')
    for (const h of setCookie) {
      const match = h.value.match(/csrf-token=([^;]+)/)
      if (match) {
        client.csrfToken = match[1]
        break
      }
    }

    return client
  }

  /** Parse a response body as JSON, gracefully handling empty or non-JSON responses. */
  private async safeJson<T>(res: { status(): number; text(): Promise<string> }): Promise<Envelope<T>> {
    const text = await res.text()
    try {
      return JSON.parse(text) as Envelope<T>
    } catch {
      return (res.status() < 300
        ? { ok: true, data: null as T }
        : { ok: false, error: { code: 'NON_JSON', message: `${res.status()} — ${text.slice(0, 200)}` } }) as Envelope<T>
    }
  }

  /** Headers shared by all mutation methods. */
  private mutationHeaders(): Record<string, string> {
    const h: Record<string, string> = {
      'x-org-id': this.organizationId,
      'content-type': 'application/json',
    }
    if (this.csrfToken) h['x-csrf-token'] = this.csrfToken
    return h
  }

  async get<T = unknown>(path: string): Promise<{ status: number; body: Envelope<T> }> {
    const res = await this.ctx.get(path, {
      headers: { 'x-org-id': this.organizationId },
    })
    return { status: res.status(), body: await this.safeJson<T>(res) }
  }

  async post<T = unknown>(path: string, data: unknown): Promise<{ status: number; body: Envelope<T> }> {
    const res = await this.ctx.post(path, {
      data: data as object,
      headers: this.mutationHeaders(),
    })
    return { status: res.status(), body: await this.safeJson<T>(res) }
  }

  async patch<T = unknown>(path: string, data: unknown): Promise<{ status: number; body: Envelope<T> }> {
    const res = await this.ctx.patch(path, {
      data: data as object,
      headers: this.mutationHeaders(),
    })
    return { status: res.status(), body: await this.safeJson<T>(res) }
  }

  async put<T = unknown>(path: string, data: unknown): Promise<{ status: number; body: Envelope<T> }> {
    const res = await this.ctx.put(path, {
      data: data as object,
      headers: this.mutationHeaders(),
    })
    return { status: res.status(), body: await this.safeJson<T>(res) }
  }

  async delete<T = unknown>(path: string): Promise<{ status: number; body: Envelope<T> }> {
    const res = await this.ctx.delete(path, {
      headers: this.mutationHeaders(),
    })
    return { status: res.status(), body: await this.safeJson<T>(res) }
  }

  /** Expose the raw APIRequestContext for file uploads / streaming cases. */
  raw(): APIRequestContext {
    return this.ctx
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose()
  }
}

/**
 * Assert a successful envelope and narrow the type.
 * Fails the test with a useful diff if { ok: false } comes back.
 */
export function assertOk<T>(
  envelope: Envelope<T>,
  msg?: string,
): asserts envelope is { ok: true; data: T; meta?: Record<string, unknown> } {
  if (!envelope.ok) {
    throw new Error(
      `${msg ?? 'expected ok=true'} but got error: ` +
        `${envelope.error.code}: ${envelope.error.message}`,
    )
  }
}

/** Assert an error envelope with a specific code. */
export function assertFail<T>(envelope: Envelope<T>, code: string, msg?: string): void {
  if (envelope.ok) {
    throw new Error(
      `${msg ?? 'expected ok=false'} but got success data: ${JSON.stringify(envelope.data)}`,
    )
  }
  expect(envelope.error.code, msg).toBe(code)
}
