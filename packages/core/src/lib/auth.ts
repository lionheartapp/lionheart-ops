import * as bcrypt from 'bcryptjs'
import * as jose from 'jose'

const SALT_ROUNDS = 10
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-in-production')
const JWT_EXPIRY = '7d'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createToken(payload: { userId: string; email: string; orgId: string | null }): Promise<string> {
  return new jose.SignJWT({ email: payload.email, orgId: payload.orgId })
    .setSubject(payload.userId)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<{ userId: string; email: string; orgId: string | null } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET)
    return {
      userId: payload.sub as string,
      email: payload.email as string,
      orgId: (payload.orgId as string) || null,
    }
  } catch {
    return null
  }
}
