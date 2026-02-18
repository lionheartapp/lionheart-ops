import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { runWithOrg } from '@/lib/orgContext'
import OpenAI from 'openai'
import { Resend } from 'resend'

/** Monthly facilities report: total spend vs budget + AI cost-saving tip. Call via cron. Requires orgId or x-org-id for tenant scope. */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') || req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const orgId = req.nextUrl.searchParams.get('orgId') || req.headers.get('x-org-id')?.trim()
  if (!orgId) {
    return NextResponse.json(
      { error: 'orgId or x-org-id required for scoped report' },
      { status: 400 }
    )
  }

  try {
    return await runWithOrg(orgId, prismaBase, async () => {
      const now = new Date()
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const [expenses, budgets, tips] = await Promise.all([
        prisma.expense.findMany({
          where: { expenseDate: { startsWith: yearMonth } },
          select: { vendor: true, total: true, manHours: true },
        }),
        prisma.budget.findMany({
          where: { yearMonth },
          select: { category: true, amount: true },
        }),
        prisma.maintenanceTip.findMany({
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: { content: true },
        }),
      ])

      const totalSpend = expenses.reduce((sum, e) => sum + e.total, 0)
      const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0)
      const budgetStatus = totalBudget > 0 ? (totalSpend <= totalBudget ? 'Under' : 'Over') : 'N/A'
      const vendorSummary = expenses.reduce((acc, e) => {
        acc[e.vendor] = (acc[e.vendor] || 0) + e.total
        return acc
      }, {} as Record<string, number>)
      const topVendors = Object.entries(vendorSummary)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([v, amt]) => `${v}: $${amt.toFixed(2)}`)
        .join(', ')

      let costSavingTip = 'No tips generated.'
      const openai = process.env.OPENAI_API_KEY
        ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        : null
      if (openai && (tips.length > 0 || expenses.length > 0)) {
        try {
          const tipRes = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: `You are a facilities cost analyst. Based on this month's expense and maintenance data, suggest ONE actionable cost-saving tip.

Month: ${yearMonth}
Total spend: $${totalSpend.toFixed(2)}
Top vendors/categories: ${topVendors || 'None recorded'}
Existing takeaways from past tickets: ${tips.map((t) => t.content).join(' | ') || 'None'}

Return a single paragraph (2-4 sentences) with one clear, actionable cost-saving recommendation. Be specific. No preamble.`,
              },
            ],
          })
          const text = tipRes.choices?.[0]?.message?.content?.trim()
          if (text) costSavingTip = text
        } catch (e) {
          console.error('AI tip generation failed:', e)
        }
      }

      const report = {
        yearMonth,
        totalSpend: totalSpend.toFixed(2),
        totalBudget: totalBudget.toFixed(2),
        budgetStatus,
        costSavingTip,
        expenseCount: expenses.length,
      }

      const email = process.env.FACILITIES_DIRECTOR_EMAIL?.trim()
      const resendKey = process.env.RESEND_API_KEY?.trim()
      if (email && resendKey) {
        const resend = new Resend(resendKey)
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Facilities Report <onboarding@resend.dev>',
          to: email,
          subject: `Facilities Monthly Report — ${yearMonth}`,
          html: `
          <h2>Facilities Report — ${yearMonth}</h2>
          <p><strong>Total Spend:</strong> $${report.totalSpend}</p>
          <p><strong>Budget:</strong> $${report.totalBudget}</p>
          <p><strong>Status:</strong> ${report.budgetStatus} budget</p>
          <p><strong>Expenses recorded:</strong> ${report.expenseCount}</p>
          <hr />
          <h3>Cost-Saving Tip</h3>
          <p>${costSavingTip}</p>
        `,
        })
      }

      return NextResponse.json(report)
    })
  } catch (err) {
    console.error('Monthly report error:', err)
    const msg = err instanceof Error ? err.message : 'Report failed'
    const hint =
      msg.includes('connect') || msg.includes('ECONNREFUSED') || msg.includes('placeholder')
        ? ' Configure DATABASE_URL in platform/.env and run: npx prisma db push'
        : ''
    return NextResponse.json(
      { error: msg + hint },
      { status: 500 }
    )
  }
}
