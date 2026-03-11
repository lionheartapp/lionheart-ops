/**
 * AI Assistant — Tool Definitions & Execution
 *
 * Defines the tools available to the AI assistant and handles execution.
 * Each tool maps to existing analytics services or Prisma queries.
 * Permission checks are enforced before executing any tool.
 *
 * Tool definitions use Gemini FunctionDeclaration format.
 */

import { prisma, rawPrisma } from '@/lib/db'
import { can } from '@/lib/auth/permissions'
import { checkRoomConflict } from '@/lib/services/eventService'
import { fetchWeatherForecast } from '@/lib/services/weatherService'
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

// ─── Types ───────────────────────────────────────────────────────────────────

/** Gemini-compatible function declaration */
export interface GeminiFunctionDeclaration {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface ToolRegistryEntry {
  definition: GeminiFunctionDeclaration
  requiredPermission: string | null // null = no permission needed
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<string>
}

export interface ToolContext {
  userId: string
  organizationId: string
}

// ─── Tool Registry ────────────────────────────────────────────────────────────

const TOOL_REGISTRY: Record<string, ToolRegistryEntry> = {
  // ── Maintenance Analytics ─────────────────────────────────────────────
  query_maintenance_stats: {
    definition: {
      name: 'query_maintenance_stats',
      description:
        'Query maintenance analytics for the organization. Returns statistics about maintenance tickets, technician workload, PM compliance, costs, and more.',
      parameters: {
        type: 'object',
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
      parameters: {
        type: 'object',
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
      parameters: {
        type: 'object',
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
      parameters: {
        type: 'object',
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
      parameters: {
        type: 'object',
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
      parameters: {
        type: 'object',
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
      parameters: {
        type: 'object',
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
      parameters: {
        type: 'object',
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

  // ── Create Calendar Event (Draft) ──────────────────────────────────
  create_event: {
    definition: {
      name: 'create_event',
      description:
        'Draft a new calendar event. Returns a summary for user confirmation before actually creating it. Use this when the user asks to create, schedule, or add an event.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Event title',
          },
          description: {
            type: 'string',
            description: 'Event description (optional)',
          },
          start_date: {
            type: 'string',
            description: 'Start date and time in ISO format (e.g. "2026-03-15T14:00:00")',
          },
          end_date: {
            type: 'string',
            description: 'End date and time in ISO format (e.g. "2026-03-15T15:00:00")',
          },
          location: {
            type: 'string',
            description: 'Room or location name (optional)',
          },
        },
        required: ['title', 'start_date', 'end_date'],
      },
    },
    requiredPermission: PERMISSIONS.EVENTS_CREATE,
    execute: executeCreateEventDraft,
  },

  // ── Create IT Ticket (Draft) ───────────────────────────────────────
  create_it_ticket: {
    definition: {
      name: 'create_it_ticket',
      description:
        'Draft a new IT support ticket. Returns a summary for user confirmation before creating. Use when the user reports an IT issue or needs tech support.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Short title describing the IT issue',
          },
          description: {
            type: 'string',
            description: 'Detailed description of the issue',
          },
          issue_type: {
            type: 'string',
            enum: ['HARDWARE', 'SOFTWARE', 'NETWORK', 'ACCOUNT_ACCESS', 'DISPLAY_AV', 'PRINTER', 'OTHER'],
            description: 'Type of IT issue',
          },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            description: 'Priority level (default: MEDIUM)',
          },
        },
        required: ['title', 'issue_type'],
      },
    },
    requiredPermission: PERMISSIONS.IT_TICKET_SUBMIT,
    execute: executeCreateITTicketDraft,
  },

  // ── Update Maintenance Ticket Status ───────────────────────────────
  update_maintenance_ticket_status: {
    definition: {
      name: 'update_maintenance_ticket_status',
      description:
        'Update the status of a maintenance ticket (e.g. move to In Progress, mark as Done, cancel). Returns a confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: {
            type: 'string',
            description: 'The ticket ID or ticket number',
          },
          new_status: {
            type: 'string',
            enum: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'ON_HOLD', 'QA', 'DONE', 'CANCELLED'],
            description: 'The new status to set',
          },
          note: {
            type: 'string',
            description: 'Optional note (required for QA completion or cancellation)',
          },
        },
        required: ['ticket_id', 'new_status'],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_UPDATE_ALL,
    execute: executeUpdateMaintenanceStatusDraft,
  },

  // ── Assign Maintenance Ticket ──────────────────────────────────────
  assign_maintenance_ticket: {
    definition: {
      name: 'assign_maintenance_ticket',
      description:
        'Assign a maintenance ticket to a specific user/technician. Search for the user first to get their ID.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: {
            type: 'string',
            description: 'The ticket ID or ticket number',
          },
          assignee_name: {
            type: 'string',
            description: 'Name or email of the person to assign to',
          },
        },
        required: ['ticket_id', 'assignee_name'],
      },
    },
    requiredPermission: PERMISSIONS.MAINTENANCE_ASSIGN,
    execute: executeAssignMaintenanceTicketDraft,
  },

  // ── Room Availability ──────────────────────────────────────────────
  check_room_availability: {
    definition: {
      name: 'check_room_availability',
      description: 'Check if a specific room is available for a date and time range. Returns whether the room is free or shows the conflicting event.',
      parameters: {
        type: 'object',
        properties: {
          room_name: { type: 'string', description: 'Room name or number to check (e.g. "Gym", "Room 101")' },
          start_datetime: { type: 'string', description: 'Start date/time in ISO format (e.g. "2026-04-15T18:00:00")' },
          end_datetime: { type: 'string', description: 'End date/time in ISO format (e.g. "2026-04-15T21:00:00")' },
        },
        required: ['room_name', 'start_datetime', 'end_datetime'],
      },
    },
    requiredPermission: null, // Room availability is public info within the org
    execute: executeCheckRoomAvailability,
  },

  // ── Find Available Rooms ───────────────────────────────────────────
  find_available_rooms: {
    definition: {
      name: 'find_available_rooms',
      description: 'Find rooms matching criteria like capacity or campus. Lists rooms without checking time-slot availability.',
      parameters: {
        type: 'object',
        properties: {
          min_capacity: { type: 'number', description: 'Minimum room capacity needed (optional)' },
          building_name: { type: 'string', description: 'Filter by building name (optional)' },
          limit: { type: 'number', description: 'Max results to return (default: 10)' },
        },
        required: [],
      },
    },
    requiredPermission: null,
    execute: executeFindAvailableRooms,
  },

  // ── Resource / Inventory Availability ─────────────────────────────
  check_resource_availability: {
    definition: {
      name: 'check_resource_availability',
      description: 'Check if an inventory item is available and its current stock level. Returns quantity available and low-stock warning if applicable.',
      parameters: {
        type: 'object',
        properties: {
          item_name: { type: 'string', description: 'Name or partial name of the inventory item to check (e.g. "chairs", "tables", "projector")' },
        },
        required: ['item_name'],
      },
    },
    requiredPermission: null,
    execute: executeCheckResourceAvailability,
  },

  // ── Weather Forecast ───────────────────────────────────────────────
  get_weather_forecast: {
    definition: {
      name: 'get_weather_forecast',
      description: 'Get weather forecast for a specific date. Uses the organization\'s location. Returns temperature, conditions, and precipitation chance.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Target date in YYYY-MM-DD format (e.g. "2026-03-20"). Must be within 16 days from today.' },
        },
        required: ['date'],
      },
    },
    requiredPermission: null,
    execute: executeGetWeatherForecast,
  },
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get tool definitions filtered by user permissions.
 */
