/**
 * Event PDF generation utilities using jsPDF.
 * Client-side only — never import on server.
 *
 * Accepts JsPDF constructor function to avoid SSR issues
 * (same pattern as label-utils.ts).
 *
 * Six formats:
 * 1. Bus Manifest     — per-bus passenger table with medical flags
 * 2. Cabin Roster     — counselor roster with photo grid
 * 3. Medical Summary  — FERPA-gated table of allergies/medications/emergency contacts
 * 4. Emergency Contacts — participant + emergency contact table
 * 5. Activity Roster  — per-activity participant list
 * 6. Check-In Sheet   — manual check-in grid with checkboxes
 */

// ─── JsPDF Type ───────────────────────────────────────────────────────────────────

/**
 * Minimal jsPDF interface (accepted as constructor parameter).
 * Avoids top-level import so this module is safe to bundle without side effects.
 */
export type JsPDFInstance = {
  setFontSize: (size: number) => void
  setFont: (font: string, style?: string) => void
  setTextColor: (r: number, g: number, b: number) => void
  setFillColor: (r: number, g: number, b: number) => void
  setDrawColor: (r: number, g: number, b: number) => void
  setLineWidth: (width: number) => void
  text: (text: string, x: number, y: number, options?: { align?: string }) => void
  line: (x1: number, y1: number, x2: number, y2: number) => void
  rect: (x: number, y: number, w: number, h: number, style?: string) => void
  addImage: (data: string, format: string, x: number, y: number, w: number, h: number) => void
  addPage: () => void
  save: (filename: string) => void
  output: (type: string) => string
  internal: { pageSize: { width: number; height: number } }
  getNumberOfPages: () => number
  setPage: (pageNumber: number) => void
}

export type JsPDFConstructor = new (opts: object) => JsPDFInstance

// ─── Shared Layout Constants ───────────────────────────────────────────────────────

const MARGIN = 36       // 0.5" margins
const PAGE_WIDTH = 612  // 8.5"
const PAGE_HEIGHT = 792 // 11"
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

// ─── Shared Helpers ────────────────────────────────────────────────────────────────

function addPageHeader(
  doc: JsPDFInstance,
  eventName: string,
  dateStr: string,
  sectionTitle: string,
  logoDataUrl?: string | null
) {
  let x = MARGIN
  const y = MARGIN

  // Logo
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', x, y, 32, 32)
      x += 40
    } catch {
      // Ignore logo errors
    }
  }

  // Event name (title 16pt)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(20, 20, 20)
  doc.text(eventName, x, y + 14)

  // Date
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(dateStr, x, y + 26)

  // Section title (12pt)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(40, 40, 40)
  doc.text(sectionTitle, MARGIN, y + 50)

  // Divider line
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y + 56, PAGE_WIDTH - MARGIN, y + 56)

  return y + 66 // return cursor Y position below header
}

function addPageNumbers(doc: JsPDFInstance) {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(160, 160, 160)
    doc.text(
      `Page ${i} of ${total}`,
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 18,
      { align: 'center' }
    )
  }
}

function addTableHeader(
  doc: JsPDFInstance,
  y: number,
  cols: { label: string; x: number; width: number }[]
) {
  doc.setFillColor(240, 240, 245)
  doc.rect(MARGIN, y, CONTENT_WIDTH, 14, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(60, 60, 80)

  for (const col of cols) {
    doc.text(col.label.toUpperCase(), col.x + 4, y + 9)
  }

  return y + 14
}

function drawRow(
  doc: JsPDFInstance,
  y: number,
  cells: { text: string; x: number; width: number; bold?: boolean; color?: [number, number, number] }[],
  rowH = 16,
  bg?: [number, number, number]
) {
  if (bg) {
    doc.setFillColor(...bg)
    doc.rect(MARGIN, y, CONTENT_WIDTH, rowH, 'F')
  }

  for (const cell of cells) {
    doc.setFont('helvetica', cell.bold ? 'bold' : 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...(cell.color ?? [40, 40, 40]))
    // Truncate text if too wide
    const maxChars = Math.floor(cell.width / 6)
    const display = cell.text.length > maxChars ? cell.text.slice(0, maxChars - 2) + '…' : cell.text
    doc.text(display, cell.x + 4, y + rowH - 5)
  }

  // Row separator
  doc.setDrawColor(230, 230, 230)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y + rowH, PAGE_WIDTH - MARGIN, y + rowH)

  return y + rowH
}

