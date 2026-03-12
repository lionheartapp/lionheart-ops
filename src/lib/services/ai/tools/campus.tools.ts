/**
 * AI Assistant — Campus Domain Tools
 *
 * Existing: get_campus_info
 * New:      create_building, update_building, create_room, update_room
 */

import { registerTools, type ToolRegistryEntry } from './_registry'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const tools: Record<string, ToolRegistryEntry> = {
  // ── GREEN: Campus Info ───────────────────────────────────────────────────
  get_campus_info: {
    definition: {
      name: 'get_campus_info',
      description: 'Get information about campus buildings, rooms, and schools in the organization.',
      parameters: {
        type: 'object',
        properties: {
          info_type: { type: 'string', enum: ['buildings', 'rooms', 'schools'], description: 'What campus info to retrieve' },
          building_id: { type: 'string', description: 'Filter rooms by building ID (optional)' },
        },
        required: ['info_type'],
      },
    },
    requiredPermission: null,
    riskTier: 'GREEN',
    execute: async (input) => {
      const infoType = input.info_type as string
      switch (infoType) {
        case 'buildings': {
          const buildings = await prisma.building.findMany({ select: { id: true, name: true, address: true }, orderBy: { name: 'asc' } })
          return JSON.stringify({ buildings, count: buildings.length })
        }
        case 'rooms': {
          const buildingId = input.building_id as string | undefined
          const rooms = await prisma.room.findMany({
            where: buildingId ? { buildingId } : undefined,
            select: { id: true, roomNumber: true, displayName: true, building: { select: { name: true } } },
            orderBy: { roomNumber: 'asc' },
            take: 50,
          })
          return JSON.stringify({
            rooms: rooms.map(r => ({ id: r.id, name: r.displayName || r.roomNumber, number: r.roomNumber, building: r.building?.name })),
            count: rooms.length,
          })
        }
        case 'schools': {
          const schools = await prisma.school.findMany({ select: { id: true, name: true, gradeLevel: true }, orderBy: { name: 'asc' } })
          return JSON.stringify({ schools, count: schools.length })
        }
        default:
          return JSON.stringify({ error: `Unknown info type: ${infoType}` })
      }
    },
  },

  // ── ORANGE: Create Building ──────────────────────────────────────────────
  create_building: {
    definition: {
      name: 'create_building',
      description: 'Create a new building on campus. Returns confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Building name' },
          address: { type: 'string', description: 'Building address (optional)' },
        },
        required: ['name'],
      },
    },
    requiredPermission: PERMISSIONS.SETTINGS_UPDATE,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const draft = {
        action: 'create_building',
        name: String(input.name || ''),
        address: String(input.address || ''),
      }
      return JSON.stringify({
        confirmationRequired: true,
        message: `Create building "${draft.name}"${draft.address ? ` at ${draft.address}` : ''}?`,
        draft,
      })
    },
  },

  // ── ORANGE: Update Building ──────────────────────────────────────────────
  update_building: {
    definition: {
      name: 'update_building',
      description: 'Update a building\'s details. Returns confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          building_name: { type: 'string', description: 'Current building name' },
          new_name: { type: 'string', description: 'New building name (optional)' },
          address: { type: 'string', description: 'New address (optional)' },
        },
        required: ['building_name'],
      },
    },
    requiredPermission: PERMISSIONS.SETTINGS_UPDATE,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const building = await prisma.building.findFirst({
        where: { name: { contains: String(input.building_name || ''), mode: 'insensitive' } },
        select: { id: true, name: true },
      })
      if (!building) return JSON.stringify({ error: `Building not found: "${input.building_name}"` })

      const changes: string[] = []
      if (input.new_name) changes.push(`Name → "${input.new_name}"`)
      if (input.address) changes.push(`Address → "${input.address}"`)
      if (changes.length === 0) return JSON.stringify({ error: 'No changes specified.' })

      const draft = {
        action: 'update_building',
        buildingId: building.id,
        ...(input.new_name ? { name: String(input.new_name) } : {}),
        ...(input.address ? { address: String(input.address) } : {}),
      }
      return JSON.stringify({
        confirmationRequired: true,
        message: `Update building "${building.name}":\n${changes.map(c => `• ${c}`).join('\n')}`,
        draft,
      })
    },
  },

  // ── ORANGE: Create Room ──────────────────────────────────────────────────
  create_room: {
    definition: {
      name: 'create_room',
      description: 'Create a new room in a building. Returns confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          room_number: { type: 'string', description: 'Room number (e.g. "101", "A-200")' },
          display_name: { type: 'string', description: 'Display name (e.g. "Main Gym", "Science Lab")' },
          building_name: { type: 'string', description: 'Building this room belongs to' },
        },
        required: ['room_number', 'building_name'],
      },
    },
    requiredPermission: PERMISSIONS.SETTINGS_UPDATE,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const building = await prisma.building.findFirst({
        where: { name: { contains: String(input.building_name || ''), mode: 'insensitive' } },
        select: { id: true, name: true },
      })
      if (!building) return JSON.stringify({ error: `Building not found: "${input.building_name}"` })

      const draft = {
        action: 'create_room',
        roomNumber: String(input.room_number || ''),
        displayName: String(input.display_name || ''),
        buildingId: building.id,
        buildingName: building.name,
      }
      return JSON.stringify({
        confirmationRequired: true,
        message: `Create room ${draft.roomNumber}${draft.displayName ? ` (${draft.displayName})` : ''} in ${building.name}?`,
        draft,
      })
    },
  },

  // ── ORANGE: Update Room ──────────────────────────────────────────────────
  update_room: {
    definition: {
      name: 'update_room',
      description: 'Update a room\'s details. Returns confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          room_name: { type: 'string', description: 'Current room name or number' },
          new_room_number: { type: 'string', description: 'New room number (optional)' },
          display_name: { type: 'string', description: 'New display name (optional)' },
        },
        required: ['room_name'],
      },
    },
    requiredPermission: PERMISSIONS.SETTINGS_UPDATE,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const roomName = String(input.room_name || '')
      const room = await prisma.room.findFirst({
        where: { OR: [{ displayName: { contains: roomName, mode: 'insensitive' } }, { roomNumber: { contains: roomName, mode: 'insensitive' } }] },
        select: { id: true, roomNumber: true, displayName: true },
      })
      if (!room) return JSON.stringify({ error: `Room not found: "${roomName}"` })

      const changes: string[] = []
      if (input.new_room_number) changes.push(`Number → "${input.new_room_number}"`)
      if (input.display_name) changes.push(`Name → "${input.display_name}"`)
      if (changes.length === 0) return JSON.stringify({ error: 'No changes specified.' })

      const draft = {
        action: 'update_room',
        roomId: room.id,
        ...(input.new_room_number ? { roomNumber: String(input.new_room_number) } : {}),
        ...(input.display_name ? { displayName: String(input.display_name) } : {}),
      }
      return JSON.stringify({
        confirmationRequired: true,
        message: `Update room ${room.displayName || room.roomNumber}:\n${changes.map(c => `• ${c}`).join('\n')}`,
        draft,
      })
    },
  },
}

registerTools(tools)
