import { NextResponse } from 'next/server'

/** Debug: see what redirect_uri will be sent to Google. Remove or protect in production. */
export async function GET() {
  const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_URL || 'http://localhost:3001'
  const callbackUrl = `${platformUrl}/api/auth/google/callback`
  return NextResponse.json({
    NEXT_PUBLIC_PLATFORM_URL: process.env.NEXT_PUBLIC_PLATFORM_URL ?? '(not set)',
    platformUrl,
    redirect_uri: callbackUrl,
    note: 'Add this exact redirect_uri to Google Cloud Console > Authorized redirect URIs',
  })
}
