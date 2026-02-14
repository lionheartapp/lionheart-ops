import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'

export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
    const body = (await req.json()) as {
      ticketId?: string
      vendor: string
      expenseDate: string
      total: number
      receiptUrl?: string
      ocrData?: Record<string, unknown>
      manHours?: number
    }
    const { vendor, expenseDate, total } = body
    if (!vendor || !expenseDate || typeof total !== 'number') {
      return NextResponse.json({ error: 'Missing vendor, expenseDate, or total' }, { status: 400, headers: corsHeaders })
    }
    const expense = await prisma.expense.create({
      data: {
        ticketId: body.ticketId,
        vendor,
        expenseDate,
        total,
        receiptUrl: body.receiptUrl,
        ocrData: body.ocrData != null
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (JSON.parse(JSON.stringify(body.ocrData)) as any)
          : undefined,
        manHours: body.manHours,
      },
    })
    return NextResponse.json(expense, { headers: corsHeaders })
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('Create expense error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Create failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
