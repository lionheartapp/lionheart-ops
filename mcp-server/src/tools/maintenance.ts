/**
 * Maintenance & IT tools for the Lionheart MCP server.
 *
 * These tools let AI assistants check facility status, view tickets,
 * and understand operational context for event planning.
 */

import { z } from 'zod'
import { callApi } from '../api-client.js'

export const maintenanceTools = {
  // ── List Active Tickets ────────────────────────────────────────────────
  list_maintenance_tickets: {
    description: 'List active maintenance tickets. Useful for checking if a building/room has ongoing issues before scheduling an event there.',
    inputSchema: z.object({
      status: z.string().optional().describe('Filter by status (e.g., OPEN, IN_PROGRESS, ON_HOLD)'),
      buildingId: z.string().optional().describe('Filter by building ID'),
      limit: z.number().optional().default(20).describe('Max results to return'),
    }),
    execute: async (input: { status?: string; buildingId?: string; limit?: number }) => {
      const params = new URLSearchParams()
      if (input.status) params.set('status', input.status)
      if (input.buildingId) params.set('buildingId', input.buildingId)
      params.set('limit', String(input.limit || 20))
      const tickets = await callApi(`/api/tickets?${params}`)
      return tickets
    },
  },

  // ── Check Facility Status ──────────────────────────────────────────────
  check_facility_status: {
    description: 'Check if a specific building or room has any active maintenance issues or is under repair. Important for event venue selection.',
    inputSchema: z.object({
      buildingId: z.string().describe('Building ID to check'),
    }),
    execute: async (input: { buildingId: string }) => {
      const params = new URLSearchParams({
        buildingId: input.buildingId,
        status: 'OPEN,IN_PROGRESS,ON_HOLD',
        limit: '10',
      })
      const tickets = await callApi(`/api/tickets?${params}`)
      return {
        hasIssues: Array.isArray(tickets) && tickets.length > 0,
        activeTicketCount: Array.isArray(tickets) ? tickets.length : 0,
        tickets,
      }
    },
  },
}
