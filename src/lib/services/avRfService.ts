import { z } from 'zod'
import { prisma } from '@/lib/db'
import { runWithOrgContext } from '@/lib/org-context'
import { canAny, getUserTeamDetails } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { stripAllHtml } from '@/lib/sanitize'

const DEFAULT_MIN_SPACING_HZ = 250_000
const DEFAULT_INTERMOD_TOLERANCE_HZ = 25_000
const DEFAULT_STEP_HZ = 25_000
const DEFAULT_SCAN_THRESHOLD_DBM = -85
const MAX_SCAN_POINTS_TO_STORE = 10_000

const AV_PERMISSIONS = [
  PERMISSIONS.AV_READ,
  PERMISSIONS.AV_MANAGE,
  PERMISSIONS.AV_COORDINATE,
  PERMISSIONS.AV_SCAN_UPLOAD,
  PERMISSIONS.AV_BRIDGE_MANAGE,
  PERMISSIONS.EVENT_PROJECT_APPROVE,
]

export const DeviceBrandSchema = z.enum([
  'SHURE',
  'SENNHEISER',
  'AUDIO_TECHNICA',
  'WISYCOM',
  'LECTROSONICS',
  'RF_EXPLORER',
  'OTHER',
])

export const DeviceKindSchema = z.enum([
  'HANDHELD',
  'LAVALIER',
  'HEADSET',
  'BODY_PACK',
  'IEM',
  'RECEIVER',
  'ANTENNA',
  'SCANNER',
  'OTHER',
])

const hzField = z.coerce.number().int().positive()

export const CreateWirelessDeviceProfileSchema = z.object({
  brand: DeviceBrandSchema.default('OTHER'),
  model: z.string().min(1).max(120).transform(stripAllHtml),
  bandLabel: z.string().max(80).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
  minFrequencyHz: hzField,
  maxFrequencyHz: hzField,
  minSpacingHz: z.coerce.number().int().min(25_000).default(DEFAULT_MIN_SPACING_HZ),
  intermodSpacingHz: z.coerce.number().int().min(1_000).default(DEFAULT_INTERMOD_TOLERANCE_HZ),
  channelStepHz: z.coerce.number().int().min(1_000).default(DEFAULT_STEP_HZ),
  maxRecommendedUnits: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().max(1000).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
})

export const CreateWirelessDeviceSchema = z.object({
  profileId: z.string().optional().nullable(),
  inventoryItemId: z.string().optional().nullable(),
  name: z.string().min(1).max(160).transform(stripAllHtml),
  brand: DeviceBrandSchema.default('OTHER'),
  model: z.string().max(120).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
  kind: DeviceKindSchema.default('OTHER'),
  serialNumber: z.string().max(120).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
  bandLabel: z.string().max(80).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
  minFrequencyHz: hzField.optional().nullable(),
  maxFrequencyHz: hzField.optional().nullable(),
  currentFrequencyHz: hzField.optional().nullable(),
  batteryType: z.string().max(80).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
  capsuleType: z.string().max(80).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
  notes: z.string().max(1000).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
})

export const CreateFrequencyPlanSchema = z.object({
  eventProjectId: z.string().optional().nullable(),
  calendarEventId: z.string().optional().nullable(),
  title: z.string().min(1).max(180).transform(stripAllHtml),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  campusId: z.string().optional().nullable(),
  buildingId: z.string().optional().nullable(),
  spaceId: z.string().optional().nullable(),
  roomId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
})

export const CreateAssignmentSchema = z.object({
  deviceId: z.string().optional().nullable(),
  label: z.string().min(1).max(120).transform(stripAllHtml),
  use: z.string().max(120).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
  assignedTo: z.string().max(120).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
  frequencyHz: hzField.optional().nullable(),
  isLocked: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  notes: z.string().max(1000).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
})

export const UpdateAssignmentSchema = CreateAssignmentSchema.partial()

export const UploadScanSchema = z.object({
  planId: z.string().optional().nullable(),
  venueProfileId: z.string().optional().nullable(),
  name: z.string().min(1).max(160).transform(stripAllHtml),
  fileName: z.string().max(180).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
  content: z.string().min(1),
  thresholdDbm: z.coerce.number().min(-140).max(20).default(DEFAULT_SCAN_THRESHOLD_DBM),
  capturedAt: z.string().datetime().optional().nullable(),
})

