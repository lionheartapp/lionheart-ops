import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { createToken } from '@/lib/auth'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

type GoogleUserInfo = {
  id: string
  email: string
  verified_email: boolean
  name?: string
  picture?: string
}

/** Handle Google OAuth callback: exchange code, find/create user, issue JWT, redirect. */
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')
    const stateParam = req.nextUrl.searchParams.get('state')
    const errorParam = req.nextUrl.searchParams.get('error')

    const platformUrl = (process.env.NEXT_PUBLIC_PLATFORM_URL || 'http://localhost:3001').replace(/\/+$/, '')
    const lionheartUrl = (process.env.NEXT_PUBLIC_LIONHEART_URL || 'http://localhost:5173').replace(/\/+$/, '')

    if (errorParam) {
      const loginPath = errorParam === 'access_denied' ? '/login' : '/login?error=oauth_failed'
      return NextResponse.redirect(`${platformUrl}${loginPath}`)
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(`${platformUrl}/login?error=missing_params`)
    }

    let state: { nonce: string; from: 'platform' | 'lionheart'; finalRedirect: string }
    try {
      state = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
    } catch {
      return NextResponse.redirect(`${platformUrl}/login?error=invalid_state`)
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${platformUrl}/login?error=oauth_not_configured`)
    }

    const callbackUrl = `${platformUrl}/api/auth/google/callback`

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = (await tokenRes.json()) as {
      access_token?: string
      error?: string
      error_description?: string
    }

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Google token exchange failed:', tokenData)
      return NextResponse.redirect(`${platformUrl}/login?error=token_exchange_failed`)
    }

    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userInfoRes.ok) {
      return NextResponse.redirect(`${platformUrl}/login?error=userinfo_failed`)
    }

    const googleUser = (await userInfoRes.json()) as GoogleUserInfo
    const email = googleUser.email?.trim()?.toLowerCase()

    if (!email || !googleUser.verified_email) {
      return NextResponse.redirect(`${platformUrl}/login?error=email_not_verified`)
    }

    let user = await prismaBase.user.findUnique({
      where: { email },
      include: { organization: true },
    })

    if (!user) {
      const slug = email.replace(/@.*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'user'
      const slugExists = await prismaBase.organization.findUnique({ where: { slug } })
      const uniqueSlug = slugExists ? `${slug}-${Date.now().toString(36)}` : slug

      const org = await prismaBase.organization.create({
        data: {
          name: googleUser.name || email.split('@')[0],
          slug: uniqueSlug,
          plan: 'CORE',
          settings: {
            modules: {
              core: true,
              waterManagement: false,
              visualCampus: { enabled: true },
              advancedInventory: false,
            },
          },
        },
      })

      user = await prismaBase.user.create({
        data: {
          email,
          name: googleUser.name || null,
          imageUrl: googleUser.picture || null,
          organizationId: org.id,
          role: 'SUPER_ADMIN',
          canSubmitEvents: true,
        },
        include: { organization: true },
      })
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
      orgId: user.organizationId,
    })

    const baseUrl = state.from === 'lionheart' ? lionheartUrl : platformUrl
    const authCallbackPath = '/auth/callback'
    const redirectUrl = `${baseUrl}${authCallbackPath}?token=${encodeURIComponent(token)}&next=${encodeURIComponent(state.finalRedirect)}`

    return NextResponse.redirect(redirectUrl)
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    const platformUrl = (process.env.NEXT_PUBLIC_PLATFORM_URL || 'http://localhost:3001').replace(/\/+$/, '')
    return NextResponse.redirect(`${platformUrl}/login?error=oauth_failed`)
  }
}
