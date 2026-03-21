import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import * as pcoSync from '@/lib/services/integrations/pcoServicesSync'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/projects/[id]/schedule/pco' })

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/events/projects/[id]/schedule/pco?action=service-types
 * GET /api/events/projects/[id]/schedule/pco?action=plans&serviceTypeId=X
 * GET /api/events/projects/[id]/schedule/pco?action=plan-items&serviceTypeId=X&planId=Y
 * GET /api/events/projects/[id]/schedule/pco?action=link&sectionId=X
 *
 * Query-parameter routing to avoid excessive nested directories.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    return await runWithOrgContext(orgId, async () => {
      switch (action) {
        case 'service-types': {
          const types = await pcoSync.listServiceTypes(orgId)
          return NextResponse.json(ok(types))
        }

        case 'plans': {
          const serviceTypeId = url.searchParams.get('serviceTypeId')
          if (!serviceTypeId) {
            return NextResponse.json(fail('VALIDATION_ERROR', 'serviceTypeId is required'), { status: 400 })
          }
          const filter = (url.searchParams.get('filter') as 'future' | 'past' | 'no_dates') || 'future'
          const plans = await pcoSync.listPlans(orgId, serviceTypeId, { filter })
          return NextResponse.json(ok(plans))
        }

        case 'plan-items': {
          const serviceTypeId = url.searchParams.get('serviceTypeId')
          const planId = url.searchParams.get('planId')
          if (!serviceTypeId || !planId) {
            return NextResponse.json(fail('VALIDATION_ERROR', 'serviceTypeId and planId are required'), { status: 400 })
          }
          const detail = await pcoSync.getPlanItems(orgId, serviceTypeId, planId)
          return NextResponse.json(ok(detail))
        }

        case 'link': {
          const sectionId = url.searchParams.get('sectionId')
          if (!sectionId) {
            return NextResponse.json(fail('VALIDATION_ERROR', 'sectionId is required'), { status: 400 })
          }
          const link = await pcoSync.getServiceLink(sectionId)
          return NextResponse.json(ok(link))
        }

        default:
          return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid action. Use: service-types, plans, plan-items, link'), { status: 400 })
      }
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', error instanceof Error ? error.message : 'Unauthorized'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('Not connected')) {
      return NextResponse.json(fail('PRECONDITION_FAILED', error.message), { status: 412 })
    }
    log.error({ err: error }, 'PCO schedule GET failed')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}

/**
 * POST /api/events/projects/[id]/schedule/pco
 *
 * Body: { action: 'import' | 'push' | 'unlink', ... }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

    const body = await req.json()
    const { action } = body

    return await runWithOrgContext(orgId, async () => {
      switch (action) {
        case 'import': {
          const { sectionId, serviceTypeId, planId, syncDirection, autoSync, selectedItemIds } = body
          if (!sectionId || !serviceTypeId || !planId) {
            return NextResponse.json(
              fail('VALIDATION_ERROR', 'sectionId, serviceTypeId, and planId are required'),
              { status: 400 }
            )
          }

          const result = await pcoSync.importPlanToSection(
            orgId,
            eventProjectId,
            sectionId,
            serviceTypeId,
            planId,
            { syncDirection, autoSync, selectedItemIds }
          )

          return NextResponse.json(ok(result), { status: result.errors.length > 0 ? 207 : 200 })
        }

        case 'push': {
          const { sectionId } = body
          if (!sectionId) {
            return NextResponse.json(fail('VALIDATION_ERROR', 'sectionId is required'), { status: 400 })
          }

          const result = await pcoSync.pushSectionToPCO(orgId, sectionId)
          return NextResponse.json(ok(result), { status: result.errors.length > 0 ? 207 : 200 })
        }

        case 'sync-all': {
          const syncResult = await pcoSync.syncAllLinkedSections(orgId, eventProjectId)
          return NextResponse.json(ok(syncResult))
        }

        case 'unlink-item': {
          const { sectionId, pcoItemId, deleteBlock } = body
          if (!sectionId || !pcoItemId) {
            return NextResponse.json(
              fail('VALIDATION_ERROR', 'sectionId and pcoItemId are required'),
              { status: 400 }
            )
          }

          const unlinkItemResult = await pcoSync.unlinkItem(sectionId, pcoItemId, deleteBlock ?? false)
          return NextResponse.json(ok(unlinkItemResult))
        }

        case 'unlink': {
          const { sectionId } = body
          if (!sectionId) {
            return NextResponse.json(fail('VALIDATION_ERROR', 'sectionId is required'), { status: 400 })
          }

          await pcoSync.unlinkSection(sectionId)
          return NextResponse.json(ok({ unlinked: true }))
        }

        default:
          return NextResponse.json(
            fail('VALIDATION_ERROR', 'Invalid action. Use: import, push, unlink'),
            { status: 400 }
          )
      }
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', error instanceof Error ? error.message : 'Unauthorized'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('Not connected')) {
      return NextResponse.json(fail('PRECONDITION_FAILED', error.message), { status: 412 })
    }
    if (error instanceof Error && error.message.includes('import-only')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'PCO schedule POST failed')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}
