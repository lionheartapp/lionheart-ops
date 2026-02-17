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

    let state: { nonce: string; from: 'platform' | 'lionheart'; finalRedirect: string; intent?: 'login' | 'signup' }
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
    let isNewUser = false
    let createdNewOrg = false

    if (!user) {
      // Intent: login = must exist; signup = create if not found
      if (state.intent === 'login') {
        const loginBase = state.from === 'lionheart' ? lionheartUrl : platformUrl
        return NextResponse.redirect(`${loginBase}/login?error=account_not_found`)
      }

      const emailDomain = email.split('@')[1] || ''
      let existingOrg: { id: string; settings: unknown } | null = null

      // 1. Check allowedDomains in settings (orgs can have multiple: linfield.edu, linfield.com)
      if (emailDomain) {
        const byDomain = await prismaBase.$queryRaw<{ id: string; settings: unknown }[]>`
          SELECT id, settings FROM "Organization"
          WHERE settings->'allowedDomains' ? ${emailDomain}
          LIMIT 1
        `
        if (byDomain?.[0]) existingOrg = byDomain[0]
      }

      // 2. Fallback: match website hostname (e.g. website "https://linfield.edu" matches @linfield.edu)
      if (!existingOrg && emailDomain) {
        const orgs = await prismaBase.organization.findMany({
          where: { website: { not: null } },
          select: { id: true, website: true },
        })
        for (const o of orgs) {
          try {
            const host = o.website ? new URL(o.website.startsWith('http') ? o.website : `https://${o.website}`).hostname : ''
            const domain = host.replace(/^www\./, '')
            if (domain && domain.toLowerCase() === emailDomain.toLowerCase()) {
              existingOrg = { id: o.id, settings: null }
              break
            }
          } catch {
            /* skip invalid URLs */
          }
        }
      }

      if (existingOrg) {
        // Auto-join existing school (domain match)
        isNewUser = true
        user = await prismaBase.user.create({
          data: {
            email,
            name: googleUser.name || null,
            imageUrl: googleUser.picture || null,
            organizationId: existingOrg.id,
            role: 'TEACHER',
            canSubmitEvents: false,
          },
          include: { organization: true },
        })
      } else {
        // Create new school (first user = SUPER_ADMIN)
        isNewUser = true
        createdNewOrg = true
        const baseSlug = emailDomain ? emailDomain.split('.')[0] : email.replace(/@.*/, '').replace(/[^a-z0-9]/g, '')
        const slug = (baseSlug || 'school').toLowerCase().replace(/[^a-z0-9]/g, '') || 'school'
        const slugExists = await prismaBase.organization.findUnique({ where: { slug } })
        const uniqueSlug = slugExists ? `${slug}-${Date.now().toString(36).slice(-6)}` : slug

        const org = await prismaBase.organization.create({
          data: {
            name: googleUser.name ? `${googleUser.name}'s School` : (email.split('@')[0] || 'My School'),
            slug: uniqueSlug,
            website: emailDomain ? `https://www.${emailDomain}` : null,
            plan: 'CORE',
            settings: {
              modules: {
                core: true,
                waterManagement: false,
                visualCampus: { enabled: true },
                advancedInventory: false,
              },
              allowedDomains: emailDomain ? [emailDomain] : [],
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
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
      orgId: user.organizationId,
    })

    const baseUrl = state.from === 'lionheart' ? lionheartUrl : platformUrl
    const authCallbackPath = '/auth/callback'

    // New users who created a new school must go to Setup wizard to confirm school details.
    // Use same-origin path so token set in /auth/callback is available on /setup and /app.
    let nextPath = state.finalRedirect + (isNewUser ? '?onboarding=1' : '')
    if (createdNewOrg && user.organizationId) {
      const params = new URLSearchParams({ orgId: user.organizationId })
      if (user.email) params.set('userEmail', user.email)
      nextPath = `/setup?${params.toString()}`
    }

    const redirectUrl = `${baseUrl}${authCallbackPath}?token=${encodeURIComponent(token)}&next=${encodeURIComponent(nextPath)}`

    return NextResponse.redirect(redirectUrl)
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    const platformUrl = (process.env.NEXT_PUBLIC_PLATFORM_URL || 'http://localhost:3001').replace(/\/+$/, '')
    return NextResponse.redirect(`${platformUrl}/login?error=oauth_failed`)
  }
}
