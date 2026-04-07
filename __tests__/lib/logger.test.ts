import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createConsoleLogger } from '@/lib/logger'

describe('createConsoleLogger', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('API surface', () => {
    it('exposes info, warn, error, debug, fatal, and child', () => {
      const log = createConsoleLogger()
      expect(typeof log.info).toBe('function')
      expect(typeof log.warn).toBe('function')
      expect(typeof log.error).toBe('function')
      expect(typeof log.debug).toBe('function')
      expect(typeof log.fatal).toBe('function')
      expect(typeof log.child).toBe('function')
    })
  })

  describe('string signature', () => {
    it('info routes to console.log', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      createConsoleLogger().info('hello')
      expect(spy).toHaveBeenCalledWith('hello')
    })

    it('warn routes to console.warn', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      createConsoleLogger().warn('caution')
      expect(spy).toHaveBeenCalledWith('caution')
    })

    it('error routes to console.error', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      createConsoleLogger().error('bad')
      expect(spy).toHaveBeenCalledWith('bad')
    })

    it('debug routes to console.debug', () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      createConsoleLogger().debug('trace')
      expect(spy).toHaveBeenCalledWith('trace')
    })

    it('fatal routes to console.error', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      createConsoleLogger().fatal('crash')
      expect(spy).toHaveBeenCalledWith('crash')
    })
  })

  describe('object + message signature', () => {
    it('formats key-value context with message', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      createConsoleLogger().info({ orgId: 'org-1', status: 200 }, 'request')
      expect(spy).toHaveBeenCalledWith('request orgId="org-1" status=200')
    })

    it('falls back to level name when message is omitted', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      createConsoleLogger().warn({ route: '/api/test' })
      expect(spy).toHaveBeenCalledWith('WARN route="/api/test"')
    })
  })

  describe('child()', () => {
    it('prefixes output with bindings', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const child = createConsoleLogger().child({ route: '/api/foo' })
      child.info('hit')
      expect(spy).toHaveBeenCalledWith('[route=/api/foo] hit')
    })

    it('merges bindings on nested child()', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const nested = createConsoleLogger()
        .child({ route: '/api/foo' })
        .child({ method: 'GET' })
      nested.info('hit')
      expect(spy).toHaveBeenCalledWith('[route=/api/foo method=GET] hit')
    })

    it('child preserves object formatting with prefix', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const child = createConsoleLogger().child({ svc: 'auth' })
      child.error({ code: 401 }, 'denied')
      expect(spy).toHaveBeenCalledWith('[svc=auth] denied code=401')
    })

    it('child returns independent logger — does not mutate parent', () => {
      const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {})
      const parent = createConsoleLogger()
      parent.child({ extra: true })
      parent.info('still clean')
      expect(spyLog).toHaveBeenCalledWith('still clean')
    })
  })
})