export const CreateVenueProfileSchema = z.object({
  name: z.string().min(1).max(160).transform(stripAllHtml),
  campusId: z.string().optional().nullable(),
  buildingId: z.string().optional().nullable(),
  spaceId: z.string().optional().nullable(),
  roomId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
  exclusions: z.array(z.object({
    label: z.string().min(1).max(120).transform(stripAllHtml),
    reason: z.string().max(300).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
    startHz: hzField,
    endHz: hzField,
    severity: z.enum(['BLOCKER', 'WARNING', 'ADVISORY']).default('WARNING'),
  })).default([]),
})

export const CreateBridgeNodeSchema = z.object({
  name: z.string().min(1).max(160).transform(stripAllHtml),
  supportedBrands: z.array(z.string().max(80).transform(stripAllHtml)).default([]),
  version: z.string().max(80).optional().nullable().transform((v) => (v ? stripAllHtml(v) : v)),
})

type ScanPoint = { frequencyHz: number; signalDbm: number }
type AssignmentForCoordination = {
  id: string
  label: string
  frequencyHz: number | null
  isLocked: boolean
  device?: {
    minFrequencyHz?: number | null
    maxFrequencyHz?: number | null
    profile?: {
      minFrequencyHz: number
      maxFrequencyHz: number
      minSpacingHz: number
      intermodSpacingHz: number
      channelStepHz: number
    } | null
  } | null
}
type ExclusionForCoordination = { label: string; startHz: number; endHz: number; severity: 'BLOCKER' | 'WARNING' | 'ADVISORY'; reason?: string | null }

export async function assertCanUseAV(userId: string, required?: string) {
  const [hasPermission, teams] = await Promise.all([
    canAny(userId, required ? [required, PERMISSIONS.AV_MANAGE, PERMISSIONS.ALL] : AV_PERMISSIONS),
    getUserTeamDetails(userId),
  ])
  if (hasPermission || teams.some((team) => team.slug === 'av-production')) return
  throw new Error('Insufficient permissions')
}

export function mhzToHz(value: string | number): number {
  const numeric = typeof value === 'number' ? value : Number(value.trim())
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error('Invalid frequency')
  }
  return Math.round(numeric * 1_000_000)
}

export function hzToMhz(hz: number | bigint | null | undefined): string {
  if (hz === null || hz === undefined) return ''
  return (Number(hz) / 1_000_000).toFixed(3)
}

function toNumber(value: number | bigint | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

function serialize(value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value)
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(serialize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, serialize(val)]))
  }
  return value
}

function normalizeBrand(value?: string | null) {
  const brand = (value || '').toLowerCase()
  if (brand.includes('shure')) return 'SHURE'
  if (brand.includes('sennheiser')) return 'SENNHEISER'
  if (brand.includes('audio') || brand.includes('technica')) return 'AUDIO_TECHNICA'
  if (brand.includes('wisycom')) return 'WISYCOM'
  if (brand.includes('lectro')) return 'LECTROSONICS'
  if (brand.includes('rf explorer')) return 'RF_EXPLORER'
  return 'OTHER'
}

function inferKind(item?: { name?: string | null; model?: string | null; tags?: string[] | null } | null) {
  const text = `${item?.name || ''} ${item?.model || ''} ${(item?.tags || []).join(' ')}`.toLowerCase()
  if (text.includes('iem') || text.includes('in-ear')) return 'IEM'
  if (text.includes('receiver')) return 'RECEIVER'
  if (text.includes('body') || text.includes('pack')) return 'BODY_PACK'
  if (text.includes('lav')) return 'LAVALIER'
  if (text.includes('headset')) return 'HEADSET'
  if (text.includes('scanner') || text.includes('rf explorer')) return 'SCANNER'
  if (text.includes('antenna')) return 'ANTENNA'
  if (text.includes('mic') || text.includes('handheld')) return 'HANDHELD'
  return 'OTHER'
}

function rowError(row: number, message: string) {
  return { row, message }
}

