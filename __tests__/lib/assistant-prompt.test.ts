/**
 * Unit tests for AI assistant system prompt builder.
 *
 * Validates that buildSystemPrompt produces correct dates, timezone info,
 * and 7-day reference labels. These catch the off-by-one bug at the prompt
 * layer — ensuring Leo never reports the wrong date to users.
 */
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '@/lib/services/ai/assistant.service'

const TOOLS = ['query_maintenance_stats', 'list_upcoming_events', 'create_maintenance_ticket']

describe('buildSystemPrompt — date accuracy', () => {
  it('contains the correct date for a midday timestamp', () => {
    const prompt = buildSystemPrompt(
      TOOLS, 'Lincoln Academy', 'Jane Admin', 'super-admin',
      '2024-03-20T18:00:00.000Z', // 12 PM CST
      undefined,
      'America/Chicago'
    )
    expect(prompt).toContain('March 20, 2024')
    // The "Today" display line should be March 20, not off-by-one
    const todayLine = prompt.split('\n').find(l => l.includes('← TODAY'))
    expect(todayLine).toContain('March 20')
  })

  it('contains correct date when UTC is ahead of local timezone', () => {
    // March 2024 is CDT (UTC-5). 4:00 AM UTC = 11:00 PM CDT March 19
    const prompt = buildSystemPrompt(
      TOOLS, 'Lincoln Academy', 'Jane Admin', 'super-admin',
      '2024-03-20T04:00:00.000Z',
      undefined,
      'America/Chicago'
    )
    // The prompt should show March 19 (the local date), NOT March 20 (UTC date)
    expect(prompt).toContain('March 19, 2024')
  })

  it('contains TODAY and TOMORROW labels in 7-day reference', () => {
    const prompt = buildSystemPrompt(
      TOOLS, 'Test School', 'User', 'admin',
      '2024-03-20T18:00:00.000Z',
      undefined,
      'America/Chicago'
    )
    expect(prompt).toContain('← TODAY')
    expect(prompt).toContain('← TOMORROW')
  })

  it('TODAY label is on the correct local date', () => {
    // March 2024 is CDT (UTC-5). 3:00 AM UTC = 10:00 PM CDT March 19
    const prompt = buildSystemPrompt(
      TOOLS, 'Test School', 'User', 'admin',
      '2024-03-20T03:00:00.000Z',
      undefined,
      'America/Chicago'
    )
    // TODAY should be March 19 in CDT, not March 20
    const todayLine = prompt.split('\n').find(l => l.includes('← TODAY'))
    expect(todayLine).toBeDefined()
    expect(todayLine).toContain('March 19')
  })

  it('TOMORROW label follows TODAY correctly', () => {
    const prompt = buildSystemPrompt(
      TOOLS, 'Test School', 'User', 'admin',
      '2024-03-20T18:00:00.000Z',
      undefined,
      'America/Chicago'
    )
    const lines = prompt.split('\n')
    const todayIdx = lines.findIndex(l => l.includes('← TODAY'))
    const tomorrowIdx = lines.findIndex(l => l.includes('← TOMORROW'))
    expect(tomorrowIdx).toBe(todayIdx + 1)

    // TODAY = March 20, TOMORROW = March 21
    expect(lines[todayIdx]).toContain('March 20')
    expect(lines[tomorrowIdx]).toContain('March 21')
  })

  it('includes timezone and offset in context', () => {
    const prompt = buildSystemPrompt(
      TOOLS, 'Test School', 'User', 'admin',
      '2024-03-20T18:00:00.000Z',
      undefined,
      'America/Chicago'
    )
    expect(prompt).toContain('America/Chicago')
    expect(prompt).toMatch(/UTC offset: [+-]\d{2}:\d{2}/)
  })

  it('handles year boundary correctly', () => {
    // 4:00 AM UTC Jan 1 = 11:00 PM EST Dec 31 (Eastern is UTC-5 in winter)
    const prompt = buildSystemPrompt(
      TOOLS, 'Test School', 'User', 'admin',
      '2025-01-01T04:00:00.000Z',
      undefined,
      'America/New_York'
    )
    // Should show Dec 31, 2024 (local date in Eastern)
    expect(prompt).toContain('December 31, 2024')
  })
})

describe('buildSystemPrompt — capabilities', () => {
  it('lists maintenance capability when tool is available', () => {
    const prompt = buildSystemPrompt(
      ['query_maintenance_stats'], 'School', 'User', 'admin',
      '2024-03-20T18:00:00.000Z'
    )
    expect(prompt).toContain('Maintenance analytics')
  })

  it('lists calendar capability when event tools available', () => {
    const prompt = buildSystemPrompt(
      ['list_upcoming_events', 'create_event'], 'School', 'User', 'admin',
      '2024-03-20T18:00:00.000Z'
    )
    expect(prompt).toContain('Calendar')
    expect(prompt).toContain('Create events')
  })

  it('shows generic capability when no tools available', () => {
    const prompt = buildSystemPrompt(
      [], 'School', 'User', 'viewer',
      '2024-03-20T18:00:00.000Z'
    )
    expect(prompt).toContain('General conversation')
  })
})

describe('buildSystemPrompt — context injection', () => {
  it('includes org name and user name', () => {
    const prompt = buildSystemPrompt(
      TOOLS, 'Springfield Elementary', 'Principal Skinner', 'super-admin',
      '2024-03-20T18:00:00.000Z'
    )
    expect(prompt).toContain('Springfield Elementary')
    expect(prompt).toContain('Principal Skinner')
    expect(prompt).toContain('super-admin')
  })

  it('appends personalized context when assembledContext provided', () => {
    const ctx = {
      userProfile: {
        responseLength: 'brief' as const,
        tonePreference: 'casual' as const,
        frequentTopics: ['maintenance'],
        domainExpertise: ['HVAC'],
        communicationStyle: null,
      },
      relevantFacts: [{ factText: 'Prefers email updates', category: 'preference' }],
      recentSummaries: [],
    }
    const prompt = buildSystemPrompt(
      TOOLS, 'School', 'User', 'admin',
      '2024-03-20T18:00:00.000Z',
      ctx,
      'America/Chicago'
    )
    expect(prompt).toContain('What I Know About You')
    expect(prompt).toContain('brief')
    expect(prompt).toContain('Prefers email updates')
  })

  it('does not include personalized section when context is empty', () => {
    const ctx = {
      userProfile: null,
      relevantFacts: [],
      recentSummaries: [],
    }
    const prompt = buildSystemPrompt(
      TOOLS, 'School', 'User', 'admin',
      '2024-03-20T18:00:00.000Z',
      ctx,
      'America/Chicago'
    )
    expect(prompt).not.toContain('What I Know About You')
  })
})

describe('buildSystemPrompt — safety rules', () => {
  it('includes critical date/time rules', () => {
    const prompt = buildSystemPrompt(
      TOOLS, 'School', 'User', 'admin',
      '2024-03-20T18:00:00.000Z'
    )
    expect(prompt).toContain('CRITICAL DATE/TIME RULES')
    expect(prompt).toContain('ALWAYS use the date marked ← TOMORROW')
    expect(prompt).toContain('NEVER output bare dates')
  })

  it('includes safety and privacy rules', () => {
    const prompt = buildSystemPrompt(
      TOOLS, 'School', 'User', 'admin',
      '2024-03-20T18:00:00.000Z'
    )
    expect(prompt).toContain('Safety & Privacy')
    expect(prompt).toContain('Never share another user')
    expect(prompt).toContain('Never fabricate')
  })
})