export async function getAvailableTools(
  userId: string
): Promise<GeminiFunctionDeclaration[]> {
  const tools: GeminiFunctionDeclaration[] = []

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

async function executeCreateEventDraft(
  input: Record<string, unknown>,
  _ctx: ToolContext
): Promise<string> {
  const draft = {
    action: 'create_event',
    title: String(input.title || ''),
    description: String(input.description || ''),
    startsAt: String(input.start_date || ''),
    endsAt: String(input.end_date || ''),
    room: String(input.location || ''),
  }

  const startDisplay = draft.startsAt ? new Date(draft.startsAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set'
  const endDisplay = draft.endsAt ? new Date(draft.endsAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set'

  return JSON.stringify({
    confirmationRequired: true,
    message: `I've prepared an event draft. Please confirm to create it:\n• Title: ${draft.title}\n• Start: ${startDisplay}\n• End: ${endDisplay}${draft.room ? `\n• Location: ${draft.room}` : ''}${draft.description ? `\n• Description: ${draft.description}` : ''}`,
    draft,
  })
}

async function executeCreateITTicketDraft(
  input: Record<string, unknown>,
  _ctx: ToolContext
): Promise<string> {
  const draft = {
    action: 'create_it_ticket',
    title: String(input.title || ''),
    description: String(input.description || ''),
    issueType: String(input.issue_type || 'OTHER'),
    priority: String(input.priority || 'MEDIUM'),
  }

  return JSON.stringify({
    confirmationRequired: true,
    message: `I've prepared an IT ticket draft. Please confirm to create it:\n• Title: ${draft.title}\n• Issue Type: ${draft.issueType}\n• Priority: ${draft.priority}${draft.description ? `\n• Description: ${draft.description}` : ''}`,
    draft,
  })
}

async function executeUpdateMaintenanceStatusDraft(
  input: Record<string, unknown>,
  _ctx: ToolContext
): Promise<string> {
  const ticketId = String(input.ticket_id || '')
  const newStatus = String(input.new_status || '')
  const note = String(input.note || '')

  // Look up the ticket to show current status
  let ticketInfo = ''
  try {
    const ticket = await prisma.maintenanceTicket
      .findFirst({
        where: { OR: [{ id: ticketId }, { ticketNumber: { equals: ticketId, mode: 'insensitive' } }] },
        select: { id: true, ticketNumber: true, title: true, status: true },
      })
      .catch(() => null)
    if (ticket) {
      ticketInfo = `\n• Ticket: ${ticket.ticketNumber} — ${ticket.title}\n• Current Status: ${ticket.status}`
    }
  } catch { /* non-critical */ }

  const draft = {
    action: 'update_maintenance_ticket_status',
    ticketId,
    newStatus,
    note,
  }

  return JSON.stringify({
    confirmationRequired: true,
    message: `I'll update this maintenance ticket's status. Please confirm:${ticketInfo}\n• New Status: ${newStatus}${note ? `\n• Note: ${note}` : ''}`,
    draft,
  })
}

async function executeAssignMaintenanceTicketDraft(
  input: Record<string, unknown>,
  _ctx: ToolContext
): Promise<string> {
  const ticketId = String(input.ticket_id || '')
  const assigneeName = String(input.assignee_name || '')

  // Look up assignee by name
  let assigneeId: string | null = null
  let assigneeDisplay = assigneeName
  try {
    const user = await prisma.user.findFirst({
      where: { OR: [{ name: { contains: assigneeName, mode: 'insensitive' } }, { email: { contains: assigneeName, mode: 'insensitive' } }] },
      select: { id: true, name: true, email: true },
    })
    if (user) {
      assigneeId = user.id
      assigneeDisplay = `${user.name} (${user.email})`
    }
  } catch { /* non-critical */ }

  if (!assigneeId) {
    return JSON.stringify({ error: `Could not find a user matching "${assigneeName}". Try searching for them first.` })
  }

  const draft = {
    action: 'assign_maintenance_ticket',
    ticketId,
    assigneeId,
    assigneeName: assigneeDisplay,
  }

  return JSON.stringify({
    confirmationRequired: true,
    message: `I'll assign this ticket. Please confirm:\n• Ticket: ${ticketId}\n• Assign to: ${assigneeDisplay}`,
    draft,
  })
}

async function executeCheckRoomAvailability(
  input: Record<string, unknown>,
  _ctx: ToolContext
): Promise<string> {
  const roomName = String(input.room_name || '')
  const startStr = String(input.start_datetime || '')
  const endStr = String(input.end_datetime || '')

  if (!roomName || !startStr || !endStr) {
    return JSON.stringify({ error: 'Room name, start time, and end time are all required.' })
  }

  try {
    await checkRoomConflict(roomName, new Date(startStr), new Date(endStr))
    return JSON.stringify({
      available: true,
      room: roomName,
      start: startStr,
      end: endStr,
      message: `${roomName} is available for that time.`,
    })
  } catch (err: any) {
    if (err.code === 'ROOM_CONFLICT') {
      return JSON.stringify({
        available: false,
        room: roomName,
        conflict: err.message,
        message: `${roomName} is not available -- ${err.message}`,
      })
    }
    return JSON.stringify({ error: `Failed to check room availability: ${err.message}` })
  }
}

async function executeFindAvailableRooms(
  input: Record<string, unknown>,
  _ctx: ToolContext
): Promise<string> {
  const minCapacity = input.min_capacity as number | undefined
  const buildingName = input.building_name as string | undefined
  const limit = Math.min((input.limit as number) || 10, 25)

  const where: Record<string, unknown> = {}
  // Note: Room model does not have a capacity field -- filter ignored if provided
  if (buildingName) {
    where.building = { name: { contains: buildingName, mode: 'insensitive' } }
  }

  const rooms = await prisma.room.findMany({
    where,
    select: {
      id: true,
      roomNumber: true,
      displayName: true,
      building: { select: { name: true } },
    },
    orderBy: { roomNumber: 'asc' },
    take: limit,
  })

  return JSON.stringify({
    rooms: rooms.map(r => ({
      name: r.displayName || r.roomNumber,
      number: r.roomNumber,
      building: r.building?.name,
    })),
    count: rooms.length,
  })
}

async function executeCheckResourceAvailability(
  input: Record<string, unknown>,
  _ctx: ToolContext
): Promise<string> {
  const itemName = String(input.item_name || '').trim()
  if (!itemName) {
    return JSON.stringify({ error: 'Item name is required.' })
  }

  const items = await prisma.inventoryItem.findMany({
    where: { name: { contains: itemName, mode: 'insensitive' } },
    select: { id: true, name: true, quantityOnHand: true, reorderThreshold: true, category: true },
    take: 5,
  })

  if (items.length === 0) {
    return JSON.stringify({ found: false, message: `No inventory items matching "${itemName}" found.` })
  }

  return JSON.stringify({
    found: true,
    items: items.map(item => ({
      name: item.name,
      category: item.category,
      available: item.quantityOnHand,
      reorderThreshold: item.reorderThreshold,
      lowStock: item.quantityOnHand <= item.reorderThreshold,
    })),
    count: items.length,
  })
}

async function executeGetWeatherForecast(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const targetDate = String(input.date || '')

  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return JSON.stringify({ error: 'Please provide a date in YYYY-MM-DD format (e.g. "2026-03-20").' })
  }

  // Look up org coordinates -- uses rawPrisma because Organization is not org-scoped
  const org = await rawPrisma.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { latitude: true, longitude: true, name: true },
  })

  if (!org?.latitude || !org?.longitude) {
    return JSON.stringify({
      error: `Location data is not configured for ${org?.name || 'your organization'}. An admin can set the organization coordinates in Settings to enable weather forecasts.`,
    })
  }

  const forecast = await fetchWeatherForecast(org.latitude, org.longitude, targetDate)

  if (!forecast) {
    return JSON.stringify({
      error: `Could not fetch weather data for ${targetDate}. The date may be more than 16 days in the future, or the weather service may be temporarily unavailable.`,
    })
  }

  return JSON.stringify({
    date: forecast.date,
    location: org.name,
    high: `${forecast.tempMax}F`,
    low: `${forecast.tempMin}F`,
    condition: forecast.condition,
    precipitationChance: `${forecast.precipitationChance}%`,
    message: `${forecast.condition} on ${forecast.date} -- High ${forecast.tempMax}F, Low ${forecast.tempMin}F, ${forecast.precipitationChance}% chance of precipitation.`,
  })
}