export function parseScanContent(content: string): { points: ScanPoint[]; errors: Array<{ row: number; message: string }> } {
  const points: ScanPoint[] = []
  const errors: Array<{ row: number; message: string }> = []
  const rows = content.replace(/\r/g, '').split('\n')

  rows.forEach((raw, index) => {
    const row = index + 1
    const line = raw.trim()
    if (!line) return
    const columns = line.split(/[,\t;]/).map((v) => v.trim()).filter(Boolean)
    if (columns.length < 2) {
      errors.push(rowError(row, 'Expected frequency and signal strength.'))
      return
    }
    const frequencyValue = Number(columns[0])
    const signalDbm = Number(columns[1])
    if (!Number.isFinite(frequencyValue) || !Number.isFinite(signalDbm)) {
      errors.push(rowError(row, 'Frequency and signal strength must be numbers. Remove headers before uploading.'))
      return
    }
    const frequencyHz = frequencyValue > 10_000_000 ? Math.round(frequencyValue) : mhzToHz(frequencyValue)
    points.push({ frequencyHz, signalDbm })
  })

  if (points.length > MAX_SCAN_POINTS_TO_STORE) {
    errors.push(rowError(MAX_SCAN_POINTS_TO_STORE + 1, `Scan has too many rows. Keep it under ${MAX_SCAN_POINTS_TO_STORE.toLocaleString()} points.`))
  }

  return { points, errors }
}

function assignmentRange(assignment: AssignmentForCoordination) {
  const profile = assignment.device?.profile
  const minFrequencyHz = toNumber(profile?.minFrequencyHz) ?? toNumber(assignment.device?.minFrequencyHz) ?? 470_000_000
  const maxFrequencyHz = toNumber(profile?.maxFrequencyHz) ?? toNumber(assignment.device?.maxFrequencyHz) ?? 608_000_000
  return {
    minFrequencyHz,
    maxFrequencyHz,
    minSpacingHz: profile?.minSpacingHz ?? DEFAULT_MIN_SPACING_HZ,
    intermodSpacingHz: profile?.intermodSpacingHz ?? DEFAULT_INTERMOD_TOLERANCE_HZ,
    channelStepHz: profile?.channelStepHz ?? DEFAULT_STEP_HZ,
    lowConfidence: !profile,
  }
}

function inAnyExclusion(frequencyHz: number, exclusions: ExclusionForCoordination[]) {
  return exclusions.find((range) => frequencyHz >= range.startHz && frequencyHz <= range.endHz)
}

function spacingSeverity(distance: number, required: number) {
  if (distance === 0) return 'BLOCKER' as const
  return distance < required / 2 ? 'BLOCKER' as const : 'WARNING' as const
}

function intermodProducts(a: number, b: number) {
  return [
    { order: 3, value: Math.abs((2 * a) - b), formula: '2A - B' },
    { order: 3, value: Math.abs((2 * b) - a), formula: '2B - A' },
    { order: 5, value: Math.abs((3 * a) - (2 * b)), formula: '3A - 2B' },
    { order: 5, value: Math.abs((3 * b) - (2 * a)), formula: '3B - 2A' },
  ]
}

