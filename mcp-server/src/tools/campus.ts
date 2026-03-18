/**
 * Campus & Facilities tools for the Lionheart MCP server.
 *
 * These tools let AI assistants query campus information, buildings,
 * rooms, and team schedules.
 */

import { z } from 'zod'
import { callApi } from '../api-client.js'

export const campusTools = {
  // ── List Campuses ──────────────────────────────────────────────────────
  list_campuses: {
    description: 'List all campuses in the organization with their details.',
    inputSchema: z.object({}),
    execute: async () => {
      const campuses = await callApi('/api/settings/campus/campuses')
      return campuses
    },
  },

  // ── List Teams ─────────────────────────────────────────────────────────
  list_teams: {
    description: 'List all teams in the organization (IT Support, Facility Maintenance, AV Production, Teachers, Administration, etc.). Use to find which teams might be needed for an event.',
    inputSchema: z.object({}),
    execute: async () => {
      const teams = await callApi('/api/settings/teams')
      return teams
    },
  },

  // ── List Users ─────────────────────────────────────────────────────────
  list_staff: {
    description: 'List staff members who can be assigned to events, tasks, or as leads for schedule blocks.',
    inputSchema: z.object({
      teamId: z.string().optional().describe('Filter by team ID to see only members of a specific team'),
    }),
    execute: async (input: { teamId?: string }) => {
      const params = input.teamId ? `?teamId=${input.teamId}` : ''
      const users = await callApi(`/api/settings/users${params}`)
      return users
    },
  },

  // ── Get School Info ────────────────────────────────────────────────────
  get_school_info: {
    description: 'Get organization/school information including name, grade levels, principal, contact info. Useful for understanding the school context when planning events.',
    inputSchema: z.object({}),
    execute: async () => {
      const info = await callApi('/api/settings/school-info')
      return info
    },
  },
}