function checkPageBreak(doc: JsPDFInstance, y: number, needed = 20): number {
  if (y + needed > PAGE_HEIGHT - MARGIN - 20) {
    doc.addPage()
    return MARGIN + 20
  }
  return y
}

// ─── 1. Bus Manifest ────────────────────────────────────────────────────────────────

export interface BusManifestData {
  eventName: string
  date: string
  logo?: string | null
  groups: Array<{
    name: string
    passengers: Array<{
      name: string
      grade: string | null
      medicalFlags: boolean
    }>
  }>
}

export function generateBusManifest(JsPDF: JsPDFConstructor, data: BusManifestData): JsPDFInstance {
  const doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })

  const cols = [
    { label: '#', x: MARGIN, width: 28 },
    { label: 'Name', x: MARGIN + 28, width: 260 },
    { label: 'Grade', x: MARGIN + 288, width: 80 },
    { label: 'Medical', x: MARGIN + 368, width: CONTENT_WIDTH - 368 },
  ]

  let isFirstBus = true
  for (const group of data.groups) {
    if (!isFirstBus) doc.addPage()
    isFirstBus = false

    let y = addPageHeader(doc, data.eventName, data.date, `Bus Manifest — ${group.name}`, data.logo)
    y = addTableHeader(doc, y, cols)

    group.passengers.forEach((p, i) => {
      y = checkPageBreak(doc, y)
      y = drawRow(doc, y, [
        { text: String(i + 1), x: cols[0].x, width: cols[0].width, color: [120, 120, 120] },
        { text: p.name, x: cols[1].x, width: cols[1].width },
        { text: p.grade ?? '—', x: cols[2].x, width: cols[2].width, color: [80, 80, 120] },
        {
          text: p.medicalFlags ? '⚠ Medical' : '',
          x: cols[3].x,
          width: cols[3].width,
          color: p.medicalFlags ? [200, 40, 40] : [40, 40, 40],
          bold: p.medicalFlags,
        },
      ])
    })
  }

  addPageNumbers(doc)
  return doc
}

// ─── 2. Cabin Roster ────────────────────────────────────────────────────────────────

export interface CabinRosterData {
  eventName: string
  date: string
  logo?: string | null
  groups: Array<{
    name: string
    leader: string | null
    participants: Array<{
      name: string
      grade: string | null
    }>
  }>
}

export function generateCabinRoster(JsPDF: JsPDFConstructor, data: CabinRosterData): JsPDFInstance {
  const doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })

  const cols = [
    { label: '#', x: MARGIN, width: 28 },
    { label: 'Name', x: MARGIN + 28, width: 320 },
    { label: 'Grade', x: MARGIN + 348, width: CONTENT_WIDTH - 348 },
  ]

  let isFirst = true
  for (const group of data.groups) {
    if (!isFirst) doc.addPage()
    isFirst = false

    let y = addPageHeader(
      doc,
      data.eventName,
      data.date,
      `Cabin Roster — ${group.name}`,
      data.logo
    )

    // Leader name
    if (group.leader) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(80, 80, 80)
      doc.text(`Counselor / Leader: ${group.leader}`, MARGIN, y)
      y += 18
    }

    y = addTableHeader(doc, y, cols)

    group.participants.forEach((p, i) => {
      y = checkPageBreak(doc, y)
      const bg: [number, number, number] | undefined =
        i % 2 === 0 ? [250, 250, 252] : undefined
      y = drawRow(
        doc,
        y,
        [
          { text: String(i + 1), x: cols[0].x, width: cols[0].width, color: [120, 120, 120] },
          { text: p.name, x: cols[1].x, width: cols[1].width },
          { text: p.grade ?? '—', x: cols[2].x, width: cols[2].width, color: [80, 80, 120] },
        ],
        16,
        bg
      )
    })
  }

  addPageNumbers(doc)
  return doc
}

