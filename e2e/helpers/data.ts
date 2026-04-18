/**
 * Randomised test-data factories so parallel workers never collide.
 *
 * IMPORTANT: we're hitting a shared staging DB. All factories prefix with
 * "e2e-" so janitorial cleanup scripts can safely sweep them up.
 */

import { randomUUID } from 'node:crypto'

const TAG = 'e2e'

/** Short, file-system-safe unique suffix. */
export function uniq(prefix = ''): string {
  const short = randomUUID().slice(0, 8)
  return `${prefix}${prefix ? '-' : ''}${short}`
}

export function ticketTitle(): string {
  return `${TAG}-ticket-${uniq()}`
}

export function eventTitle(): string {
  return `${TAG}-event-${uniq()}`
}

export function orgSlug(): string {
  // Org slugs should be URL-safe, short, and unique per run.
  return `${TAG}-${uniq()}`.toLowerCase()
}

export function userEmail(purpose = 'user'): string {
  // Uses a plus-tag so real inbox isn't required on staging.
  return `${TAG}+${purpose}+${uniq()}@lionheart-test.com`
}

export function strongPassword(): string {
  // Meets common complexity rules: upper + lower + digit + symbol + length.
  return `Pw-${uniq()}-A1!`
}

export function buildingName(): string {
  return `${TAG} Building ${uniq()}`
}

export function roomName(): string {
  return `${TAG} Room ${uniq()}`
}

/** Prefix-based filter for janitorial scripts to recognise e2e fixtures. */
export const E2E_PREFIX = TAG
