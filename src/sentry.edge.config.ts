import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.NODE_ENV,
  sendDefaultPii: false, // FERPA: K-12 platform — never auto-capture PII
  enabled: !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
})