export function analyzeFrequencyPlan(assignments: AssignmentForCoordination[], exclusions: ExclusionForCoordination[]) {
  const conflicts: Array<{
    assignmentAId?: string
    assignmentBId?: string
    type: 'SAME_FREQUENCY' | 'MIN_SPACING' | 'INTERMOD_3RD' | 'INTERMOD_5TH' | 'EXCLUSION' | 'UNKNOWN_PROFILE'
    severity: 'BLOCKER' | 'WARNING' | 'ADVISORY'
    frequencyHz?: number
    detail: string
  }> = []

  const active = assignments.filter((a) => a.frequencyHz)

  for (const assignment of active) {
    const frequencyHz = assignment.frequencyHz!
    const range = assignmentRange(assignment)
    const exclusion = inAnyExclusion(frequencyHz, exclusions)
    if (exclusion) {
      conflicts.push({
        assignmentAId: assignment.id,
        type: 'EXCLUSION',
        severity: exclusion.severity,
        frequencyHz,
        detail: `${assignment.label} sits inside ${exclusion.label}. ${exclusion.reason ?? 'Avoid this range.'}`,
      })
    }
    if (range.lowConfidence) {
      conflicts.push({
        assignmentAId: assignment.id,
        type: 'UNKNOWN_PROFILE',
        severity: 'ADVISORY',
        frequencyHz,
        detail: `${assignment.label} has no device profile, so Lionheart used conservative RF assumptions.`,
      })
    }
  }

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]
      const b = active[j]
      const aHz = a.frequencyHz!
      const bHz = b.frequencyHz!
      const distance = Math.abs(aHz - bHz)
      const required = Math.max(assignmentRange(a).minSpacingHz, assignmentRange(b).minSpacingHz)

      if (distance === 0) {
        conflicts.push({
          assignmentAId: a.id,
          assignmentBId: b.id,
          type: 'SAME_FREQUENCY',
          severity: 'BLOCKER',
          frequencyHz: aHz,
          detail: `${a.label} and ${b.label} are both tuned to ${hzToMhz(aHz)} MHz.`,
        })
      } else if (distance < required) {
        conflicts.push({
          assignmentAId: a.id,
          assignmentBId: b.id,
          type: 'MIN_SPACING',
          severity: spacingSeverity(distance, required),
          frequencyHz: aHz,
          detail: `${a.label} and ${b.label} are only ${hzToMhz(distance)} MHz apart. Keep at least ${hzToMhz(required)} MHz between them.`,
        })
      }

      const tolerance = Math.max(assignmentRange(a).intermodSpacingHz, assignmentRange(b).intermodSpacingHz)
      for (const product of intermodProducts(aHz, bHz)) {
        const hit = active.find((candidate) => candidate.id !== a.id && candidate.id !== b.id && Math.abs(candidate.frequencyHz! - product.value) <= tolerance)
        if (hit) {
          conflicts.push({
            assignmentAId: hit.id,
            assignmentBId: a.id,
            type: product.order === 3 ? 'INTERMOD_3RD' : 'INTERMOD_5TH',
            severity: product.order === 3 ? 'BLOCKER' : 'WARNING',
            frequencyHz: product.value,
            detail: `${product.order}rd-order product ${product.formula} from ${a.label} and ${b.label} lands near ${hit.label}.`,
          })
        }
      }
    }
  }

  const riskScore = Math.min(100, conflicts.reduce((score, conflict) => {
    if (conflict.severity === 'BLOCKER') return score + 30
    if (conflict.severity === 'WARNING') return score + 15
    return score + 5
  }, 0))
  const riskLevel = riskScore >= 70 ? 'HIGH' : riskScore >= 30 ? 'MEDIUM' : 'LOW'

  return { conflicts, riskScore, riskLevel }
}

function candidateFrequencies(assignment: AssignmentForCoordination) {
  const range = assignmentRange(assignment)
  const candidates: number[] = []
  const limit = 300
  for (let hz = range.minFrequencyHz; hz <= range.maxFrequencyHz && candidates.length < limit; hz += range.channelStepHz) {
    candidates.push(hz)
  }
  return candidates
}

export function recommendFrequencies(assignments: AssignmentForCoordination[], exclusions: ExclusionForCoordination[]) {
  const existing = assignments.filter((a) => a.frequencyHz).map((a) => a.frequencyHz!)
  const recommendations: Array<{ assignmentId: string; frequencyHz: number; confidence: number; reason: string }> = []

  for (const assignment of assignments) {
    if (assignment.isLocked || assignment.frequencyHz) continue
    const range = assignmentRange(assignment)
    const candidate = candidateFrequencies(assignment).find((hz) => {
      if (inAnyExclusion(hz, exclusions)) return false
      if (existing.some((used) => Math.abs(used - hz) < range.minSpacingHz)) return false
      return true
    })
    if (!candidate) continue
    existing.push(candidate)
    recommendations.push({
      assignmentId: assignment.id,
      frequencyHz: candidate,
      confidence: range.lowConfidence ? 58 : 82,
      reason: range.lowConfidence
        ? `Suggested ${hzToMhz(candidate)} MHz using conservative defaults because this device has no profile.`
        : `Suggested ${hzToMhz(candidate)} MHz inside the device band with spacing and exclusions respected.`,
    })
  }

  return recommendations
}

