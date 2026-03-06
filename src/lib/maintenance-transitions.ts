/**
 * Client-safe Kanban transition map.
 *
 * This is a plain JavaScript object — no Prisma, no server imports.
 * KanbanBoard imports from here instead of maintenanceTicketService.ts
 * to avoid pulling server-side dependencies (mjml, fs) into client bundles.
 *
 * Keep in sync with ALLOWED_TRANSITIONS in maintenanceTicketService.ts.
 */

/**
 * Which status values are valid drag targets from a given source status.
 * Does NOT include SCHEDULED or CANCELLED (not shown as board columns).
 */
export const BOARD_ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  BACKLOG:     ['TODO', 'SCHEDULED', 'CANCELLED'],
  TODO:        ['IN_PROGRESS', 'BACKLOG', 'SCHEDULED', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['QA', 'DONE', 'ON_HOLD', 'TODO', 'CANCELLED'],
  ON_HOLD:     ['TODO', 'IN_PROGRESS', 'CANCELLED'],
  SCHEDULED:   ['TODO', 'IN_PROGRESS', 'CANCELLED'],
  QA:          ['DONE', 'IN_PROGRESS', 'CANCELLED'],
  DONE:        [],
  CANCELLED:   [],
}

export function isBoardTransitionAllowed(fromStatus: string, toStatus: string): boolean {
  return (BOARD_ALLOWED_TRANSITIONS[fromStatus] ?? []).includes(toStatus)
}
