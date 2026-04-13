import { describe, it, expect, vi } from 'vitest'
import {
  generateBusManifest,
  generateCabinRoster,
  generateMedicalSummary,
  generateEmergencyContacts,
  generateActivityRoster,
  generateCheckInSheet,
  type JsPDFConstructor,
} from '@/lib/event-pdf-utils'

function createMockJsPDF() {
  const doc = {
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    setFillColor: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    text: vi.fn(),
    line: vi.fn(),
    rect: vi.fn(),
    addImage: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
    output: vi.fn(() => 'mock-pdf'),
    internal: { pageSize: { width: 612, height: 792 } },
    getNumberOfPages: vi.fn(() => 1),
    setPage: vi.fn(),
  }
  const MockJsPDF = class {
    constructor(public opts: object) {
      Object.assign(this, doc)
    }
  } as unknown as JsPDFConstructor
  return { MockJsPDF, doc }
}

// ── Bus Manifest ─────────────────────────────────────────────────────────────

describe('generateBusManifest', () => {
  it('creates document and renders passengers', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    const result = generateBusManifest(MockJsPDF, {
      eventName: 'Field Trip',
      date: 'April 10, 2026',
      groups: [{
        name: 'Bus A',
        passengers: [
          { name: 'Alice', grade: '10', medicalFlags: false },
          { name: 'Bob', grade: '11', medicalFlags: true },
        ],
      }],
    })
    expect(result).toBeTruthy()
    expect(doc.text).toHaveBeenCalled()
  })

  it('adds page per bus group', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    generateBusManifest(MockJsPDF, {
      eventName: 'Trip',
      date: 'Apr 10',
      groups: [
        { name: 'Bus A', passengers: [{ name: 'A', grade: '10', medicalFlags: false }] },
        { name: 'Bus B', passengers: [{ name: 'B', grade: '11', medicalFlags: false }] },
      ],
    })
    expect(doc.addPage).toHaveBeenCalledTimes(1) // second bus triggers addPage
  })

  it('renders medical flag for flagged passengers', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    generateBusManifest(MockJsPDF, {
      eventName: 'Trip',
      date: 'Apr 10',
      groups: [{ name: 'Bus A', passengers: [{ name: 'Alice', grade: '10', medicalFlags: true }] }],
    })
    const textCalls = doc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textCalls.some((t) => typeof t === 'string' && t.includes('Medical'))).toBe(true)
  })
})

// ── Cabin Roster ─────────────────────────────────────────────────────────────

describe('generateCabinRoster', () => {
  it('renders cabin with leader name', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    generateCabinRoster(MockJsPDF, {
      eventName: 'Camp',
      date: 'Jun 1',
      groups: [{
        name: 'Cabin 1',
        leader: 'Ms. Smith',
        participants: [{ name: 'Alice', grade: '9' }],
      }],
    })
    const textCalls = doc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textCalls.some((t) => typeof t === 'string' && t.includes('Ms. Smith'))).toBe(true)
  })

  it('adds page per cabin', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    generateCabinRoster(MockJsPDF, {
      eventName: 'Camp',
      date: 'Jun 1',
      groups: [
        { name: 'Cabin 1', leader: null, participants: [{ name: 'A', grade: '9' }] },
        { name: 'Cabin 2', leader: null, participants: [{ name: 'B', grade: '10' }] },
      ],
    })
    expect(doc.addPage).toHaveBeenCalledTimes(1)
  })
})

// ── Medical Summary ──────────────────────────────────────────────────────────

describe('generateMedicalSummary', () => {
  it('renders FERPA notice', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    generateMedicalSummary(MockJsPDF, {
      eventName: 'Camp',
      date: 'Jun 1',
      participants: [{ name: 'Alice', allergies: 'Peanuts', medications: null, medicalNotes: null, emergencyName: 'Jane', emergencyPhone: '555-1234' }],
    })
    const textCalls = doc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textCalls.some((t) => typeof t === 'string' && t.includes('FERPA'))).toBe(true)
  })

  it('renders participant allergies', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    generateMedicalSummary(MockJsPDF, {
      eventName: 'Camp',
      date: 'Jun 1',
      participants: [{ name: 'Alice', allergies: 'Peanuts', medications: null, medicalNotes: null, emergencyName: null, emergencyPhone: null }],
    })
    const textCalls = doc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textCalls.some((t) => typeof t === 'string' && t.includes('Peanuts'))).toBe(true)
  })
})

// ── Emergency Contacts ───────────────────────────────────────────────────────

describe('generateEmergencyContacts', () => {
  it('renders emergency contact info', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    generateEmergencyContacts(MockJsPDF, {
      eventName: 'Trip',
      date: 'Apr 10',
      participants: [{
        name: 'Alice',
        grade: '10',
        emergencyName: 'Jane Doe',
        emergencyPhone: '555-0000',
        emergencyRelation: 'Mother',
      }],
    })
    const textCalls = doc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textCalls.some((t) => typeof t === 'string' && t.includes('Jane Doe'))).toBe(true)
    expect(textCalls.some((t) => typeof t === 'string' && t.includes('555-0000'))).toBe(true)
  })
})

// ── Activity Roster ──────────────────────────────────────────────────────────

describe('generateActivityRoster', () => {
  it('renders activity with time and location', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    generateActivityRoster(MockJsPDF, {
      eventName: 'Camp',
      date: 'Jun 1',
      activities: [{
        name: 'Archery',
        time: '2:00 PM',
        location: 'Range B',
        participants: [{ name: 'Alice', grade: '9' }],
      }],
    })
    const textCalls = doc.text.mock.calls.map((c: unknown[]) => c[0])
    expect(textCalls.some((t) => typeof t === 'string' && t.includes('2:00 PM'))).toBe(true)
  })

  it('adds page per activity', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    generateActivityRoster(MockJsPDF, {
      eventName: 'Camp',
      date: 'Jun 1',
      activities: [
        { name: 'Archery', participants: [{ name: 'A', grade: '9' }] },
        { name: 'Swimming', participants: [{ name: 'B', grade: '10' }] },
      ],
    })
    expect(doc.addPage).toHaveBeenCalledTimes(1)
  })
})

// ── Check-In Sheet ───────────────────────────────────────────────────────────

describe('generateCheckInSheet', () => {
  it('renders participants with checkboxes', () => {
    const { MockJsPDF, doc } = createMockJsPDF()
    generateCheckInSheet(MockJsPDF, {
      eventName: 'Event',
      date: 'Apr 10',
      participants: [
        { name: 'Alice', grade: '10', group: 'A' },
        { name: 'Bob', grade: '11', group: 'B' },
      ],
    })
    // rect called for: table header bg, row bg (even rows), checkboxes
    expect(doc.rect).toHaveBeenCalled()
    expect(doc.text).toHaveBeenCalled()
  })

  it('returns a document instance', () => {
    const { MockJsPDF } = createMockJsPDF()
    const result = generateCheckInSheet(MockJsPDF, {
      eventName: 'Event',
      date: 'Apr 10',
      participants: [{ name: 'Alice', grade: '10' }],
    })
    expect(result).toBeTruthy()
  })
})
