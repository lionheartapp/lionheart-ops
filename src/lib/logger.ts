// FERPA-SAFE LOGGING DISCIPLINE
// NEVER log: req.body, user email, user name, student data
// ALWAYS log: orgId, route, method, status, duration (timing)
// Use Sentry (not logger) for error stack traces

interface Logger {
  info(obj: Record<string, unknown>, msg?: string): void
  info(msg: string): void
  warn(obj: Record<string, unknown>, msg?: string): void
  warn(msg: string): void
  error(obj: Record<string, unknown>, msg?: string): void
  error(msg: string): void
  debug(obj: Record<string, unknown>, msg?: string): void
  debug(msg: string): void
  fatal(obj: Record<string, unknown>, msg?: string): void
  fatal(msg: string): void
  child(bindings: Record<string, unknown>): Logger
}

function createConsoleLogger(bindings: Record<string, unknown> = {}): Logger {
  const prefix = Object.keys(bindings).length > 0
    ? `[${Object.entries(bindings).map(([k, v]) => `${k}=${v}`).join(' ')}] `
    : ''

  const log = (level: string, method: (...args: unknown[]) => void) =>
    (objOrMsg: Record<string, unknown> | string, msg?: string) => {
      if (typeof objOrMsg === 'string') {
        method(`${prefix}${objOrMsg}`)
      } else {
        const context = Object.entries(objOrMsg)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(' ')
        method(`${prefix}${msg ?? level} ${context}`)
      }
    }

  return {
    info: log('INFO', console.log),
    warn: log('WARN', console.warn),
    error: log('ERROR', console.error),
    debug: log('DEBUG', console.debug),
    fatal: log('FATAL', console.error),
    child(childBindings: Record<string, unknown>): Logger {
      return createConsoleLogger({ ...bindings, ...childBindings })
    },
  }
}

function createPinoLogger(): Logger {
  // Dynamic require avoids Turbopack trying to resolve thread-stream at compile time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pino = require('pino')
  return pino({ level: 'info' }) as Logger
}

export const logger: Logger = process.env.NODE_ENV === 'production'
  ? createPinoLogger()
  : createConsoleLogger()
