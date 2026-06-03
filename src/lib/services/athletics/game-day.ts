import { Prisma } from '@prisma/client'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { invalidateOrgCache } from '@/lib/cache/route-cache'
import { getOrgContextId } from '@/lib/org-context'

const db = prisma as unknown as OrgPrismaClient

export type GameDayStatus = 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'FINAL'

export interface GameDaySessionInput {
  status?: GameDayStatus
  currentPeriod?: number
  periodLabel?: string | null
  clockSecondsRemaining?: number | null
  lineup?: Prisma.InputJsonValue | null
  gameState?: Prisma.InputJsonValue | null
  playLog?: Prisma.InputJsonValue | null
  lastSavedById?: string | null
}

function invalidateAthleticsCache(): void {
  invalidateOrgCache(getOrgContextId(), 'athletics')
}

export async function getGameDaySession(gameId: string) {
  return db.gameDaySession.findUnique({
    where: { gameId },
  })
}

export async function upsertGameDaySession(gameId: string, input: GameDaySessionInput) {
  const existing = await db.gameDaySession.findUnique({
    where: { gameId },
    select: { id: true, startedAt: true, finalizedAt: true },
  })

  const status = input.status
  const now = new Date()
  const statusDates = {
    ...(status === 'LIVE' && !existing?.startedAt ? { startedAt: now } : {}),
    ...(status === 'FINAL' && !existing?.finalizedAt ? { finalizedAt: now } : {}),
  }

  const data = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.currentPeriod !== undefined ? { currentPeriod: input.currentPeriod } : {}),
    ...(input.periodLabel !== undefined ? { periodLabel: input.periodLabel } : {}),
    ...(input.clockSecondsRemaining !== undefined ? { clockSecondsRemaining: input.clockSecondsRemaining } : {}),
    ...(input.lineup !== undefined ? { lineup: input.lineup } : {}),
    ...(input.gameState !== undefined ? { gameState: input.gameState } : {}),
    ...(input.playLog !== undefined ? { playLog: input.playLog } : {}),
    ...(input.lastSavedById !== undefined ? { lastSavedById: input.lastSavedById } : {}),
    ...statusDates,
  }

  const session = await db.gameDaySession.upsert({
    where: { gameId },
    create: {
      gameId,
      currentPeriod: input.currentPeriod ?? 1,
      status: input.status ?? 'NOT_STARTED',
      periodLabel: input.periodLabel ?? null,
      clockSecondsRemaining: input.clockSecondsRemaining ?? null,
      lineup: input.lineup ?? Prisma.JsonNull,
      gameState: input.gameState ?? Prisma.JsonNull,
      playLog: input.playLog ?? Prisma.JsonNull,
      lastSavedById: input.lastSavedById ?? null,
      ...(input.status === 'LIVE' ? { startedAt: now } : {}),
      ...(input.status === 'FINAL' ? { finalizedAt: now } : {}),
    },
    update: data,
  })

  invalidateAthleticsCache()
  return session
}
