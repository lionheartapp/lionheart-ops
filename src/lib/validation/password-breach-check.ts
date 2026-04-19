import 'server-only'
import { createHash } from 'node:crypto'

/**
 * Check if a password has appeared in known data breaches using the
 * HaveIBeenPwned k-anonymity API. Only the first 5 characters of the
 * SHA-1 hash are sent — the full password never leaves the server.
 *
 * Returns true if the password has been breached.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
    const prefix = sha1.slice(0, 5)
    const suffix = sha1.slice(5)

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'User-Agent': 'Lionheart-Platform' },
      signal: AbortSignal.timeout(3000), // Don't block login if API is slow
    })

    if (!response.ok) return false // Fail open — don't block user if API is down

    const text = await response.text()
    // Each line is "SUFFIX:COUNT" — check if our suffix appears
    return text.split('\n').some((line) => line.startsWith(suffix))
  } catch {
    return false // Fail open on network errors
  }
}
