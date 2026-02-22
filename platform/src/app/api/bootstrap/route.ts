import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { verifyToken } from '@/lib/auth'
import { corsHeaders } from '@/lib/cors'
import { getModules } from '@/lib/modules'

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

      const orgId = getOrgId()

      // Fetch all in parallel
      const [user, tickets, events, org] = await Promise.all([
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

        orgId
          ? prismaBase.organization.findUnique({
              where: { id: orgId },
              select: {
                settings: true,
                name: true,
                logoUrl: true,
                website: true,
                address: true,
                city: true,
                state: true,
                zip: true,
                primaryColor: true,
                secondaryColor: true,
                plan: true,
                trialEndsAt: true,
                latitude: true,
                longitude: true,
                allowTeacherEventRequests: true,
              },
            })
          : Promise.resolve(null),
      ])

      const settings = org?.settings && typeof org.settings === 'object' ? (org.settings as Record<string, unknown>) : {}
      const branding = settings?.branding && typeof settings.branding === 'object' ? (settings.branding as Record<string, unknown>) : {}
      const rawModules = (org?.settings && typeof org.settings === 'object' ? (org.settings as Record<string, unknown>).modules : undefined) as Record<string, unknown> | undefined
      const inventoryTeamIds = Array.isArray(rawModules?.inventoryTeamIds) ? (rawModules.inventoryTeamIds as string[]) : undefined
      const addr = org?.address?.trim() || (branding?.address as string)?.trim() || null
      const primaryColor = org?.primaryColor?.trim() || (branding?.colors as { primary?: string })?.primary || null
      const secondaryColor = org?.secondaryColor?.trim() || (branding?.colors as { secondary?: string })?.secondary || null
      let modules = getModules(org?.settings ?? null)
      let trialDaysLeft: number | null = null
      if (org?.plan === 'PRO_TRIAL' && org.trialEndsAt) {
        if (new Date() > org.trialEndsAt) {
          modules = { ...modules, waterManagement: false, visualCampus: { enabled: false, maxBuildings: null }, advancedInventory: false }
        } else {
          trialDaysLeft = Math.ceil((org.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        }
      }
      const addressParts = [addr, org?.city, org?.state, org?.zip].filter(Boolean)
      const address = addressParts.length > 0 ? addressParts.join(', ') : addr

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
          org: org
            ? {
                modules,
                inventoryTeamIds,
                name: org?.name ?? null,
                logoUrl: org?.logoUrl ?? null,
                website: org?.website ?? null,
                address,
                city: org?.city ?? null,
                state: org?.state ?? null,
                zip: org?.zip ?? null,
                primaryColor,
                secondaryColor,
                trialDaysLeft,
                latitude: org?.latitude ?? null,
                longitude: org?.longitude ?? null,
                allowTeacherEventRequests: org?.allowTeacherEventRequests ?? false,
              }
            : null,
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
