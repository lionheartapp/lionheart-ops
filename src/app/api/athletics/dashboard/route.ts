import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getTeams, getSports, getGames, getPractices, getTeamStandings } from '@/lib/services/athleticsService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_READ)

    return await runWithOrgContext(orgId, async () => {
      const now = new Date()

      // Calculate current week boundaries (Mon–Sun)
      const dayOfWeek = now.getDay() // 0=Sun, 1=Mon...
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() + mondayOffset)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)

      const [teams, sports, allGames, practices, standings] = await Promise.all([
        getTeams(),
        getSports({ isActive: true }),
        getGames(),
        getPractices(),
        getTeamStandings(),
      ])

      // Split games into upcoming and recent
      const upcomingGames = allGames
        .filter((g: any) => new Date(g.startTime) >= now)
        .slice(0, 7)

      const recentResults = allGames
        .filter((g: any) => new Date(g.startTime) < now && g.isFinal)
        .reverse()
        .slice(0, 5)

      // Games & practices this week
      const gamesThisWeek = allGames.filter((g: any) => {
        const t = new Date(g.startTime)
        return t >= weekStart && t <= weekEnd
      })

      const practicesThisWeek = practices.filter((p: any) => {
        const t = new Date(p.startTime)
        return t >= weekStart && t <= weekEnd
      })

      // Aggregate overall record from standings
      let totalWins = 0, totalLosses = 0, totalTies = 0
      for (const s of standings) {
        totalWins += (s as any).wins
        totalLosses += (s as any).losses
        totalTies += (s as any).ties
      }

      return NextResponse.json(ok({
        summary: {
          totalTeams: teams.length,
          totalSports: sports.length,
          activeSports: sports.filter((s: any) => s.isActive !== false).length,
          gamesThisWeek: gamesThisWeek.length,
          practicesThisWeek: practicesThisWeek.length,
          overallRecord: { wins: totalWins, losses: totalLosses, ties: totalTies },
        },
        upcomingGames,
        recentResults,
        standings: (standings as any[]).slice(0, 8),
        weekSchedule: {
          games: gamesThisWeek,
          practices: practicesThisWeek,
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
        },
      }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch athletics dashboard'), { status: 500 })
  }
}