// ─── 3. Medical Summary ────────────────────────────────────────────────────────────

export interface MedicalSummaryData {
  eventName: string
  date: string
  logo?: string | null
  participants: Array<{
    name: string
    allergies: string | null
    medications: string | null
    medicalNotes: string | null
    emergencyName: string | null
    emergencyPhone: string | null
  }>
}

export function generateMedicalSummary(
  JsPDF: JsPDFConstructor,
  data: MedicalSummaryData
): JsPDFInstance {
  const doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })

  const cols = [
    { label: 'Name', x: MARGIN, width: 140 },
    { label: 'Allergies', x: MARGIN + 140, width: 140 },
    { label: 'Medications', x: MARGIN + 280, width: 120 },
    { label: 'Emergency Contact', x: MARGIN + 400, width: CONTENT_WIDTH - 400 },
  ]

  let y = addPageHeader(doc, data.eventName, data.date, 'Medical Summary — CONFIDENTIAL', data.logo)

  // Confidential notice
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(200, 40, 40)
  doc.text('FERPA PROTECTED — Do not distribute. For authorized event staff only.', MARGIN, y)
  y += 14

  y = addTableHeader(doc, y, cols)

  for (const p of data.participants) {
    const hasMeds = !!(p.medications?.trim())
    y = checkPageBreak(doc, y, 22)

    const bg: [number, number, number] | undefined = hasMeds ? [255, 248, 248] : undefined
    const emergencyStr = p.emergencyName
      ? `${p.emergencyName}${p.emergencyPhone ? ` · ${p.emergencyPhone}` : ''}`
      : '—'

    y = drawRow(
      doc,
      y,
      [
        { text: p.name, x: cols[0].x, width: cols[0].width, bold: hasMeds },
        { text: p.allergies ?? '—', x: cols[1].x, width: cols[1].width, color: p.allergies ? [180, 60, 60] : [140, 140, 140] },
        { text: p.medications ?? '—', x: cols[2].x, width: cols[2].width, color: hasMeds ? [160, 40, 40] : [140, 140, 140], bold: hasMeds },
        { text: emergencyStr, x: cols[3].x, width: cols[3].width, color: [60, 60, 80] },
      ],
      18,
      bg
    )
  }

  addPageNumbers(doc)
  return doc
}

// ─── 4. Emergency Contacts ─────────────────────────────────────────────────────────

export interface EmergencyContactsData {
  eventName: string
  date: string
  logo?: string | null
  participants: Array<{
    name: string
    grade: string | null
    emergencyName: string | null
    emergencyPhone: string | null
    emergencyRelation: string | null
  }>
}

export function generateEmergencyContacts(
  JsPDF: JsPDFConstructor,
  data: EmergencyContactsData
): JsPDFInstance {
  const doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })

  const cols = [
    { label: 'Participant', x: MARGIN, width: 160 },
    { label: 'Grade', x: MARGIN + 160, width: 60 },
    { label: 'Contact Name', x: MARGIN + 220, width: 150 },
    { label: 'Phone', x: MARGIN + 370, width: 120 },
    { label: 'Relation', x: MARGIN + 490, width: CONTENT_WIDTH - 490 },
  ]

  let y = addPageHeader(doc, data.eventName, data.date, 'Emergency Contacts', data.logo)
  y = addTableHeader(doc, y, cols)

  for (const p of data.participants) {
    y = checkPageBreak(doc, y)
    y = drawRow(doc, y, [
      { text: p.name, x: cols[0].x, width: cols[0].width },
      { text: p.grade ?? '—', x: cols[1].x, width: cols[1].width, color: [80, 80, 120] },
      { text: p.emergencyName ?? '—', x: cols[2].x, width: cols[2].width },
      { text: p.emergencyPhone ?? '—', x: cols[3].x, width: cols[3].width, color: [40, 100, 180] },
      { text: p.emergencyRelation ?? '—', x: cols[4].x, width: cols[4].width, color: [100, 100, 100] },
    ])
  }

  addPageNumbers(doc)
  return doc
}

