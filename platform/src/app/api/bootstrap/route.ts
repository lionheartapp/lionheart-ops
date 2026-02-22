import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'
import { verifyToken } from '@/lib/auth'
import { corsHeaders } from '@/lib/cors'

/**
 * GET /api/bootstrap - Unified endpoint for initial app data
 * Returns user, tickets, and events in a single request
 * Lean format optimized for fast rendering
 */
export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const authHeader = req.headers.get('authorization')
      let userId: string | undefined

      if (authHeader?.startsWith('Bearer ')) {
        const payload = await verifyToken(authHeader.slice(7))
        if (payload?.userId) userId = payload.userId
      }

      // Fetch all three in parallel
      const [user, tickets, events] = await Promise.all([
        // User data
        userId
          ? prisma.user.findUnique({
              where: { id: userId },
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            })
          : Promise.resolve(null),

        // Tickets (first 200 for dashboard/list views)
        prisma.ticket.findMany({
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            status: true,
            priority: true,
            createdAt: true,
            submittedBy: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),

        // Events (first 200 for calendar view)
        prisma.event.findMany({
          select: {
            id: true,
            name: true,
            description: true,
            date: true,
            startTime: true,
            endTime: true,
            room: { select: { name: true } },
            submittedBy: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
          take: 200,
        }),
      ])

      // Format response (minimal transformation)
      return NextResponse.json(
        {
          user: user
            ? {
                id: user.id,
                name: user.name ?? user.email?.split('@')[0] ?? 'User',
                email: user.email ?? '',
                role: user.role ?? 'super-admin',
              }
            : null,
          tickets: tickets.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            category: t.category,
            status: t.status?.toLowerCase?.() ?? 'new',
            priority: (t.priority || 'NORMAL').toLowerCase(),
            createdAt: t.createdAt,
            submittedBy: t.submittedBy?.name,
          })),
          events: events.map((e) => ({
            id: e.id,
            name: e.name,
            description: e.description,
            date: e.date,
            startTime: e.startTime,
            endTime: e.endTime,
            location: e.room?.name || 'TBD',
            submittedBy: e.submittedBy?.name,
          })),
          timestamp: new Date().toISOString(),
        },
        { headers: corsHeaders }
      )
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json(
        { error: err.message },
        { status: 401, headers: corsHeaders }
      )
    }
    console.error('GET /api/bootstrap error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to bootstrap app' },
      { status: 500, headers: corsHeaders }
    )
  }
}
