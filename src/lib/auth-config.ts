/**
 * Auth.js v5 Configuration
 *
 * Configured with:
 * - JWT strategy (not database sessions) for compatibility with existing middleware
 * - Three providers: Google, Microsoft (Azure AD), Credentials (email+password)
 * - Custom JWT and Session callbacks to embed user context
 *
 * NOTE: Requires `npm install next-auth@beta` to resolve types.
 */

// @ts-nocheck — next-auth types available after npm install
import { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import Azure from 'next-auth/providers/azure-ad'
import { verifyAuthToken, signAuthToken, type AuthClaims } from '@/lib/auth'
import { rawPrisma } from '@/lib/db'
import bcryptjs from 'bcryptjs'
import { z } from 'zod'

// ─── Zod Validation Schemas ────────────────────────────────────────────

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

// ─── Auth.js Configuration ────────────────────────────────────────────

export const authConfig: NextAuthConfig = {
  // Use JWT strategy instead of database sessions
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // JWT configuration
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Providers
  providers: [
    // Credentials provider for email + password login
    Credentials({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          // Validate input
          const parsed = CredentialsSchema.safeParse(credentials)
          if (!parsed.success) {
            return null
          }

          const { email, password } = parsed.data

          // Look up user by email across all orgs (using rawPrisma)
          // User has compound unique @@unique([organizationId, email]), so use findFirst
          const user = await rawPrisma.user.findFirst({
            where: { email, deletedAt: null },
            select: {
              id: true,
              email: true,
              organizationId: true,
              passwordHash: true,
            },
          })

          if (!user || !user.passwordHash) {
            return null
          }

          // Verify password
          const passwordValid = await bcryptjs.compare(password, user.passwordHash)
          if (!passwordValid) {
            return null
          }

          // Return user object that NextAuth will use for JWT claims
          return {
            id: user.id,
            email: user.email,
            organizationId: user.organizationId,
          }
        } catch (error) {
          console.error('Credentials auth error:', error)
          return null
        }
      },
    }),

    // Google OAuth provider
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),

    // Microsoft Azure AD provider
    Azure({
      clientId: process.env.AZURE_AD_CLIENT_ID || '',
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || '',
      tenantId: process.env.AZURE_AD_TENANT_ID || 'common',
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  // Pages configuration
  pages: {
    signIn: '/login',
    error: '/login',
  },

  // Callbacks
  callbacks: {
    // signIn callback: check if user exists for OAuth
    async signIn({ user, account, profile }) {
      try {
        // For credentials provider, allow all sign-ins
        if (account?.provider === 'credentials') {
          return true
        }

        // For OAuth providers, check if user exists
        if (account?.provider === 'google' || account?.provider === 'azure-ad') {
          const email = user.email
          if (!email) {
            return false
          }

          // Check if user exists by email or OAuth ID
          const existingUser = await rawPrisma.user.findFirst({
            where: {
              OR: [
                { email },
                account.provider === 'google' ? { googleId: account.providerAccountId } : {},
                account.provider === 'azure-ad' ? { microsoftId: account.providerAccountId } : {},
              ],
            },
            select: { id: true },
          })

          // If user doesn't exist, return false (they must sign up first)
          // Signup flow will create the user and link the OAuth account
          if (!existingUser) {
            return false
          }

          return true
        }

        return true
      } catch (error) {
        console.error('signIn callback error:', error)
        return false
      }
    },

    // JWT callback: embed user context into the token
    async jwt({ token, user, account }) {
      try {
        // On initial sign-in, set user context
        if (user) {
          token.userId = user.id
          token.email = user.email
          token.organizationId = (user as any).organizationId || ''
        }

        // For OAuth, if user was just created or linked, update token
        if (account?.provider === 'google' || account?.provider === 'azure-ad') {
          // Fetch the full user to get latest info
          const fullUser = await rawPrisma.user.findFirst({
            where: { email: token.email as string, deletedAt: null },
            select: {
              id: true,
              email: true,
              organizationId: true,
            },
          })

          if (fullUser) {
            token.userId = fullUser.id
            token.email = fullUser.email
            token.organizationId = fullUser.organizationId
          }
        }

        return token
      } catch (error) {
        console.error('JWT callback error:', error)
        return token
      }
    },

    // Session callback: expose user context in the session
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.userId
        ;(session.user as any).organizationId = token.organizationId
      }
      return session
    },
  },

  // Event handlers (optional)
  events: {
    async signIn({ user, account }) {
      console.log(`User ${user.email} signed in via ${account?.provider || 'credentials'}`)
    },
    async signOut() {
      console.log('User signed out')
    },
  },

  // Trust host (important for production)
  trustHost: !!process.env.NEXTAUTH_URL || process.env.NODE_ENV === 'production',

  // Secret for signing tokens (must be set)
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
}

export default authConfig
