/**
 * AI Assistant — Tool Definitions & Execution
 *
 * Defines the tools available to the AI assistant and handles execution.
 * Each tool maps to existing analytics services or Prisma queries.
 * Permission checks are enforced before executing any tool.
 */

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getTicketsByStatus,
  getResolutionTimeByCategory,
  getTechnicianWorkload as getMaintenanceTechWorkload,
  getPmComplianceRate,
  getCategoryBreakdown,
  getTopTicketLocations,
  type AnalyticsOptions,
} from '@/lib/services/maintenanceAnalyticsService'
import {
  getTicketVolumeByType,
  getDeviceHealthByCampus,
  getLemonDeviceReport,
  getRepairCostByModel,
  getSLACompliance,
  getLoanerPoolUtilization,
  type ITAnalyticsOptions,
} from '@/lib/services/itAnalyticsService'

// ─── Tool Registry ────────────────────────────────────────────────────────────

export interface ToolRegistryEntry {
  definition: Anthropic.Tool
  requiredPermission: string | null // null = no permission needed
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<string>
}

export interface ToolContext {
  userId: string
  organizationId: string
}

const TOOL_REGISTRY: Record<string, ToolRegistryEntry> = {
  // ── Maintenance Analytics ─────────────────────────────────────────────
  query_maintenance_stats: {
    definition: {
      name: 'query_maintenance_stats',
      description:
        'Query maintenance analytics for the organization. Returns statistics about maintenance tickets, technician workload, PM compliance, costs, and more.',
      input_schema: {
        type: 'object' as const,
        properties: {
          stat_type: {
            type: 'string',
            enum: [
              'tickets_by_status',
              'resolution_time_by_category',
              'technician_workload',
              'pm_compliance',
              'category_breakdown',
              'top_locations',
            ],
            description: 'Which maintenance metric to retrieve',
          },
          campus_id: {
            type: 'string',
            description: 'Optional campus/school ID to filter by',
          },
          months: {
            type: 'number',
            description: 'Number of months of history to include (default: 6)',
          },
        },
        required: ['stat_type'],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_VIEW_ANALYTICS,
    execute: executeMaintenanceStats,
  },

  // ── IT Analytics ──────────────────────────────────────────────────────
  query_it_stats: {
    definition: {
      name: 'query_it_stats',
      description:
        'Query IT analytics for the organization. Returns statistics about IT tickets, device health, repair costs, SLA compliance, and loaner utilization.',
      input_schema: {
        type: 'object' as const,
        properties: {
          stat_type: {
            type: 'string',
            enum: [
              'ticket_volume_by_type',
              'device_health',
              'lemon_devices',
              'repair_cost_by_model',
              'sla_compliance',
              'loaner_utilization',
            ],
            description: 'Which IT metric to retrieve',
          },
          school_id: {
            type: 'string',
            description: 'Optional school ID to filter by',
          },
          months: {
            type: 'number',
            description: 'Number of months of history to include (default: 6)',
          },
        },
        required: ['stat_type'],
      },
    },
    requiredPermission: PERMISSIONS.IT_ANALYTICS_READ,
    execute: executeITStats,
  },

  // ── Search ────────────────────────────────────────────────────────────
  search_platform: {
    definition: {
      name: 'search_platform',
      description:
        'Search across the platform for users, tickets, events, devices, buildings, and rooms by keyword.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query text',
          },
          limit: {
            type: 'number',
            description: 'Max results to return (default: 8)',
          },
        },
        required: ['query'],
      },
    },
    requiredPermission: null,
    execute: executeSearch,
  },

  // ── Upcoming Events ───────────────────────────────────────────────────
  list_upcoming_events: {
    definition: {
      name: 'list_upcoming_events',
      description:
        'List upcoming calendar events for the organization. Returns event title, date, time, location, and status.',
      input_schema: {
        type: 'object' as const,
        properties: {
          days_ahead: {
            type: 'number',
            description: 'Number of days ahead to look (default: 7)',
          },
          limit: {
            type: 'number',
            description: 'Max events to return (default: 10)',
          },
        },
        required: [],
      },
    },
    requiredPermission: PERMISSIONS.EVENTS_READ,
    execute: executeListEvents,
  },

  // ── Campus Info ───────────────────────────────────────────────────────
  get_campus_info: {
    definition: {
      name: 'get_campus_info',
      description:
        'Get information about campus buildings, rooms, and schools in the organization.',
      input_schema: {
        type: 'object' as const,
        properties: {
          info_type: {
            type: 'string',
            enum: ['buildings', 'rooms', 'schools'],
            description: 'What campus info to retrieve',
          },
          building_id: {
            type: 'string',
            description: 'Filter rooms by building ID (optional)',
          },
        },
        required: ['info_type'],
      },
    },
    requiredPermission: null,
    execute: executeCampusInfo,
  },

  // ── Maintenance Ticket Details ────────────────────────────────────────
  get_ticket_details: {
    definition: {
      name: 'get_ticket_details',
      description:
        'Get detailed information about a specific maintenance ticket by its ID or ticket number.',
      input_schema: {
        type: 'object' as const,
        properties: {
          ticket_id: {
            type: 'string',
            description: 'The ticket ID or ticket number',
          },
        },
        required: ['ticket_id'],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_READ_ALL,
    execute: executeGetTicket,
  },

  // ── IT Device Info ────────────────────────────────────────────────────
  get_device_info: {
    definition: {
      name: 'get_device_info',
      description:
        'Get detailed information about an IT device by its asset tag or ID, including repair history.',
      input_schema: {
        type: 'object' as const,
        properties: {
          identifier: {
            type: 'string',
            description: 'The device asset tag or device ID',
          },
        },
        required: ['identifier'],
      },
    },
    requiredPermission: PERMISSIONS.IT_DEVICE_READ,
    execute: executeGetDevice,
  },

  // ── Create Maintenance Ticket (Draft) ─────────────────────────────────
  create_maintenance_ticket: {
    definition: {
      name: 'create_maintenance_ticket',
      description:
        'Draft a new maintenance ticket. Returns a summary for user confirmation before actually creating it. Use this when the user asks to create, submit, or report a maintenance issue.',
      input_schema: {
        type: 'object' as const,
        properties: {
          title: {
            type: 'string',
            description: 'Short title for the ticket',
          },
          description: {
            type: 'string',
            description: 'Detailed description of the issue',
          },
          category: {
            type: 'string',
            enum: [
              'ELECTRICAL',
              'PLUMBING',
              'HVAC',
              'STRUCTURAL',
              'CUSTODIAL_BIOHAZARD',
              'IT_AV',
              'GROUNDS',
              'OTHER',
            ],
            description: 'Maintenance category',
          },
          location: {
            type: 'string',
            description: 'Building or room name where the issue is located',
          },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            description: 'Priority level (default: MEDIUM)',
          },
        },
        required: ['title', 'category'],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_SUBMIT,
    execute: executeCreateTicketDraft,
  },
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get tool definitions filtered by user permissions.
 */
export async function getAvailableTools(
  userId: string
): Promise<Anthropic.Tool[]> {
  const tools: Anthropic.Tool[] = []

  for (const entry of Object.values(TOOL_REGISTRY)) {
    if (!entry.requiredPermission || (await can(userId, entry.requiredPermission))) {
      tools.push(entry.definition)
    }
  }

  return tools
}

/**
 * Execute a tool by name with permission enforcement.
 * Returns a JSON string result (or error message).
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const entry = TOOL_REGISTRY[toolName]
  if (!entry) {
    return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }

  // Permission check
  if (entry.requiredPermission) {
    const allowed = await can(ctx.userId, entry.requiredPermission)
    if (!allowed) {
      return JSON.stringify({
        error: `You don't have permission to use this feature. Required: ${entry.requiredPermission}`,
      })
    }
  }

  try {
    return await entry.execute(input, ctx)
  } catch (error) {
    console.error(`[ai-assistant] Tool "${toolName}" error:`, error)
    return JSON.stringify({
      error: `Failed to execute ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
  }
}

// ─── Tool Execution Handlers ──────────────────────────────────────────────────

async function executeMaintenanceStats(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const statType = input.stat_type as string
  const opts: AnalyticsOptions = {
    campusId: input.campus_id as string | undefined,
    months: (input.months as number) || 6,
  }

  switch (statType) {
    case 'tickets_by_status':
      return JSON.stringify(await getTicketsByStatus(ctx.organizationId, opts))
    case 'resolution_time_by_category':
      return JSON.stringify(await getResolutionTimeByCategory(ctx.organizationId, opts))
    case 'technician_workload':
      return JSON.stringify(await getMaintenanceTechWorkload(ctx.organizationId, opts))
    case 'pm_compliance':
      return JSON.stringify(await getPmComplianceRate(ctx.organizationId, opts))
    case 'category_breakdown':
      return JSON.stringify(await getCategoryBreakdown(ctx.organizationId, opts))
    case 'top_locations':
      return JSON.stringify(await getTopTicketLocations(ctx.organizationId, opts))
    default:
      return JSON.stringify({ error: `Unknown stat type: ${statType}` })
  }
}

async function executeITStats(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const statType = input.stat_type as string
  const opts: ITAnalyticsOptions = {
    schoolId: input.school_id as string | undefined,
    months: (input.months as number) || 6,
  }

  switch (statType) {
    case 'ticket_volume_by_type':
      return JSON.stringify(await getTicketVolumeByType(ctx.organizationId, opts))
    case 'device_health':
      return JSON.stringify(await getDeviceHealthByCampus(ctx.organizationId, opts))
    case 'lemon_devices':
      return JSON.stringify(await getLemonDeviceReport(ctx.organizationId, opts))
    case 'repair_cost_by_model':
      return JSON.stringify(await getRepairCostByModel(ctx.organizationId, opts))
    case 'sla_compliance':
      return JSON.stringify(await getSLACompliance(ctx.organizationId, opts))
    case 'loaner_utilization':
      return JSON.stringify(await getLoanerPoolUtilization(ctx.organizationId, opts))
    default:
      return JSON.stringify({ error: `Unknown stat type: ${statType}` })
  }
}

async function executeSearch(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const query = String(input.query || '').trim()
  const limit = Math.min((input.limit as number) || 8, 20)

  if (!query) return JSON.stringify({ results: [] })

  // Search across multiple entity types
  const [users, tickets, buildings, rooms, events] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ name: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } }] },
      select: { id: true, name: true, email: true },
      take: limit,
    }),
    prisma.maintenanceTicket
      .findMany({
        where: { OR: [{ title: { contains: query, mode: 'insensitive' } }, { description: { contains: query, mode: 'insensitive' } }] },
        select: { id: true, title: true, status: true, category: true, ticketNumber: true },
        take: limit,
      })
      .catch(() => [] as any[]),
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
    prisma.event
      .findMany({
        where: { title: { contains: query, mode: 'insensitive' } },
        select: { id: true, title: true, startsAt: true, status: true },
        take: limit,
      })
      .catch(() => [] as any[]),
  ])

  return JSON.stringify({
    users: users.map((u) => ({ id: u.id, name: u.name, email: u.email })),
    tickets: tickets.map((t: any) => ({ id: t.id, number: t.ticketNumber, title: t.title, status: t.status, category: t.category })),
    buildings: buildings.map((b) => ({ id: b.id, name: b.name })),
    rooms: rooms.map((r) => ({ id: r.id, name: r.displayName || r.roomNumber, number: r.roomNumber })),
    events: events.map((e: any) => ({ id: e.id, title: e.title, date: e.startsAt, status: e.status })),
  })
}

async function executeListEvents(
  input: Record<string, unknown>,
  _ctx: ToolContext
): Promise<string> {
  const daysAhead = Math.min((input.days_ahead as number) || 7, 30)
  const limit = Math.min((input.limit as number) || 10, 25)

  const now = new Date()
  const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

  const events = await prisma.event
    .findMany({
      where: {
        startsAt: { gte: now, lte: until },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        room: true,
        status: true,
      },
      orderBy: { startsAt: 'asc' },
      take: limit,
    })
    .catch(() => [] as any[])

  return JSON.stringify({
    events: events.map((e: any) => ({
      id: e.id,
      title: e.title,
      start: e.startsAt,
      end: e.endsAt,
      location: e.room,
      status: e.status,
    })),
    count: events.length,
    period: `Next ${daysAhead} days`,
  })
}

async function executeCampusInfo(
  input: Record<string, unknown>,
  _ctx: ToolContext
): Promise<string> {
  const infoType = input.info_type as string

  switch (infoType) {
    case 'buildings': {
      const buildings = await prisma.building.findMany({
        select: { id: true, name: true, address: true },
        orderBy: { name: 'asc' },
      })
      return JSON.stringify({ buildings, count: buildings.length })
    }
    case 'rooms': {
      const buildingId = input.building_id as string | undefined
      const rooms = await prisma.room.findMany({
        where: buildingId ? { buildingId } : undefined,
        select: {
          id: true,
          roomNumber: true,
          displayName: true,
          building: { select: { name: true } },
        },
        orderBy: { roomNumber: 'asc' },
        take: 50,
      })
      return JSON.stringify({
        rooms: rooms.map((r) => ({
          id: r.id,
          name: r.displayName || r.roomNumber,
          number: r.roomNumber,
          building: r.building?.name,
        })),
        count: rooms.length,
      })
    }
    case 'schools': {
      const schools = await prisma.school.findMany({
        select: { id: true, name: true, gradeLevel: true },
        orderBy: { name: 'asc' },
      })
      return JSON.stringify({ schools, count: schools.length })
    }
    default:
      return JSON.stringify({ error: `Unknown info type: ${infoType}` })
  }
}

async function executeGetTicket(
  input: Record<string, unknown>,
  _ctx: ToolContext
): Promise<string> {
  const ticketId = String(input.ticket_id || '')

  const ticketSelect = {
    id: true,
    ticketNumber: true,
    title: true,
    description: true,
    status: true,
    category: true,
    priority: true,
    createdAt: true,
    updatedAt: true,
    building: { select: { name: true } },
    room: { select: { roomNumber: true, displayName: true } },
    submittedBy: { select: { name: true, email: true } },
    assignedTo: { select: { name: true, email: true } },
  } as const

  // Try finding by ID first, then by ticket number
  let ticket = await prisma.maintenanceTicket
    .findUnique({
      where: { id: ticketId },
      select: ticketSelect,
    })
    .catch(() => null)

  if (!ticket) {
    // Try by ticket number
    ticket = await prisma.maintenanceTicket
      .findFirst({
        where: { ticketNumber: { equals: ticketId, mode: 'insensitive' } },
        select: ticketSelect,
      })
      .catch(() => null)
  }

  if (!ticket) {
    return JSON.stringify({ error: `Ticket not found: ${ticketId}` })
  }

  return JSON.stringify(ticket)
}

async function executeGetDevice(
  input: Record<string, unknown>,
  _ctx: ToolContext
): Promise<string> {
  const identifier = String(input.identifier || '')

  const deviceSelect = {
    id: true,
    assetTag: true,
    deviceType: true,
    make: true,
    model: true,
    status: true,
    isLemon: true,
    purchaseDate: true,
    repairs: {
      orderBy: { repairDate: 'desc' as const },
      take: 5,
      select: { repairType: true, description: true, repairCost: true, repairDate: true },
    },
  } as const

  // Try by ID first, then by asset tag
  let device = await prisma.iTDevice
    .findUnique({
      where: { id: identifier },
      select: deviceSelect,
    })
    .catch(() => null)

  if (!device) {
    device = await prisma.iTDevice
      .findFirst({
        where: { assetTag: { equals: identifier, mode: 'insensitive' } },
        select: deviceSelect,
      })
      .catch(() => null)
  }

  if (!device) {
    return JSON.stringify({ error: `Device not found: ${identifier}` })
  }

  return JSON.stringify(device)
}

async function executeCreateTicketDraft(
  input: Record<string, unknown>,
  _ctx: ToolContext
): Promise<string> {
  // Don't actually create the ticket — return a summary for user confirmation
  const draft = {
    action: 'create_maintenance_ticket',
    title: String(input.title || ''),
    description: String(input.description || ''),
    category: String(input.category || 'OTHER'),
    location: String(input.location || 'Not specified'),
    priority: String(input.priority || 'MEDIUM'),
  }

  return JSON.stringify({
    confirmationRequired: true,
    message: `I've prepared a maintenance ticket draft. Please confirm to create it:\n• Title: ${draft.title}\n• Category: ${draft.category}\n• Priority: ${draft.priority}\n• Location: ${draft.location}`,
    draft,
  })
}
