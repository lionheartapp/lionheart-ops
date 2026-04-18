/**
 * Human-readable copy for HTTP status codes.
 *
 * Audit ref M3: the app surfaced "Request failed (500)" / "Request failed
 * (403)" as widget error text, which lumps permission failures and rate
 * limits in with outages. This module maps status codes to copy the user can
 * actually act on, plus a coarse category so callers can decide whether to
 * offer a retry button, a "sign in again" CTA, or just a link to support.
 */

export type HttpErrorCategory =
  | 'auth'
  | 'permission'
  | 'not-found'
  | 'rate-limit'
  | 'conflict'
  | 'validation'
  | 'server'
  | 'network'
  | 'unknown'

export interface HttpErrorInfo {
  message: string
  category: HttpErrorCategory
  retryable: boolean
}

const FALLBACK: HttpErrorInfo = {
  message: 'Something went wrong. Please try again.',
  category: 'unknown',
  retryable: true,
}

/**
 * Translate a fetch Response status (or `null` for network failures) into
 * human copy + a category tag. The `label` argument is prepended to the
 * message where it reads naturally (e.g. "load events") so callers can give
 * the message domain-specific context.
 */
export function httpErrorMessage(
  status: number | null,
  label?: string,
): HttpErrorInfo {
  const task = label ?? 'complete that request'

  if (status === null) {
    return {
      message: `Network error — check your connection and try again.`,
      category: 'network',
      retryable: true,
    }
  }

  if (status === 401) {
    return {
      message: 'Your session expired. Please sign in again to continue.',
      category: 'auth',
      retryable: false,
    }
  }

  if (status === 403) {
    return {
      message: `You don't have permission to ${task}.`,
      category: 'permission',
      retryable: false,
    }
  }

  if (status === 404) {
    return {
      message: `We couldn't find what you were looking for.`,
      category: 'not-found',
      retryable: false,
    }
  }

  if (status === 409) {
    return {
      message: 'That conflicts with something that already exists. Refresh and try again.',
      category: 'conflict',
      retryable: true,
    }
  }

  if (status === 422) {
    return {
      message: 'Some fields need attention — please review and try again.',
      category: 'validation',
      retryable: false,
    }
  }

  if (status === 429) {
    return {
      message: 'Too many requests right now. Try again in a moment.',
      category: 'rate-limit',
      retryable: true,
    }
  }

  if (status >= 500 && status < 600) {
    return {
      message: `Our servers are having trouble. Please try again in a minute.`,
      category: 'server',
      retryable: true,
    }
  }

  if (status >= 400 && status < 500) {
    // Unmapped 4xx — still likely the caller's fault but we don't know what.
    return {
      message: `We couldn't ${task} (status ${status}).`,
      category: 'validation',
      retryable: false,
    }
  }

  return FALLBACK
}
