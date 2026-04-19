/**
 * Form QR Code Service
 *
 * Manages QR codes that link to pre-filled ticket submission forms.
 * Each QR encodes a token that resolves to a category + location scope.
 */

import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import crypto from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QrCodeWithLocation {
  id: string
  organizationId: string
  categoryKey: string | null
  buildingId: string | null
  areaId: string | null
  roomId: string | null
  token: string
  label: string
  active: boolean
  createdAt: Date
  lastUsedAt: Date | null
  building?: { id: string; name: string } | null
  area?: { id: string; name: string } | null
  room?: { id: string; roomNumber: string; displayName: string | null } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateToken(): string {
  return crypto.randomBytes(12).toString('base64url')
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listQrCodes(): Promise<QrCodeWithLocation[]> {
  const codes = await prisma.formQrCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      organization: false,
    },
  })

  // Fetch location names for each code
  const buildingIds = [...new Set(codes.map((c) => c.buildingId).filter(Boolean))] as string[]
  const areaIds = [...new Set(codes.map((c) => c.areaId).filter(Boolean))] as string[]
  const roomIds = [...new Set(codes.map((c) => c.roomId).filter(Boolean))] as string[]

  const [buildings, areas, rooms] = await Promise.all([
    buildingIds.length > 0
      ? prisma.building.findMany({ where: { id: { in: buildingIds } }, select: { id: true, name: true } })
      : [],
    areaIds.length > 0
      ? prisma.area.findMany({ where: { id: { in: areaIds } }, select: { id: true, name: true } })
      : [],
    roomIds.length > 0
      ? prisma.room.findMany({ where: { id: { in: roomIds } }, select: { id: true, roomNumber: true, displayName: true } })
      : [],
  ])

  const buildingMap = new Map(buildings.map((b) => [b.id, b]))
  const areaMap = new Map(areas.map((a) => [a.id, a]))
  const roomMap = new Map(rooms.map((r) => [r.id, r]))

  return codes.map((c) => ({
    ...c,
    building: c.buildingId ? buildingMap.get(c.buildingId) ?? null : null,
    area: c.areaId ? areaMap.get(c.areaId) ?? null : null,
    room: c.roomId ? roomMap.get(c.roomId) ?? null : null,
  }))
}

export async function createQrCode(data: {
  categoryKey?: string | null
  buildingId?: string | null
  areaId?: string | null
  roomId?: string | null
  label: string
}) {
  const token = generateToken()

  return (prisma.formQrCode.create as Function)({
    data: {
      categoryKey: data.categoryKey ?? null,
      buildingId: data.buildingId ?? null,
      areaId: data.areaId ?? null,
      roomId: data.roomId ?? null,
      token,
      label: data.label,
    },
  })
}

export async function updateQrCode(
  id: string,
  data: { label?: string; active?: boolean }
) {
  return prisma.formQrCode.update({
    where: { id },
    data,
  })
}

export async function deactivateQrCode(id: string) {
  return prisma.formQrCode.update({
    where: { id },
    data: { active: false },
  })
}

export async function regenerateQrToken(id: string) {
  const newToken = generateToken()
  return prisma.formQrCode.update({
    where: { id },
    data: { token: newToken },
  })
}

// ─── Public resolution (no org scope) ─────────────────────────────────────────

export async function resolveQrToken(token: string) {
  const qr = await rawPrisma.formQrCode.findUnique({
    where: { token },
    include: {
      organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
  })

  if (!qr || !qr.active) return null

  // Touch lastUsedAt
  await rawPrisma.formQrCode.update({
    where: { id: qr.id },
    data: { lastUsedAt: new Date() },
  })

  return {
    organizationId: qr.organizationId,
    organization: qr.organization,
    categoryKey: qr.categoryKey,
    buildingId: qr.buildingId,
    areaId: qr.areaId,
    roomId: qr.roomId,
    label: qr.label,
  }
}