async function collectExclusions(planId: string): Promise<ExclusionForCoordination[]> {
  const plan = await (prisma.wirelessFrequencyPlan as any).findFirst({
    where: { id: planId },
    include: { scans: { include: { exclusions: true } }, room: true, space: true, building: true },
  })
  if (!plan) throw new Error('Frequency plan not found')

  const venueProfiles = await (prisma.rfVenueProfile as any).findMany({
    where: {
      OR: [
        plan.roomId ? { roomId: plan.roomId } : undefined,
        plan.spaceId ? { spaceId: plan.spaceId } : undefined,
        plan.buildingId ? { buildingId: plan.buildingId } : undefined,
      ].filter(Boolean),
    },
    include: { exclusions: true },
  })

  return [
    ...plan.scans.flatMap((scan: any) => scan.exclusions),
    ...venueProfiles.flatMap((profile: any) => profile.exclusions),
  ].map((range: any) => ({
    label: range.label,
    reason: range.reason,
    startHz: Number(range.startHz),
    endHz: Number(range.endHz),
    severity: range.severity,
  }))
}

async function getAssignmentsForCoordination(planId: string): Promise<AssignmentForCoordination[]> {
  const assignments = await (prisma.wirelessFrequencyAssignment as any).findMany({
    where: { planId },
    include: { device: { include: { profile: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return assignments.map((assignment: any) => ({
    id: assignment.id,
    label: assignment.label,
    frequencyHz: toNumber(assignment.frequencyHz),
    isLocked: assignment.isLocked,
    device: assignment.device ? {
      minFrequencyHz: toNumber(assignment.device.minFrequencyHz),
      maxFrequencyHz: toNumber(assignment.device.maxFrequencyHz),
      profile: assignment.device.profile ? {
        minFrequencyHz: Number(assignment.device.profile.minFrequencyHz),
        maxFrequencyHz: Number(assignment.device.profile.maxFrequencyHz),
        minSpacingHz: assignment.device.profile.minSpacingHz,
        intermodSpacingHz: assignment.device.profile.intermodSpacingHz,
        channelStepHz: assignment.device.profile.channelStepHz,
      } : null,
    } : null,
  }))
}

export async function getAvDashboard(orgId: string) {
  return runWithOrgContext(orgId, async () => {
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 36 * 60 * 60 * 1000)
    const [plans, devices, scans, bridges, avEvents] = await Promise.all([
      (prisma.wirelessFrequencyPlan as any).findMany({
        where: { OR: [{ startsAt: { gte: now, lte: tomorrow } }, { status: { in: ['DRAFT', 'NEEDS_REVIEW'] } }] },
        include: { assignments: true, conflicts: true },
        orderBy: [{ startsAt: 'asc' }, { updatedAt: 'desc' }],
        take: 8,
      }),
      (prisma.wirelessDevice as any).count(),
      (prisma.rfScan as any).findFirst({ orderBy: { createdAt: 'desc' } }),
      (prisma.rfBridgeNode as any).findMany({ orderBy: { updatedAt: 'desc' }, take: 4 }),
      (prisma.eventProject as any).findMany({
        where: { requiresAV: true, startsAt: { gte: now, lte: tomorrow } },
        orderBy: { startsAt: 'asc' },
        take: 6,
      }),
    ])

    return serialize({
      plans,
      deviceCount: devices,
      latestScan: scans,
      bridges,
      avEvents,
      unresolvedConflicts: plans.reduce((count: number, plan: any) => count + plan.conflicts.length, 0),
    })
  })
}

export async function listWirelessDevices(orgId: string) {
  return runWithOrgContext(orgId, async () => {
    const devices = await (prisma.wirelessDevice as any).findMany({
      include: { profile: true, inventoryItem: { select: { id: true, name: true, category: true, manufacturer: true, model: true } } },
      orderBy: { name: 'asc' },
    })
    const linkedInventoryIds = new Set(devices.map((device: any) => device.inventoryItemId).filter(Boolean))
    const candidates = await (prisma.inventoryItem as any).findMany({
      where: {
        OR: [
          { category: 'AV Equipment' },
          { name: { contains: 'wireless', mode: 'insensitive' } },
          { name: { contains: 'microphone', mode: 'insensitive' } },
          { name: { contains: 'mic', mode: 'insensitive' } },
          { name: { contains: 'receiver', mode: 'insensitive' } },
          { name: { contains: 'bodypack', mode: 'insensitive' } },
          { name: { contains: 'IEM', mode: 'insensitive' } },
          { manufacturer: { contains: 'Shure', mode: 'insensitive' } },
          { manufacturer: { contains: 'Sennheiser', mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      take: 100,
    })
    const discoverable = candidates
      .filter((item: any) => !linkedInventoryIds.has(item.id))
      .map((item: any) => ({
        id: `inventory:${item.id}`,
        inventoryItemId: item.id,
        name: item.name,
        brand: normalizeBrand(item.manufacturer),
        model: item.model,
        kind: inferKind(item),
        currentFrequencyHz: null,
        status: 'DISCOVERABLE',
        isDiscoverable: true,
        inventoryItem: {
          id: item.id,
          name: item.name,
          category: item.category,
          manufacturer: item.manufacturer,
          model: item.model,
        },
      }))

    return serialize([...devices, ...discoverable])
  })
}

export async function createWirelessDevice(orgId: string, userId: string, input: z.input<typeof CreateWirelessDeviceSchema>) {
  const data = CreateWirelessDeviceSchema.parse(input)
  return runWithOrgContext(orgId, async () => {
    const inventoryItem = data.inventoryItemId
      ? await (prisma.inventoryItem as any).findFirst({ where: { id: data.inventoryItemId } })
      : null
    const existing = data.inventoryItemId
      ? await (prisma.wirelessDevice as any).findFirst({ where: { inventoryItemId: data.inventoryItemId } })
      : null
    const payload = {
      ...data,
      name: data.name || inventoryItem?.name,
      brand: data.brand || normalizeBrand(inventoryItem?.manufacturer),
      model: data.model ?? inventoryItem?.model ?? null,
      kind: data.kind || inferKind(inventoryItem),
      minFrequencyHz: data.minFrequencyHz ? BigInt(data.minFrequencyHz) : undefined,
      maxFrequencyHz: data.maxFrequencyHz ? BigInt(data.maxFrequencyHz) : undefined,
      currentFrequencyHz: data.currentFrequencyHz ? BigInt(data.currentFrequencyHz) : undefined,
      createdById: userId,
    }
    const device = existing
      ? await (prisma.wirelessDevice as any).update({ where: { id: existing.id }, data: payload })
      : await (prisma.wirelessDevice as any).create({ data: payload })
    return serialize(device)
  })
}

export async function listFrequencyPlans(orgId: string) {
  return runWithOrgContext(orgId, async () => serialize(await (prisma.wirelessFrequencyPlan as any).findMany({
    include: {
      assignments: { include: { device: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      conflicts: true,
      recommendations: true,
      eventProject: { select: { id: true, title: true, locationText: true, startsAt: true, endsAt: true } },
      calendarEvent: { select: { id: true, title: true, locationText: true, startTime: true, endTime: true } },
    },
    orderBy: [{ startsAt: 'asc' }, { updatedAt: 'desc' }],
  })))
}

export async function createFrequencyPlan(orgId: string, userId: string, input: z.input<typeof CreateFrequencyPlanSchema>) {
  const data = CreateFrequencyPlanSchema.parse(input)
  return runWithOrgContext(orgId, async () => serialize(await (prisma.wirelessFrequencyPlan as any).create({
    data: {
      ...data,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      createdById: userId,
    },
  })))
}

export async function getFrequencyPlan(orgId: string, planId: string) {
  return runWithOrgContext(orgId, async () => {
    const plan = await (prisma.wirelessFrequencyPlan as any).findFirst({
      where: { id: planId },
      include: {
        assignments: { include: { device: { include: { profile: true } } }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
        conflicts: true,
        recommendations: true,
        scans: { orderBy: { createdAt: 'desc' } },
        eventProject: { select: { id: true, title: true, locationText: true, startsAt: true, endsAt: true } },
        calendarEvent: { select: { id: true, title: true, locationText: true, startTime: true, endTime: true } },
      },
    })
    if (!plan) throw new Error('Frequency plan not found')
    return serialize(plan)
  })
}

export async function createAssignment(orgId: string, planId: string, input: z.input<typeof CreateAssignmentSchema>) {
  const data = CreateAssignmentSchema.parse(input)
  return runWithOrgContext(orgId, async () => serialize(await (prisma.wirelessFrequencyAssignment as any).create({
    data: {
      ...data,
      planId,
      frequencyHz: data.frequencyHz ? BigInt(data.frequencyHz) : null,
      organizationId: orgId,
    },
  })))
}

export async function updateAssignment(orgId: string, assignmentId: string, input: z.input<typeof UpdateAssignmentSchema>) {
  const data = UpdateAssignmentSchema.parse(input)
  return runWithOrgContext(orgId, async () => serialize(await (prisma.wirelessFrequencyAssignment as any).update({
    where: { id: assignmentId },
    data: {
      ...data,
      frequencyHz: data.frequencyHz === undefined ? undefined : data.frequencyHz ? BigInt(data.frequencyHz) : null,
    },
  })))
}

export async function coordinateFrequencyPlan(orgId: string, planId: string) {
  return runWithOrgContext(orgId, async () => {
    const assignments = await getAssignmentsForCoordination(planId)
    const exclusions = await collectExclusions(planId)
    const analysis = analyzeFrequencyPlan(assignments, exclusions)
    const recommendations = recommendFrequencies(assignments, exclusions)

    await (prisma.rfPlanConflict as any).deleteMany({ where: { planId } })
    await (prisma.rfRecommendation as any).deleteMany({ where: { planId, status: 'PENDING' } })

    for (const conflict of analysis.conflicts) {
      await (prisma.rfPlanConflict as any).create({
        data: {
          organizationId: orgId,
          planId,
          assignmentAId: conflict.assignmentAId,
          assignmentBId: conflict.assignmentBId,
          type: conflict.type,
          severity: conflict.severity,
          frequencyHz: conflict.frequencyHz ? BigInt(conflict.frequencyHz) : null,
          detail: conflict.detail,
        },
      })
    }

    for (const rec of recommendations) {
      await (prisma.rfRecommendation as any).create({
        data: {
          organizationId: orgId,
          planId,
          assignmentId: rec.assignmentId,
          frequencyHz: BigInt(rec.frequencyHz),
          confidence: rec.confidence,
          reason: rec.reason,
        },
      })
    }

    const status = analysis.riskLevel === 'HIGH' ? 'NEEDS_REVIEW' : 'COORDINATED'
    await (prisma.wirelessFrequencyPlan as any).update({
      where: { id: planId },
      data: { riskScore: analysis.riskScore, riskLevel: analysis.riskLevel, status, coordinatedAt: new Date() },
    })

    return getFrequencyPlan(orgId, planId)
  })
}

export async function acceptRecommendation(orgId: string, recommendationId: string) {
  return runWithOrgContext(orgId, async () => {
    const rec = await (prisma.rfRecommendation as any).findFirst({ where: { id: recommendationId } })
    if (!rec || !rec.assignmentId) throw new Error('Recommendation not found')
    await (prisma.wirelessFrequencyAssignment as any).update({
      where: { id: rec.assignmentId },
      data: { frequencyHz: rec.frequencyHz, suggestedFrequencyHz: rec.frequencyHz },
    })
    await (prisma.rfRecommendation as any).update({ where: { id: recommendationId }, data: { status: 'ACCEPTED' } })
    return coordinateFrequencyPlan(orgId, rec.planId)
  })
}

export async function uploadScan(orgId: string, userId: string, input: z.input<typeof UploadScanSchema>) {
  const data = UploadScanSchema.parse(input)
  const parsed = parseScanContent(data.content)
  if (parsed.errors.length > 0) {
    const error = new Error('Invalid scan file') as Error & { details?: unknown }
    error.details = parsed.errors.slice(0, 20)
    throw error
  }

  return runWithOrgContext(orgId, async () => {
    const points = parsed.points
    const minFrequencyHz = points.length ? Math.min(...points.map((p) => p.frequencyHz)) : null
    const maxFrequencyHz = points.length ? Math.max(...points.map((p) => p.frequencyHz)) : null
    const scan = await (prisma.rfScan as any).create({
      data: {
        organizationId: orgId,
        planId: data.planId ?? null,
        venueProfileId: data.venueProfileId ?? null,
        name: data.name,
        fileName: data.fileName ?? null,
        thresholdDbm: data.thresholdDbm,
        minFrequencyHz: minFrequencyHz ? BigInt(minFrequencyHz) : null,
        maxFrequencyHz: maxFrequencyHz ? BigInt(maxFrequencyHz) : null,
        pointCount: points.length,
        uploadedById: userId,
        capturedAt: data.capturedAt ? new Date(data.capturedAt) : null,
        points: {
          create: points.map((p) => ({ organizationId: orgId, frequencyHz: BigInt(p.frequencyHz), signalDbm: p.signalDbm })),
        },
      },
    })

    const noisy = points.filter((p) => p.signalDbm >= data.thresholdDbm)
    for (const point of noisy.slice(0, 500)) {
      await (prisma.rfExclusionRange as any).create({
        data: {
          organizationId: orgId,
          scanId: scan.id,
          label: `Scan noise at ${hzToMhz(point.frequencyHz)} MHz`,
          reason: `${point.signalDbm} dBm is above the ${data.thresholdDbm} dBm threshold.`,
          startHz: BigInt(point.frequencyHz - DEFAULT_STEP_HZ),
          endHz: BigInt(point.frequencyHz + DEFAULT_STEP_HZ),
          severity: 'WARNING',
        },
      })
    }

    if (data.planId) {
      await coordinateFrequencyPlan(orgId, data.planId)
    }

    return serialize(await (prisma.rfScan as any).findFirst({ where: { id: scan.id }, include: { exclusions: true } }))
  })
}

export async function listScans(orgId: string) {
  return runWithOrgContext(orgId, async () => serialize(await (prisma.rfScan as any).findMany({
    include: { exclusions: true, plan: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })))
}

export async function listVenueProfiles(orgId: string) {
  return runWithOrgContext(orgId, async () => serialize(await (prisma.rfVenueProfile as any).findMany({
    include: { exclusions: true, scans: { orderBy: { createdAt: 'desc' }, take: 3 } },
    orderBy: { name: 'asc' },
  })))
}

export async function createVenueProfile(orgId: string, input: z.input<typeof CreateVenueProfileSchema>) {
  const data = CreateVenueProfileSchema.parse(input)
  return runWithOrgContext(orgId, async () => serialize(await (prisma.rfVenueProfile as any).create({
    data: {
      name: data.name,
      campusId: data.campusId,
      buildingId: data.buildingId,
      spaceId: data.spaceId,
      roomId: data.roomId,
      notes: data.notes,
      exclusions: {
        create: data.exclusions.map((range) => ({
          organizationId: orgId,
          label: range.label,
          reason: range.reason,
          startHz: BigInt(range.startHz),
          endHz: BigInt(range.endHz),
          severity: range.severity,
        })),
      },
    },
    include: { exclusions: true },
  })))
}

export async function listBridgeNodes(orgId: string) {
  return runWithOrgContext(orgId, async () => serialize(await (prisma.rfBridgeNode as any).findMany({ orderBy: { updatedAt: 'desc' } })))
}

export async function createBridgeNode(orgId: string, userId: string, input: z.input<typeof CreateBridgeNodeSchema>) {
  const data = CreateBridgeNodeSchema.parse(input)
  return runWithOrgContext(orgId, async () => serialize(await (prisma.rfBridgeNode as any).create({
    data: {
      ...data,
      pairedById: userId,
      pairedAt: new Date(),
    },
  })))
}

export async function exportPlanCsv(orgId: string, planId: string) {
  const plan = await getFrequencyPlan(orgId, planId) as any
  const rows = [
    ['Label', 'Use', 'Assigned To', 'Device', 'Frequency MHz', 'Locked', 'Soundcheck', 'Notes'],
    ...plan.assignments.map((a: any) => [
      a.label,
      a.use ?? '',
      a.assignedTo ?? '',
      a.device?.name ?? '',
      hzToMhz(a.frequencyHz),
      a.isLocked ? 'Yes' : 'No',
      a.soundcheckStatus,
      a.notes ?? '',
    ]),
  ]
  return rows.map((row) => row.map((cell: unknown) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
}
