import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }) },
}))

import { renderEmail, type EmailTemplate } from '@/lib/email/templates'

describe('renderEmail', () => {
  it('returns html, subject, and text properties', () => {
    const result = renderEmail('welcome', { orgName: 'Demo School', setupLink: 'https://example.com/setup' })
    expect(result).toHaveProperty('html')
    expect(result).toHaveProperty('subject')
    expect(result).toHaveProperty('text')
  })

  it('welcome template has correct subject', () => {
    const result = renderEmail('welcome', { orgName: 'Acme' })
    expect(result.subject).toBe('Welcome to Lionheart')
  })

  it('interpolates variables into subject', () => {
    const result = renderEmail('event_updated', { eventTitle: 'Spring Gala' })
    expect(result.subject).toContain('Spring Gala')
  })

  it('interpolates variables into text body', () => {
    const result = renderEmail('welcome', { orgName: 'Lincoln Academy', setupLink: 'https://example.com' })
    expect(result.text).toContain('Lincoln Academy')
    expect(result.text).toContain('https://example.com')
  })

  it('interpolates variables into HTML', () => {
    const result = renderEmail('welcome', { orgName: 'Lincoln Academy', setupLink: 'https://example.com/setup' })
    expect(result.html).toContain('Lincoln Academy')
  })

  it('HTML output is valid (contains doctype and html tags)', () => {
    const result = renderEmail('welcome', { orgName: 'Test' })
    expect(result.html).toContain('<!doctype html>')
    expect(result.html).toContain('</html>')
  })

  it('password_setup template targets invited users', () => {
    const result = renderEmail('password_setup', { orgName: 'Demo', setupLink: 'https://link' })
    expect(result.subject).toContain('invited')
  })

  it('password_reset template has correct subject', () => {
    const result = renderEmail('password_reset', {})
    expect(result.subject).toBe('Reset your password')
  })

  it('event_approved includes event title in subject', () => {
    const result = renderEmail('event_approved', { eventTitle: 'Annual Fest', channelName: 'Admin' })
    expect(result.subject).toContain('Annual Fest')
    expect(result.subject).toContain('approved')
  })

  it('event_rejected includes event title', () => {
    const result = renderEmail('event_rejected', { eventTitle: 'Budget Meeting', reason: 'Conflict' })
    expect(result.subject).toContain('Budget Meeting')
  })

  it('maintenance templates interpolate ticket info', () => {
    const result = renderEmail('maintenance_submitted', {
      ticketNumber: 'WO-001',
      ticketTitle: 'Broken Pipe',
      priority: 'Urgent',
      ticketLink: 'https://example.com/ticket/1',
    })
    expect(result.text).toContain('WO-001')
    expect(result.text).toContain('Broken Pipe')
  })

  it('IT ticket templates interpolate correctly', () => {
    const result = renderEmail('it_ticket_submitted', {
      ticketNumber: 'IT-100',
      ticketTitle: 'Laptop issue',
      category: 'Hardware',
      ticketLink: 'https://example.com/it/100',
    })
    expect(result.text).toContain('IT-100')
    expect(result.text).toContain('Hardware')
  })

  it('handles missing optional vars with empty string', () => {
    const result = renderEmail('event_cancelled', { eventTitle: 'Cancelled Event' })
    // Should not throw, missing vars just become empty
    expect(result.text).toContain('Cancelled Event')
  })

  it('throws for unknown template', () => {
    expect(() => renderEmail('nonexistent_template' as EmailTemplate, {})).toThrow()
  })

  const allTemplates: EmailTemplate[] = [
    'welcome', 'email_verification', 'password_setup', 'password_reset',
    'event_updated', 'event_approved', 'event_rejected', 'event_cancelled', 'event_invite',
    'maintenance_submitted', 'maintenance_assigned', 'maintenance_claimed',
    'maintenance_in_progress', 'maintenance_on_hold', 'maintenance_qa_ready',
    'maintenance_done', 'maintenance_urgent', 'maintenance_stale', 'maintenance_qa_rejected',
    'maintenance_repeat_repair', 'maintenance_cost_threshold', 'maintenance_end_of_life',
    'it_ticket_submitted', 'it_ticket_assigned', 'it_ticket_in_progress',
    'it_ticket_on_hold', 'it_ticket_done', 'it_ticket_urgent',
  ]

  it('all templates render without error', () => {
    for (const template of allTemplates) {
      expect(() => renderEmail(template, { ticketNumber: 'T-1', ticketTitle: 'Test', orgName: 'Org' })).not.toThrow()
    }
  })
})
