/**
 * Calendar & Events tools for the Lionheart MCP server.
 *
 * These tools let AI assistants query calendars, check for conflicts,
 * find available rooms, and view event details.
 */

import { z } from 'zod'
import { callApi } from '../api-client.js'

export const calendarTools = {
  // ── List Calendars ─────────────────────────────────────────────────────
  list_calendars: {
    description: 'List all active calendars in the organization (School Calendar, Staff Calendar, Athletics, etc.)',
    inputSchema: z.object({}),
    execute: async () => {
      const calendars = await callApi('/api/calendar-events', { method: 'GET' })
      return calendars
    },
  },

  // ── Search Events ──────────────────────────────────────────────────────
  search_events: {
    description: 'Search calendar events within a date range. Use this to check what events are already scheduled, find conflicts, or see what is happening on specific dates.',
    inputSchema: z.object({
      start: z.string().describe('Start date in ISO format (e.g., 2026-04-01T00:00:00Z)'),
      end: z.string().describe('End date in ISO format (e.g., 2026-04-30T23:59:59Z)'),
      query: z.string().optional().describe('Optional search text to filter by event title'),
    }),
    execute: async (input: { start: string; end: string; query?: string }) => {
      const params = new URLSearchParams({
        start: input.start,
        end: input.end,
        limit: '50',
      })
      const events = await callApi(`/api/calendar-events?${params}`)
      return events
    },
  },

  // ── Check Room Availability ────────────────────────────────────────────
  check_room_availability: {
    description: 'Check if a specific room or building is available during a time range. Returns any conflicting events.',
    inputSchema: z.object({
      buildingId: z.string().optional().describe('Building ID to check'),
      roomId: z.string().optional().describe('Room ID to check'),
      startTime: z.string().describe('Start time in ISO format'),
      endTime: z.string().describe('End time in ISO format'),
    }),
    execute: async (input: { buildingId?: string; roomId?: string; startTime: string; endTime: string }) => {
      // Query events in the time range at the specified location
      const params = new URLSearchParams({
        start: input.startTime,
        end: input.endTime,
        limit: '20',
      })
      const events = await callApi(`/api/calendar-events?${params}`)
      return { available: Array.isArray(events) && events.length === 0, conflicts: events }
    },
  },

  // ── List Buildings & Rooms ─────────────────────────────────────────────
  list_buildings_and_rooms: {
    description: 'List all buildings and rooms in the organization. Use this when planning events to find available venues.',
    inputSchema: z.object({}),
    execute: async () => {
      const buildings = await callApi('/api/settings/campus/buildings')
      return buildings
    },
  },

  // ── Get Event Details ──────────────────────────────────────────────────
  get_event_details: {
    description: 'Get full details for a specific event including attendees, resource requests, approval status, and schedule.',
    inputSchema: z.object({
      eventId: z.string().describe('The event ID to look up'),
    }),
    execute: async (input: { eventId: string }) => {
      const event = await callApi(`/api/events/projects/${input.eventId}`)
      return event
    },
  },

  // ── List Event Templates ───────────────────────────────────────────────
  list_event_templates: {
    description: 'List saved event templates that can be used as starting points for new events. Templates contain pre-configured schedules, tasks, budgets, and documents.',
    inputSchema: z.object({}),
    execute: async () => {
      const templates = await callApi('/api/events/templates')
      return templates
    },
  },
}
