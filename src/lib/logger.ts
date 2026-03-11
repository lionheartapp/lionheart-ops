// FERPA-SAFE LOGGING DISCIPLINE
// NEVER log: req.body, user email, user name, student data
// ALWAYS log: orgId, route, method, status, duration (timing)
// Use Sentry (not logger) for error stack traces

import pino from 'pino'

export const logger = process.env.NODE_ENV === 'production'
  ? pino({ level: 'info' })
  : pino({
      transport: { target: 'pino-pretty', options: { colorize: true } },
      level: 'debug',
    })
