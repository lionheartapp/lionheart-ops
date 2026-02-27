/**
 * Auth.js Route Handler
 *
 * Handles all NextAuth authentication routes.
 * Exports GET and POST handlers for sign-in, sign-out, callbacks, etc.
 *
 * NOTE: Requires `npm install next-auth@beta` to resolve types.
 */

// @ts-nocheck — next-auth types available after npm install
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth-config'

const handler = NextAuth(authConfig)

export { handler as GET, handler as POST }
