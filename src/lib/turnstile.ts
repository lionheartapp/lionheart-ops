/**
 * Cloudflare Turnstile server-side token verification.
 * Called as first action in any public POST handler before touching DB.
 *
 * In development (no TURNSTILE_SECRET_KEY), returns true to skip validation.
 */
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    // Dev mode: skip Turnstile when not configured
    console.warn('[turnstile] TURNSTILE_SECRET_KEY not set — skipping validation')
    return true
  }

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret,
      response: token,
      ...(ip ? { remoteip: ip } : {}),
    }),
  })

  const data = await res.json() as { success: boolean }
  return data.success === true
}
