import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'

/**
 * DELETE /api/teacher-schedule/[id]
 * Remove a teacher schedule entry.
 */
export async function DELETE(
  req: NextRequest,
  { params }: any
) {
  try {
    return await withOrg(req, prisma, async () => {
      const { id } = params

      const schedule = await prisma.teacherSchedule.findUnique({
        where: { id },
      })

      if (!schedule) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404, headers: corsHeaders })
      }

      await prisma.teacherSchedule.delete({
        where: { id },
      })

      return NextResponse.json({ success: true }, { headers: corsHeaders })
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('DELETE /api/teacher-schedule/[id] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete teacher schedule' },
      { status: 500, headers: corsHeaders }
    )
  }
}

