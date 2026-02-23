import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret-change-me')

export type AuthClaims = {
  userId: string
  organizationId: string
  email: string
}

export async function signAuthToken(claims: AuthClaims): Promise<string> {
  return await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d') // 30 days for persistent "remember me" behavior
    .sign(secret)
}

export async function verifyAuthToken(token: string): Promise<AuthClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    if (!payload.userId || !payload.organizationId || !payload.email) return null
    return {
      userId: String(payload.userId),
      organizationId: String(payload.organizationId),
      email: String(payload.email),
    }
  } catch {
    return null
  }
}