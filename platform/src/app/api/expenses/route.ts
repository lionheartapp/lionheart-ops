import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { corsHeaders } from '@/lib/cors'

export async function POST(req: Request) {
  try {
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
        ocrData: body.ocrData,
        manHours: body.manHours,
      },
    })
    return NextResponse.json(expense, { headers: corsHeaders })
  } catch (err) {
    console.error('Create expense error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Create failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
