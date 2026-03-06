/**
 * Conflict resolution strategies for offline sync.
 *
 * These are applied when a local mutation is replayed against a server that
 * may have been updated by another client while we were offline.
 */

/**
 * Last-write-wins for status conflicts.
 *
 * Returns the status from whichever side was updated most recently.
 * If local was updated after the server state, the local change wins.
 * Otherwise, the server's current state is authoritative.
 */
export function resolveStatusConflict(
  localStatus: string,
  serverStatus: string,
  localUpdatedAt: Date,
  serverUpdatedAt: Date
): string {
  return localUpdatedAt > serverUpdatedAt ? localStatus : serverStatus
}

/**
 * Merge (append) strategy for comment/activity conflicts.
 *
 * The server's activity feed is the source of truth. Local comments are
 * appended only if they are not already present in the server's list.
 * Deduplication is by content (comments don't have stable local IDs).
 */
export function resolveCommentConflict(
  localComments: string[],
  serverComments: string[]
): string[] {
  const serverSet = new Set(serverComments)
  const newLocal = localComments.filter((c) => !serverSet.has(c))
  return [...serverComments, ...newLocal]
}
