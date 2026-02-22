import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const SCOPES = ['openid', 'email', 'profile'].join(' ')

/** Redirect to Google OAuth consent. Pass ?from=platform|lionheart to control post-login redirect. */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const platformUrl = (process.env.NEXT_PUBLIC_PLATFORM_URL || 'http://localhost:3001').replace(/\/+$/, '')
  const lionheartUrl = (process.env.NEXT_PUBLIC_LIONHEART_URL || 'http://localhost:5173').replace(/\/+$/, '')

  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth is not configured' },
      { status: 503 }
    )
  }

  const from = (req.nextUrl.searchParams.get('from') || 'platform') as 'platform' | 'lionheart'
  const intent = (req.nextUrl.searchParams.get('intent') || 'login') as 'login' | 'signup'
  const callbackUrl = `${platformUrl}/api/auth/google/callback`
  const nonce = randomBytes(16).toString('hex')
  const state = Buffer.from(
    JSON.stringify({ nonce, from, intent, finalRedirect: from === 'platform' ? '/campus' : '/app' })
  ).toString('base64url')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'online',
    state,
    prompt: 'select_account',
  })

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`)
}
