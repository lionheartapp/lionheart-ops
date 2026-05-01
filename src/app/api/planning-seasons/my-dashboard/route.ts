import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

/**
 * GET /api/planning-seasons/my-dashboard
 *
 * Returns the active planning season (if any) plus the current user's
 * submissions with comment counts and conflicts that affect them.
 * Admins also get org-wide stats (total submissions, conflicts).
 * Used by the dashboard planning widget.
 */
export const GET = withAuth(async ({ ctx, searchParams }) => {
  const now = new Date()
  const isAdmin = await can(ctx.userId, PERMISSIONS.PLANNING_MANAGE)
  const schoolId = searchParams.get('schoolId') || undefined

  // Find active season scoped to the selected school.
  // Matches seasons for that specific school OR org-wide seasons (schoolId: null).
  const activeSeason = await prisma.planningSeason.findFirst({
    where: {
      phase: { in: ['COLLECTING', 'REVIEWING', 'WAR_ROOM'] },
      ...(schoolId
        ? { OR: [{ schoolId }, { schoolId: null }] }
        : {}),
    },
    // Prefer school-specific season over org-wide
    orderBy: [{ schoolId: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      phase: true,
      submissionOpen: true,
      submissionClose: true,
      startDate: true,
      endDate: true,
      schoolId: true,
    },
  })

  if (!activeSeason) {
    return NextResponse.json(ok({ season: null, submissions: [], conflicts: [] }))
  }

  const isSubmissionsOpen =
    activeSeason.phase === 'COLLECTING' &&
    now >= new Date(activeSeason.submissionOpen) &&
    now <= new Date(activeSeason.submissionClose)

  // Fetch user's submissions with comment counts
  const submissions = await prisma.planningSubmission.findMany({
    where: {
      planningSeasonId: activeSeason.id,
      submittedById: ctx.userId,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      submissionStatus: true,
      preferredDate: true,
      priority: true,
      createdAt: true,
      _count: {
        select: { comments: true },
      },
    },
  })

  // Fetch conflicts that affect any of this user's submissions
  const submissionIds = submissions.map((s) => s.id)
  let conflicts: Array<{
    id: string
    conflictType: string
    severity: string
    description: string
    affectedIds: unknown
    isResolved: boolean
    _count: { comments: number }
  }> = []

  if (submissionIds.length > 0) {
    // PlanningConflict.affectedIds is a JSON array — filter in-app
    const allConflicts = await prisma.planningConflict.findMany({
      where: {
        planningSeasonId: activeSeason.id,
        isResolved: false,
      },
      select: {
        id: true,
        conflictType: true,
        severity: true,
        description: true,
        affectedIds: true,
        isResolved: true,
        _count: { select: { comments: true } },
      },
    })

    conflicts = allConflicts.filter((c) => {
      const ids = Array.isArray(c.affectedIds) ? c.affectedIds : []
      return ids.some((id: unknown) => submissionIds.includes(id as string))
    })
  }

  // Admin stats — org-wide overview
  let adminStats = null
  if (isAdmin) {
    const [totalSubmissions, statusCounts, totalConflicts] = await Promise.all([
      prisma.planningSubmission.count({
        where: { planningSeasonId: activeSeason.id },
      }),
      prisma.planningSubmission.groupBy({
        by: ['submissionStatus'],
        where: { planningSeasonId: activeSeason.id },
        _count: true,
      }),
      prisma.planningConflict.count({
        where: { planningSeasonId: activeSeason.id, isResolved: false },
      }),
    ])

    const byStatus: Record<string, number> = {}
    for (const row of statusCounts) {
      byStatus[row.submissionStatus] = row._count
    }

    adminStats = {
      totalSubmissions,
      byStatus,
      unresolvedConflicts: totalConflicts,
    }
  }

  return NextResponse.json(ok({
    season: {
      ...activeSeason,
      isSubmissionsOpen,
    },
    submissions,
    conflicts,
    isAdmin,
    adminStats,
  }))
})
