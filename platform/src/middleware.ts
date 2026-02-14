import { NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/cors'

export function middleware(req: Request) {
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders })
  }
  return NextResponse.next()
}

export const config = { matcher: '/api/:path*' }