// ─── 5. Activity Roster ────────────────────────────────────────────────────────────

export interface ActivityRosterData {
  eventName: string
  date: string
  logo?: string | null
  activities: Array<{
    name: string
    time?: string | null
    location?: string | null
    participants: Array<{
      name: string
      grade: string | null
    }>
  }>
}

export function generateActivityRoster(
  JsPDF: JsPDFConstructor,
  data: ActivityRosterData
): JsPDFInstance {
  const doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })

  let isFirst = true
  for (const activity of data.activities) {
    if (!isFirst) doc.addPage()
    isFirst = false

    let y = addPageHeader(
      doc,
      data.eventName,
      data.date,
      `Activity Roster — ${activity.name}`,
      data.logo
    )

    // Time + location
    if (activity.time || activity.location) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      const meta = [activity.time, activity.location].filter(Boolean).join(' · ')
      doc.text(meta, MARGIN, y)
      y += 16
    }

    const cols = [
      { label: '#', x: MARGIN, width: 28 },
      { label: 'Name', x: MARGIN + 28, width: 340 },
      { label: 'Grade', x: MARGIN + 368, width: CONTENT_WIDTH - 368 },
    ]

    y = addTableHeader(doc, y, cols)

    activity.participants.forEach((p, i) => {
      y = checkPageBreak(doc, y)
      const bg: [number, number, number] | undefined =
        i % 2 === 0 ? [250, 250, 252] : undefined
      y = drawRow(
        doc,
        y,
        [
          { text: String(i + 1), x: cols[0].x, width: cols[0].width, color: [120, 120, 120] },
          { text: p.name, x: cols[1].x, width: cols[1].width },
          { text: p.grade ?? '—', x: cols[2].x, width: cols[2].width, color: [80, 80, 120] },
        ],
        16,
        bg
      )
    })
  }

  addPageNumbers(doc)
  return doc
}

// ─── 6. Check-In Sheet ─────────────────────────────────────────────────────────────

export interface CheckInSheetData {
  eventName: string
  date: string
  logo?: string | null
  participants: Array<{
    name: string
    grade: string | null
    group?: string | null
  }>
}

export function generateCheckInSheet(
  JsPDF: JsPDFConstructor,
  data: CheckInSheetData
): JsPDFInstance {
  const doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })

  const cols = [
    { label: '#', x: MARGIN, width: 28 },
    { label: 'Name', x: MARGIN + 28, width: 220 },
    { label: 'Grade', x: MARGIN + 248, width: 60 },
    { label: 'Group', x: MARGIN + 308, width: 140 },
    { label: 'Check In', x: MARGIN + 448, width: CONTENT_WIDTH - 448 },
  ]

  let y = addPageHeader(doc, data.eventName, data.date, 'Check-In Sheet', data.logo)
  y = addTableHeader(doc, y, cols)

  data.participants.forEach((p, i) => {
    y = checkPageBreak(doc, y, 22)
    const bg: [number, number, number] | undefined =
      i % 2 === 0 ? [250, 250, 252] : undefined

    y = drawRow(
      doc,
      y,
      [
        { text: String(i + 1), x: cols[0].x, width: cols[0].width, color: [120, 120, 120] },
        { text: p.name, x: cols[1].x, width: cols[1].width },
        { text: p.grade ?? '—', x: cols[2].x, width: cols[2].width, color: [80, 80, 120] },
        { text: p.group ?? '—', x: cols[3].x, width: cols[3].width, color: [60, 60, 100] },
        { text: '', x: cols[4].x, width: cols[4].width },
      ],
      22,
      bg
    )

    // Draw checkbox in the Check In column
    const checkboxY = y - 22 + 5
    doc.setDrawColor(160, 160, 160)
    doc.setLineWidth(0.5)
    doc.rect(cols[4].x + 4, checkboxY, 12, 12)
  })

  addPageNumbers(doc)
  return doc
}
