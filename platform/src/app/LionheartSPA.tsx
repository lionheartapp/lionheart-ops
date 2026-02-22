'use client'

import dynamic from 'next/dynamic'

const AppRouter = dynamic(
  () => import('@/lionheart/AppRouter').then((m) => m.default),
  { ssr: false }
)

/**
 * Renders the full Lionheart SPA (landing, login, signup, app) so that
 * the marketing landing page and auth flow work when Next.js serves
 * /, /login, /signup, or /app. BrowserRouter reads the current URL
 * and shows the correct route.
 */
export default function LionheartSPA() {
  return <AppRouter />
}
