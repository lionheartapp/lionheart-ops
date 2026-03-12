/**
 * AI Assistant — Search Domain Tools
 * Moved from assistant-tools.ts: search_platform
 */

import { registerTools, type ToolRegistryEntry } from './_registry'
import { prisma } from '@/lib/db'

const tools: Record<string, ToolRegistryEntry> = {
  search_platform: {
    definition: {
      name: 'search_platform',
      description: 'Search across the platform for users, tickets, events, devices, buildings, and rooms by keyword.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query text' },
          limit: { type: 'number', description: 'Max results to return (default: 8)' },
        },
        required: ['query'],
      },
    },
    requiredPermission: null,
    riskTier: 'GREEN',
    execute: async (input) => {
      const query = String(input.query || '').trim()
      const limit = Math.min((input.limit as number) || 8, 20)
      if (!query) return JSON.stringify({ results: [] })

      const [users, tickets, buildings, rooms, events] = await Promise.all([
        prisma.user.findMany({
          where: { OR: [{ name: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } }] },
          select: { id: true, name: true, email: true },
          take: limit,
        }),
        prisma.maintenanceTicket.findMany({
          where: { OR: [{ title: { contains: query, mode: 'insensitive' } }, { description: { contains: query, mode: 'insensitive' } }] },
          select: { id: true, title: true, status: true, category: true, ticketNumber: true },
          take: limit,
        }).catch(() => [] as any[]),
        prisma.building.findMany({
          where: { name: { contains: query, mode: 'insensitive' } },
          select: { id: true, name: true },
          take: limit,
        }),
        prisma.room.findMany({
          where: { OR: [{ displayName: { contains: query, mode: 'insensitive' } }, { roomNumber: { contains: query, mode: 'insensitive' } }] },
          select: { id: true, roomNumber: true, displayName: true },
          take: limit,
        }),
        prisma.event.findMany({
          where: { title: { contains: query, mode: 'insensitive' } },
          select: { id: true, title: true, startsAt: true, status: true },
          take: limit,
        }).catch(() => [] as any[]),
      ])

      return JSON.stringify({
        users: users.map(u => ({ id: u.id, name: u.name, email: u.email })),
        tickets: tickets.map((t: any) => ({ id: t.id, number: t.ticketNumber, title: t.title, status: t.status, category: t.category })),
        buildings: buildings.map(b => ({ id: b.id, name: b.name })),
        rooms: rooms.map(r => ({ id: r.id, name: r.displayName || r.roomNumber, number: r.roomNumber })),
        events: events.map((e: any) => ({ id: e.id, title: e.title, date: e.startsAt, status: e.status })),
      })
    },
  },
}

registerTools(tools)
