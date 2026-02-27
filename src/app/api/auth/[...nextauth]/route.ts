/**
 * Auth.js Route Handler
 *
 * Handles all NextAuth authentication routes.
 * Exports GET and POST handlers for sign-in, sign-out, callbacks, etc.
 */

import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth-config'

const { handlers } = NextAuth(authConfig)

export const { GET, POST } = handlers
