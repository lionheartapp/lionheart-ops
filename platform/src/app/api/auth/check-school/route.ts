import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { corsHeaders } from '@/lib/cors'

function slugFromName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'school'
  )
}

/** GET /api/auth/check-school?name=... - Check if a school with this name already exists. */
export async function GET(req: NextRequest) {
  try {
    const name = req.nextUrl.searchParams.get('name')?.trim()
    if (!name || name.length < 2) {
      return NextResponse.json(
        { exists: false },
        { headers: corsHeaders }
      )
    }

    const slug = slugFromName(name)

    // Check by slug (same logic as signup)
    const existing = await prismaBase.organization.findFirst({
      where: {
        OR: [
          { slug },
          { name: { equals: name, mode: 'insensitive' } },
        ],
      },
    })

    return NextResponse.json(
      { exists: !!existing },
      { headers: corsHeaders }
    )
  } catch (err) {
    console.error('check-school error:', err)
    return NextResponse.json(
      { exists: false },
      { headers: corsHeaders }
    )
  }
}
