import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Sparkles, Calendar, MapPin, Mic, Monitor, Lightbulb, Ticket, LayoutTemplate, Check, Package, Zap, Shield, Thermometer } from 'lucide-react'
import { chatWithGemini, extractEventFieldsWithGemini } from '../services/gemini'

const VOICE_BLUE = '#3b82f6'
/** How long to wait with no speech (after final results) before auto-submitting. */
const SILENCE_DELAY_MS = 5000

/** Remove duplicated phrases and repeated words from speech transcript. */
function dedupeTranscript(text) {
  if (!text || typeof text !== 'string') return text
  let t = text.trim()
  if (!t) return t
  for (let len = Math.floor(t.length / 2); len >= 1; len--) {
    if (t.slice(0, len) === t.slice(len, len + len)) {
      t = t.slice(0, len).trim()
      break
    }
  }
  while (true) {
    const next = t.replace(/\b(\w+)\s+\1\b/gi, '$1').trim()
    if (next === t) break
    t = next
  }
  t = t.replace(/\s+(\S+)\s+\1\s*$/i, ' $1').trim()
  return t
}

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function getNaturalVoice() {
  const voices = typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis.getVoices() : []
  const preferred = voices.find((v) => v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Daniel')) || voices.find((v) => v.lang.startsWith('en')) || voices[0]
  return preferred || null
}

const VENUE_CAPACITY = { Gym: 400, PAC: 350, Cafeteria: 200, Field: 500, 'Main Hall': 300, Auditorium: 450 }
const MOCK_SHADOW_CONFLICT = { date: '2025-03-24', note: 'Custodial staff at mandatory training that afternoon.', suggestion: 'Request a sub-crew for setup and teardown?' }

function formatTime24To12(time24) {
  if (!time24) return '6:30 PM'
  const [h, m] = time24.split(':')
  const hh = parseInt(h, 10)
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh > 12 ? hh - 12 : hh === 0 ? 12 : hh
  return `${h12}:${m || '00'} ${ampm}`
}

// Mock Campus Schedule: Gym on March 24 has conflict until 6:30 PM (used if no calendar events)
const MOCK_CAMPUS_SCHEDULE = [
  { venue: 'Gym', date: '2025-03-24', endTime: '18:30', title: 'Basketball Practice', contact: 'Coach Miller' },
]

// Parking zones per venue — same zone = possible parking pressure when multiple events same day
const VENUE_PARKING_ZONE = {
  Gym: 'Gym / North Lot',
  PAC: 'PAC Lot',
  Cafeteria: 'North Lot',
  Field: 'Field Lot',
  'Main Hall': 'Main Lot',
  Auditorium: 'Main Lot',
  Campus: 'All lots',
}

/** Calendar event or mock entry to a unified schedule row: { venue, date, endTime?, title, contact? } */
function toScheduleRow(ev) {
  const venue = ev.location || ev.venue
  const date = ev.date
  const endTime = ev.endTime || ev.time || '23:59'
  const title = ev.name || ev.title
  const contact = ev.contact || ev.owner
  return { venue, date, endTime, title, contact }
}

/**
 * Check draft against calendar events and mock schedule. Returns { venueConflict, parkingAdvisories }.
 * venueConflict: same venue + date (and overlapping time if available).
 * parkingAdvisories: other events on same date that share the same parking zone (possible parking conflict).
 */
function getConflicts(draft, calendarEvents = []) {
  if (!draft?.date) return { venueConflict: null, parkingAdvisories: [] }
  const dateStr = draft.date
  const venue = (draft.location || '').trim()
  const draftStart = draft.time || '00:00'
  const schedule = [
    ...MOCK_CAMPUS_SCHEDULE.map((s) => ({ ...s, source: 'mock' })),
    ...(calendarEvents || [])
      .filter((e) => e.date === dateStr && (e.location || e.venue))
      .map((e) => ({ ...toScheduleRow(e), source: 'calendar' })),
  ]
  let venueConflict = null
  for (const row of schedule) {
    if (row.venue && row.date === dateStr && row.venue.toLowerCase() === venue.toLowerCase()) {
      venueConflict = row
      break
    }
  }
  const draftZone = venue ? VENUE_PARKING_ZONE[venue] || venue : null
  const parkingAdvisories = []
  if (draftZone && dateStr) {
    for (const row of schedule) {
      if (row.venue?.toLowerCase() === venue?.toLowerCase()) continue
      const zone = row.venue ? VENUE_PARKING_ZONE[row.venue] || row.venue : null
      if (zone && zone === draftZone) {
        parkingAdvisories.push({
          title: row.title,
          venue: row.venue,
          zone,
        })
      }
    }
  }
  return { venueConflict, parkingAdvisories }
}

/** Words that indicate a date, not an event name — don't use as parsed.name */
const DATE_WORDS = /\b(for\s+)?(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+week|this\s+(weekend|saturday|sunday))\b/i
/** Phrases that are clearly not event names (ticketing options, confirmations, etc.) */
const NOT_NAME_PATTERNS = /^(so\s+|no\s+|just\s+|yes\s+|that\s+|it\s+|we\s+|they\s+|the\s+|a\s+|an\s+|open\s+entry|free\s+entry|no\s+tickets|pay\s+what\s+you\s+can)/i
/** Event names we never use (ticketing/signup options mistaken for names) */
const NEVER_USE_AS_NAME = /^(open entry|free entry|no tickets|your event|new event|tbd)$/i
/** User is confirming details are correct — show Approve button */
const CONFIRM_PATTERN = /^(yes|yep|yeah|yup|correct|that'?s\s*it|sounds?\s*good|looks?\s*good|perfect|all\s*good|all\s*set|great|sure|ok(ay)?|confirmed)[\s\!\.\,]*$/i

function toTitleCase(s) {
  if (!s || typeof s !== 'string') return s
  return s.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

function parseUserPrompt(text) {
  const t = (text || '').toLowerCase()
  const event = {
    name: null,
    date: null,
    time: null,
    location: null,
    resources: [],
    eventType: null,
    expectedHeadCount: null,
    tablesRequested: null,
    chairsRequested: null,
    chairsSetup: null,
  }
  const today = new Date()
  // Date: "tomorrow", "today", "march 24th", "3/24"
  if (/\btomorrow\b/i.test(t)) {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    event.date = d.toISOString().slice(0, 10)
  } else if (/\btoday\b/i.test(t)) {
    event.date = today.toISOString().slice(0, 10)
  } else if (/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(t)) {
    const dayMatch = t.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i)
    if (dayMatch) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const target = dayNames.indexOf(dayMatch[1].toLowerCase())
      let daysUntil = (target - today.getDay() + 7) % 7
      if (daysUntil === 0) daysUntil = 7
      const d = new Date(today)
      d.setDate(d.getDate() + daysUntil)
      event.date = d.toISOString().slice(0, 10)
    }
  }
  const monthDayMatch = t.match(/(?:january|jan\.?|february|feb\.?|march|mar\.?|april|apr\.?|may|june|jun\.?|july|jul\.?|august|aug\.?|september|sep\.?|october|oct\.?|november|nov\.?|december|dec\.?)\s*(\d{1,2})(?:st|nd|rd|th)?/i)
  if (monthDayMatch && !event.date) {
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
    const monthName = monthDayMatch[0].replace(/\d|st|nd|rd|th|\s/g, '').toLowerCase().slice(0, 3)
    const monthIdx = months.findIndex((m) => m.startsWith(monthName))
    const day = parseInt(monthDayMatch[1], 10)
    if (monthIdx >= 0 && day >= 1 && day <= 31) {
      const d = new Date(today.getFullYear(), monthIdx, day)
      event.date = d.toISOString().slice(0, 10)
    }
  }
  const slashMatch = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (slashMatch && !event.date) {
    const [m, d, y] = slashMatch.slice(1).map((x) => x && parseInt(x, 10))
    const year = y ? (y < 100 ? 2000 + y : y) : today.getFullYear()
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dt = new Date(year, m - 1, d)
      event.date = dt.toISOString().slice(0, 10)
    }
  }
  // Time: "5pm", "5 pm", "17:00", "9am"
  const timeMatch = t.match(/(\d{1,2})\s*(?:am|pm|:)/i) || t.match(/(\d{1,2})\s*pm/i)
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10)
    const pm = /pm/i.test(t)
    event.time = pm && hour < 12 ? `${hour + 12}:00` : hour === 12 ? '12:00' : hour < 12 ? `${hour}:00` : `${hour}:00`
  }
  if (timeMatch && !event.time) {
    const hour = parseInt(timeMatch[1], 10)
    const am = /am/i.test(t)
    event.time = am && hour === 12 ? '00:00' : am && hour < 12 ? `${hour}:00` : event.time
  }
  // Name — "call it worship night" → "Worship Night", "Its High School Chapel", "event for X", "called X"
  const callItMatch = text.match(/\bcall\s+it\s+(.+?)(?:\s+and|\s+on|\s+at|,|\.|$)/i)
  if (callItMatch) {
    const raw = (callItMatch[1] || '').trim().replace(/\s+and\s+.*$/i, '').trim()
    if (raw && !DATE_WORDS.test(raw) && !NOT_NAME_PATTERNS.test(raw) && !NEVER_USE_AS_NAME.test(raw) && raw.length > 2) {
      event.name = toTitleCase(raw)
    }
  }
  if (!event.name) {
    const itsMatch = text.match(/\b(?:it'?s|its)\s+([^.]+?)(?:\s+and|\s+we|\s+with|,|\.|$)/i)
    if (itsMatch) {
      const raw = (itsMatch[1] || '').trim().replace(/\s+and\s+.*$/i, '').trim()
      if (raw && !DATE_WORDS.test(raw) && !NOT_NAME_PATTERNS.test(raw) && !NEVER_USE_AS_NAME.test(raw) && raw.length > 2) event.name = toTitleCase(raw)
    }
  }
  if (!event.name) {
    const nameMatch = text.match(/(?:event\s+(?:for|called|named)\s+|called\s+|named?\s+)([^.]+?)(?:\s+and|\s+on|\s+at|\.|$)/i) || text.match(/night to shine/i)
    if (nameMatch) {
      let raw = (nameMatch[1] || nameMatch[0] || '').trim().replace(/\s+and\s+.*$/i, '').trim()
      if (raw && !DATE_WORDS.test(raw) && !NOT_NAME_PATTERNS.test(raw) && !NEVER_USE_AS_NAME.test(raw) && raw.length > 2) event.name = toTitleCase(raw)
    }
  }
  // Short direct answer (e.g. "Highschool Chapel" when asked "What is the name?") — exclude "call it X" (handled above)
  if (!event.name && text.length <= 50 && text.split(/\s+/).length <= 4) {
    const trimmed = text.trim()
    if (trimmed && !/^call\s+it\s+/i.test(trimmed) && !NOT_NAME_PATTERNS.test(trimmed) && !NEVER_USE_AS_NAME.test(trimmed) &&
        !DATE_WORDS.test(trimmed) && !/^(ok|yes|no|nope|sure|maybe|thanks|please|\?)$/i.test(trimmed)) {
      event.name = toTitleCase(trimmed)
    }
  }
  if (/night to shine/i.test(text)) event.name = 'Night to Shine'
  // Event type (vibe for landing page)
  if (/\bfundrais(er|ing)\b|gala|donation/i.test(t)) event.eventType = 'Fundraiser'
  else if (/\bassembly|assembly\b|all-?school/i.test(t)) event.eventType = 'Assembly'
  else if (/\bsport|game|tournament|pep rally|basketball|football/i.test(t)) event.eventType = 'Sport'
  else if (/\bdance|night to shine|prom/i.test(t)) event.eventType = 'Special Event'
  // Location
  if (/\bgym\b/i.test(t)) event.location = 'Gym'
  if (/\bpac\b|performing arts/i.test(t)) event.location = event.location || 'PAC'
  if (/\bcafeteria\b/i.test(t)) event.location = event.location || 'Cafeteria'
  if (/\bfield\b/i.test(t)) event.location = event.location || 'Field'
  // Resources
  if (/\bprojector\b/i.test(t)) event.resources.push('Projector')
  if (/\bspeakers?\b|mic\b|mics\b/i.test(t)) event.resources.push('Speakers')
  if (/\blighting\b|lights?\b/i.test(t)) event.resources.push('Lighting')
  if (/\bstage\b/i.test(t)) event.resources.push('Stage')
  if (/\btables?\b/i.test(t)) event.resources.push('Tables')
  if (/\bchairs?\b/i.test(t)) event.resources.push('Chairs')
  // Facilities: tables and chairs quantities — "1 table for FOH" overrides "no tables"
  const oneTable = t.match(/\b(?:one|a)\s+table\b/i) || t.match(/\b1\s+table\b/i)
  const tablesN = t.match(/\b(\d+)\s*tables?\b/i)
  if (oneTable) event.tablesRequested = 1
  else if (tablesN) event.tablesRequested = parseInt(tablesN[1], 10)
  else if (/\b(?:no|don'?t\s+need|remove\s+the)\s+tables?\b|0\s*tables?/i.test(t)) event.tablesRequested = 0
  const chairsNum = t.match(/\b(\d+)\s*chairs?\b/i)
  if (chairsNum) event.chairsRequested = parseInt(chairsNum[1], 10)
  if (/\bchairs?\s+(?:set\s+up\s+)?in\s+rows\b|\brows\s+of\s+chairs?\b/i.test(t)) event.chairsSetup = 'rows'
  // A/V notes vs general notes: route by content
  const isNoteLike = text.trim().length >= 10 && !CONFIRM_PATTERN.test(text) &&
    (/\b(please|make sure|don't forget|note:|also|one more thing|reminder|important|fyi|heads up)\b/i.test(text) ||
     !(event.name || event.date || event.time || event.location || event.tablesRequested != null || event.chairsRequested != null))
  const isAVRelated = /\b(?:mic|mics|speaker|speakers|projector|lighting|lights|stage|av|a\/v|tech|headset|wireless)\b/i.test(t)
  if (isNoteLike) {
    if (isAVRelated) event.avNotes = text.trim()
    else event.notes = text.trim()
  }
  return event
}

/** Returns the venue conflict object if any (for UI and conflict card). */
function checkConflict(event, calendarEvents) {
  const { venueConflict } = getConflicts(event, calendarEvents)
  return venueConflict || null
}

function getLogisticsHealth(hasConflict) {
  return hasConflict ? 'conflict' : 'clear'
}

function getVenueCapacity(location) {
  return location && VENUE_CAPACITY[location] != null ? VENUE_CAPACITY[location] : null
}

function buildAIResponse(parsed, conflict, includeNextSteps = true) {
  const parts = []
  const hasBasics = parsed.location && (parsed.date || parsed.time)
  const suggestedName = parsed.name || (hasBasics ? `${parsed.location} Event` : 'Your Event')
  parts.push({ type: 'suggestedName', title: 'Name idea', name: suggestedName })

  // 1. Core identity — only when we know the venue
  if (parsed.location) {
    const eventType = parsed.eventType || 'Special Event'
    const capacity = getVenueCapacity(parsed.location)
    parts.push({
    type: 'identity',
    title: 'What & where',
    eventType,
    venue: parsed.location,
    capacity: capacity != null ? `Fits up to ${capacity} people` : null,
    message: capacity != null
      ? `Sounds like a **${eventType}** in **${parsed.location}** — and that space can fit about ${capacity} people. Nice.`
      : `So we’re thinking **${eventType}** in **${parsed.location}**.`,
  })
  }

  if (conflict) {
    parts.push({
      type: 'conflict',
      title: 'Heads up — something’s already booked',
      message: `Just so you know, ${conflict.contact} has **${conflict.title}** in the ${conflict.venue} until ${formatTime24To12(conflict.endTime)}. No worries though — we can work around it.`,
      options: [
        { id: 'shift', label: 'Start at 7:00 PM instead', time: '19:00', location: parsed.location },
        { id: 'venue', label: 'Use the PAC (great tech there too)', time: parsed.time, location: 'PAC' },
      ],
    })
  }

  // 2. Setup/teardown buffer — only when we have basics
  const needsSetup = parsed.resources.some((r) => ['Projector', 'Stage', 'Speakers'].includes(r))
  if (hasBasics && needsSetup && parsed.time) {
    const [h] = parsed.time.split(':').map(Number)
    const setupStart = `${String(h - 2).padStart(2, '0')}:00`
    const setupList = parsed.resources.filter((r) => ['Projector', 'Stage', 'Speakers'].includes(r)).join(' and ')
    parts.push({
      type: 'setupBuffer',
      title: 'Setup time',
      message: `Since you’re starting at ${formatTime24To12(parsed.time)} and need ${setupList}, we could block the room from ${formatTime24To12(setupStart)} so IT has time to set up. Want me to do that?`,
      suggestedSetupStart: setupStart,
    })
  }

  // 3. Shadow conflict (mock: custodial)
  if (parsed.date === '2025-03-24') {
    parts.push({
      type: 'shadowConflict',
      title: 'One more thing',
      message: `The room itself is free, but ${MOCK_SHADOW_CONFLICT.note} We could request a sub-crew for setup and teardown so everything still runs smoothly — up to you.`,
    })
  }

  if (hasBasics && parsed.resources?.length) {
    parts.push({ type: 'resources', title: 'What you’ll need', items: parsed.resources })
  }

  // 4. Power (if heavy lighting in Gym)
  if (hasBasics && parsed.resources?.includes('Lighting') && parsed.location === 'Gym') {
    parts.push({
      type: 'power',
      title: 'Power',
      message: 'With all that lighting in the Gym, we could have the electrician double-check the breakers so nothing trips. Want me to add that?',
    })
  }

  // 5. Safety & compliance — only when we have basics (location + date or time)
  const startHour = parsed.time ? parseInt(parsed.time.split(':')[0], 10) : 17
  const endHour = startHour + 4
  const isAfterHours = endHour >= 20
  if (hasBasics) {
    parts.push({
      type: 'safety',
      title: 'Keeping everyone comfortable & safe',
      items: [
        isAfterHours && `Since you’re wrapping up around ${endHour > 12 ? endHour - 12 : endHour}:00 ${endHour >= 12 ? 'PM' : 'AM'}, I’ll loop in Security so the building stays monitored.`,
        `Lots of schools cut AC/heat around 4 PM — I’ve got an HVAC override for **${parsed.location}** from 4–10 PM so your guests stay comfy.`,
      ].filter(Boolean),
    })
  }

  if (includeNextSteps) {
    parts.push({
      type: 'branch',
      title: 'Whenever you’re ready',
      message: 'Save to the calendar, or add ticketing and/or a landing page first.',
      actions: [
        { id: 'save', label: 'Save to calendar', icon: 'check' },
        { id: 'ticketing', label: 'Add ticketing', icon: 'ticket' },
        { id: 'landing', label: 'Create landing page', icon: 'layout' },
      ],
    })
  }
  return parts
}

const AV_RESOURCES = ['Projector', 'Speakers', 'Lighting', 'Stage']

function buildAVSummary(draft) {
  const avItems = (draft.resources || []).filter((r) => AV_RESOURCES.includes(r))
  const parts = []
  if (avItems.length > 0) parts.push(avItems.join(' + '))
  if (draft.avNotes) parts.push(draft.avNotes)
  return parts.length > 0 ? parts.join(' · ') : '—'
}

function buildFacilitiesSummary(draft) {
  const t = draft.tablesRequested
  const c = draft.chairsRequested
  const setup = draft.chairsSetup
  const parts = []
  if (t === 0) parts.push('No tables')
  else if (t != null) parts.push(`${t} Table${t !== 1 ? 's' : ''}`)
  if (c != null) parts.push(`${c} Chairs`)
  else if (setup === 'rows') parts.push('Chairs in rows')
  else if (setup) parts.push(setup)
  if (parts.length === 0) return 'TBD'
  return parts.join(', ')
}

function buildSummaryCard(draft) {
  const dateStr = draft.date || 'TBD'
  const timeStr = draft.time ? formatTime24To12(draft.time) : ''
  const facilitiesSummary = buildFacilitiesSummary(draft)
  return {
    type: 'summary',
    title: 'You’re almost there',
    rows: [
      { department: 'Calendar', status: 'Confirmed', action: `${dateStr}, ${timeStr} (No Conflicts)`, icon: 'calendar' },
      { department: 'Facilities', status: 'Requested', action: facilitiesSummary, icon: 'package' },
      { department: 'A/V', status: 'Requested', action: buildAVSummary(draft), icon: 'monitor' },
      { department: 'Ticketing', status: draft.hasTicketSales ? 'Live' : '—', action: draft.hasTicketSales ? `URL: school.edu/${(draft.name || '').toLowerCase().replace(/\s+/g, '-')}` : 'Not enabled', icon: 'ticket' },
      { department: 'Notes', status: draft.notes ? 'Added' : '—', action: draft.notes || '—', icon: 'calendar' },
    ],
  }
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: (i = 0) => ({
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.02 * i },
  }),
  exit: { opacity: 0 },
}

const bubbleVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8 },
}

export default function SmartEventModal({
  isOpen,
  onClose,
  onSave,
  onGenerateLandingPage,
  currentUser,
  calendarEvents = [],
}) {
  const userName = currentUser?.name || 'Jane Smith'
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [eventDraft, setEventDraft] = useState(null)
  const [logisticsHealth, setLogisticsHealth] = useState('clear')
  const [logisticsStep, setLogisticsStep] = useState(0) // 0–3: Time locked → Resources → Safety → Ready
  const [showSummaryForPublish, setShowSummaryForPublish] = useState(false)
  const [listening, setListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [voiceError, setVoiceError] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const voiceTranscriptRef = useRef('')
  const interimRef = useRef('')
  const lastFinalRef = useRef('')
  const sendMessageRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setMessages([])
      setEventDraft(null)
      setLogisticsHealth('clear')
      setLogisticsStep(0)
      setShowSummaryForPublish(false)
      setInterimTranscript('')
      voiceTranscriptRef.current = ''
      setVoiceError(null)
      if (recognitionRef.current) try { recognitionRef.current.stop() } catch (_) {}
      setListening(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking, interimTranscript])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    getNaturalVoice()
    window.speechSynthesis.onvoiceschanged = () => getNaturalVoice()
  }, [])

  useEffect(() => {
    if (!voiceError) return
    const t = setTimeout(() => setVoiceError(null), 6000)
    return () => clearTimeout(t)
  }, [voiceError])

  const speakBack = useCallback((text) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.95
    u.pitch = 1
    const voice = getNaturalVoice()
    if (voice) u.voice = voice
    window.speechSynthesis.speak(u)
  }, [])

  const startListening = useCallback(() => {
    setVoiceError(null)
    setListening(true) // immediate feedback so click is visible
    const Recognition = getSpeechRecognitionConstructor()
    if (!Recognition) {
      setListening(false)
      setVoiceError('Voice input isn’t supported in this browser. Try Chrome, Edge, or Safari.')
      return
    }
    voiceTranscriptRef.current = ''
    lastFinalRef.current = ''
    setInterimTranscript('')
    let rec
    try {
      rec = new Recognition()
    } catch (err) {
      setListening(false)
      setVoiceError('Voice input isn’t supported in this browser. Try Chrome, Edge, or Safari.')
      return
    }
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          const trimmed = (t || '').trim()
          if (trimmed && trimmed !== lastFinalRef.current) {
            voiceTranscriptRef.current += (voiceTranscriptRef.current ? ' ' : '') + trimmed
            lastFinalRef.current = trimmed
          }
          setInterimTranscript('')
          clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = setTimeout(() => {
            let full = (voiceTranscriptRef.current + ' ' + interimRef.current).trim() || voiceTranscriptRef.current.trim()
            full = dedupeTranscript(full)
            if (full) {
              try { rec.stop() } catch (_) {}
              setListening(false)
              setInterimTranscript('')
              interimRef.current = ''
              voiceTranscriptRef.current = ''
              lastFinalRef.current = ''
              sendMessageRef.current?.(full)
            }
          }, SILENCE_DELAY_MS)
        } else {
          interim = t
          interimRef.current = t
          setInterimTranscript(t)
        }
      }
    }
    rec.onerror = (e) => {
      setListening(false)
      if (e.error === 'not-allowed') setVoiceError('Microphone access denied. Allow mic in your browser to use voice.')
      else if (e.error === 'no-speech') setVoiceError(null)
      else setVoiceError('Voice input failed. Try again or type your message.')
    }
    rec.onend = () => setListening(false)
    try {
      rec.start()
      recognitionRef.current = rec
    } catch (err) {
      setListening(false)
      setVoiceError('Couldn’t start microphone. Check that your mic is connected and allowed.')
    }
  }, [])

  const stopListening = useCallback(() => {
    clearTimeout(silenceTimerRef.current)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (_) {}
      recognitionRef.current = null
    }
    setListening(false)
    let full = (voiceTranscriptRef.current + ' ' + interimTranscript).trim()
    full = dedupeTranscript(full)
    if (full) sendMessageRef.current?.(full)
    setInterimTranscript('')
    interimRef.current = ''
    voiceTranscriptRef.current = ''
    lastFinalRef.current = ''
  }, [interimTranscript])

  const handleOption = (optionId, option) => {
    if (optionId === 'shift' && option?.time) {
      setEventDraft((d) => ({ ...d, time: option.time, location: option.location }))
    }
    if (optionId === 'venue' && option?.location) {
      setEventDraft((d) => ({ ...d, location: option.location }))
    }
    setLogisticsHealth('clear')
    setLogisticsStep((prev) => Math.max(prev, 1))
    const nextStepsCard = {
      type: 'branch',
      title: 'Whenever you’re ready',
      message: 'Save to the calendar, or add ticketing and/or a landing page first.',
      actions: [
        { id: 'save', label: 'Save to calendar', icon: 'check' },
        { id: 'ticketing', label: 'Add ticketing', icon: 'ticket' },
        { id: 'landing', label: 'Create landing page', icon: 'layout' },
      ],
    }
    setMessages((m) => [
      ...m,
      {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: "All set on the time and place. Save to the calendar when you're ready, or add ticketing or a landing page first.",
        actionCards: [nextStepsCard],
        onBranch: handleBranch,
      },
    ])
  }

  const handlePublishEvent = (createLandingPage = false) => {
    if (!eventDraft?.name) return
    const descParts = [eventDraft.avNotes, eventDraft.notes].filter(Boolean)
    const facilitiesRequested = []
    if (eventDraft.tablesRequested != null && eventDraft.tablesRequested > 0) {
      facilitiesRequested.push({ item: "8' table", quantity: eventDraft.tablesRequested })
    }
    if (eventDraft.chairsRequested != null && eventDraft.chairsRequested > 0) {
      facilitiesRequested.push({ item: 'Folding chair', quantity: eventDraft.chairsRequested })
    }
    const techRequested = (eventDraft.resources || []).map((r) => ({ item: typeof r === 'string' ? r : r?.item || 'Item', quantity: 1 }))
    onSave({
      ...eventDraft,
      description: descParts.length > 0 ? descParts.join('\n\n') : eventDraft.description,
      id: String(Date.now()),
      owner: userName,
      creator: userName,
      watchers: [],
      facilitiesRequested: facilitiesRequested.length ? facilitiesRequested : undefined,
      techRequested: techRequested.length ? techRequested : undefined,
      tablesRequested: eventDraft.tablesRequested,
      chairsRequested: eventDraft.chairsRequested,
    })
    onClose()
    if (createLandingPage) onGenerateLandingPage?.()
  }

  const handleBranch = (actionId) => {
    if (actionId === 'save') {
      if (!eventDraft?.name) return
      setShowSummaryForPublish(true)
      const summary = buildSummaryCard(eventDraft)
      setMessages((m) => [
        ...m,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: "Here's a quick summary. Hit the button below to save this event to the calendar.",
          actionCards: [summary],
          onPublish: handlePublishEvent,
        },
      ])
    }
    if (actionId === 'ticketing') {
      setEventDraft((d) => ({ ...d, hasTicketSales: true }))
      setMessages((m) => [
        ...m,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: 'Ticketing’s on — nice. You can set capacity and pricing in the event details whenever you’re ready.',
          actionCards: [],
        },
      ])
    }
    if (actionId === 'landing') {
      if (!eventDraft?.name) return
      setLogisticsStep(4)
      setShowSummaryForPublish(true)
      const summary = buildSummaryCard(eventDraft)
      setMessages((m) => [
        ...m,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: 'Here’s a quick summary of everything we set up. Take a look, and when it feels good, you can publish.',
          actionCards: [summary],
          onPublish: handlePublishEvent,
        },
      ])
    }
  }

  const sendMessage = async (textOverride) => {
    const text = (textOverride != null ? textOverride : input).trim()
    if (!text) return
    if (textOverride == null) setInput('')
    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }
    setMessages((m) => [...m, userMsg])
    setThinking(true)

    const messagesForExtraction = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '',
    }))

    const [parsed, extracted] = await Promise.all([
      Promise.resolve(parseUserPrompt(text)),
      extractEventFieldsWithGemini(messagesForExtraction),
    ])

    // AI extraction overrides regex when it returns a value (better at natural language)
    // Reject ticketing terms like "open entry" that are never event names
    const safeExtracted = { ...extracted }
    if (extracted.name && NEVER_USE_AS_NAME.test(String(extracted.name).trim())) {
      safeExtracted.name = null
    }
    const effectiveParsed = { ...parsed, ...safeExtracted }
    const mergedDraft = {
      date: effectiveParsed.date || eventDraft?.date,
      time: effectiveParsed.time || eventDraft?.time,
      location: effectiveParsed.location || eventDraft?.location,
      name: effectiveParsed.name || eventDraft?.name,
      tablesRequested: effectiveParsed.tablesRequested ?? parsed.tablesRequested ?? eventDraft?.tablesRequested,
      chairsRequested: effectiveParsed.chairsRequested ?? parsed.chairsRequested ?? eventDraft?.chairsRequested,
      chairsSetup: parsed.chairsSetup || eventDraft?.chairsSetup,
      notes: parsed.notes ? (eventDraft?.notes ? `${eventDraft.notes}\n\n${parsed.notes}` : parsed.notes) : eventDraft?.notes,
      avNotes: parsed.avNotes ? (eventDraft?.avNotes ? `${eventDraft.avNotes}\n\n${parsed.avNotes}` : parsed.avNotes) : eventDraft?.avNotes,
    }
    const isConfirmed = CONFIRM_PATTERN.test(text)
    const draftComplete = mergedDraft.name && mergedDraft.date && mergedDraft.time && mergedDraft.location &&
      mergedDraft.location !== 'TBD' && !NEVER_USE_AS_NAME.test(String(mergedDraft.name).trim())

    if (isConfirmed && draftComplete) {
      setThinking(false)
      setEventDraft((prev) => ({
        ...prev,
        name: mergedDraft.name || prev?.name,
        date: mergedDraft.date || prev?.date,
        time: mergedDraft.time || prev?.time,
        location: mergedDraft.location || prev?.location,
      tablesRequested: mergedDraft.tablesRequested ?? prev?.tablesRequested,
      chairsRequested: mergedDraft.chairsRequested ?? prev?.chairsRequested,
      chairsSetup: mergedDraft.chairsSetup || prev?.chairsSetup,
      notes: mergedDraft.notes ?? prev?.notes,
      avNotes: mergedDraft.avNotes ?? prev?.avNotes,
    }))
      setMessages((m) => [
        ...m,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: "Perfect! Ready to save to the calendar.",
          actionCards: [{
            type: 'branch',
            title: 'Approve & save',
            message: 'Click below to save this event to the calendar.',
            actions: [{ id: 'save', label: 'Approve & Save to calendar', icon: 'check' }],
          }],
          onBranch: handleBranch,
        },
      ])
      return
    }
    const { venueConflict, parkingAdvisories } = getConflicts(mergedDraft, calendarEvents)
    const conflict = venueConflict
    const health = getLogisticsHealth(!!conflict)
    setLogisticsHealth(health)
    setEventDraft((prev) => ({
      name: effectiveParsed.name || prev?.name || 'New Event',
      date: effectiveParsed.date || prev?.date || new Date().toISOString().slice(0, 10),
      time: effectiveParsed.time || prev?.time || '17:00',
      location: effectiveParsed.location || prev?.location || 'TBD',
      resources: parsed.resources?.length ? parsed.resources : prev?.resources ?? [],
      eventType: parsed.eventType || prev?.eventType || 'Special Event',
      tablesRequested: effectiveParsed.tablesRequested != null ? effectiveParsed.tablesRequested : parsed.tablesRequested != null ? parsed.tablesRequested : prev?.tablesRequested,
      chairsRequested: effectiveParsed.chairsRequested != null ? effectiveParsed.chairsRequested : parsed.chairsRequested != null ? parsed.chairsRequested : prev?.chairsRequested,
      chairsSetup: parsed.chairsSetup || prev?.chairsSetup,
      notes: parsed.notes ? (prev?.notes ? `${prev.notes}\n\n${parsed.notes}` : parsed.notes) : prev?.notes,
      avNotes: parsed.avNotes ? (prev?.avNotes ? `${prev.avNotes}\n\n${parsed.avNotes}` : parsed.avNotes) : prev?.avNotes,
    }))

    const messagesForApi = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '',
    }))
    const conflictNoteParts = []
    if (conflict) {
      conflictNoteParts.push(
        `${conflict.venue} on ${conflict.date} has ${conflict.title} until ${formatTime24To12(conflict.endTime)}. Suggest 7 PM or PAC.`
      )
    }
    if (parkingAdvisories.length > 0) {
      const parkingList = parkingAdvisories.map((a) => `${a.title} (${a.venue})`).join(', ')
      conflictNoteParts.push(
        `Parking: On ${mergedDraft.date}, ${parkingList} also use the same or nearby parking (${parkingAdvisories[0].zone}). Mention possible parking pressure and suggest coordinating or carpooling.`
      )
    }
    const conflictNote = conflictNoteParts.length > 0 ? conflictNoteParts.join(' ') : undefined

    let replyText
    try {
      replyText = await chatWithGemini({
        messages: messagesForApi,
        conflictNote,
      })
    } catch (err) {
      replyText = err?.message?.includes('Gemini API key') || err?.message?.includes('VITE_GEMINI_API_KEY')
        ? "I can't reach the AI right now. Add NEXT_PUBLIC_GEMINI_API_KEY (or VITE_GEMINI_API_KEY) in .env and restart."
        : `Something went wrong: ${err?.message || 'please try again.'}`
    }

    setThinking(false)
    const allParts = buildAIResponse(effectiveParsed, conflict, !conflict)
    const hasMinimal = effectiveParsed.location && (effectiveParsed.date || effectiveParsed.time)
    const hasRealName = effectiveParsed.name && !/^(your event|new event|tbd|for march .* in the gym)$/i.test(String(effectiveParsed.name).trim())
    let actionParts
    if (conflict) {
      actionParts = allParts.filter((p) => p.type === 'conflict')
    } else if (hasRealName && hasMinimal) {
      actionParts = allParts
    } else {
      actionParts = []
    }
    setMessages((m) => [
      ...m,
      {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        actionCards: actionParts,
        onOption: handleOption,
        onBranch: handleBranch,
      },
    ])
    const hasResources = allParts.some((p) => p.type === 'resources')
    const hasSafety = allParts.some((p) => p.type === 'safety')
    if (!conflict) {
      setLogisticsStep((prev) => Math.max(prev, hasSafety ? 3 : hasResources ? 2 : 1))
    }
  }
  sendMessageRef.current = sendMessage

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60]"
        />
        {/* Top bar with close button - same as Create Event overlay */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="fixed top-0 inset-x-0 h-20 z-[70] flex items-center justify-end px-6 pointer-events-none"
        >
          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto p-2 rounded-xl bg-zinc-200/90 dark:bg-zinc-900/80 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-900 transition-colors shadow-lg shadow-zinc-900/10 dark:shadow-black/30"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
        {/* Full-screen sheet - slides up like Create Event */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-x-0 bottom-0 top-0 sm:top-20 z-[70] flex flex-col rounded-t-3xl bg-zinc-50 dark:bg-zinc-900 shadow-2xl border border-b-0 border-zinc-200 dark:border-zinc-800"
        >
          {/* Drag handle on mobile */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0 sm:hidden">
            <div className="w-12 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" aria-hidden />
          </div>
          {/* Header */}
          <div className="flex items-center gap-3 shrink-0 px-6 sm:px-8 pt-4 pb-4 border-b border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 shadow-inner border border-zinc-200 dark:border-zinc-700 text-violet-600 dark:text-violet-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Create Smart Event
            </h2>
          </div>

          <div className="flex flex-1 min-h-0 w-full flex-col md:flex-row">
            {/* Event preview - left (full width on mobile, fixed width on md+) */}
            <div className="w-full md:w-72 lg:w-80 shrink-0 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-4 overflow-y-auto min-h-0 max-h-[35%] md:max-h-none flex-shrink-0">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                Event preview
              </h3>
              {eventDraft ? (
                <motion.div
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 space-y-3 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {eventDraft.name || 'New Event'}
                    </p>
                    {eventDraft.eventType && (
                      <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">{eventDraft.eventType}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <Calendar className="w-3.5 h-3.5" />
                      {eventDraft.date} {eventDraft.time && `· ${eventDraft.time}`}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <MapPin className="w-3.5 h-3.5" />
                      {eventDraft.location || 'TBD'}
                    </div>
                  </div>
                  {((eventDraft.resources?.length > 0) || eventDraft.avNotes) && (
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-700">
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">A/V</p>
                      {eventDraft.resources?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {eventDraft.resources.filter((r) => ['Projector', 'Speakers', 'Lighting', 'Stage'].includes(r)).map((r) => (
                            <span key={r} className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs">{r}</span>
                          ))}
                        </div>
                      )}
                      {eventDraft.avNotes && <p className="text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">{eventDraft.avNotes}</p>}
                    </div>
                  )}
                  {eventDraft.notes && (
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-700">
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Notes</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">{eventDraft.notes}</p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">
                  Event details will appear as you chat.
                </p>
              )}
            </div>

            {/* Chat area - right (fills remaining space) */}
            <div className="flex flex-col flex-1 min-w-0 min-h-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-4"
                >
                  {messages.length === 0 && (
                    <motion.p
                      variants={bubbleVariants}
                      className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8"
                    >
                      Tell me about your event — e.g. “Night to Shine on March 24th at 5pm in the Gym with speakers, projector and lighting.” I’ll help you sort the rest.
                    </motion.p>
                  )}
                  <AnimatePresence mode="popLayout">
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        layout
                        variants={bubbleVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'user' ? (
                          <motion.div
                            layout
                            className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 bg-blue-500 text-white text-sm shadow-lg"
                          >
                            {msg.content}
                          </motion.div>
                        ) : (
                          <div className="max-w-[90%] space-y-3">
                            {msg.content && (
                              <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-sm border border-zinc-200 dark:border-zinc-700">
                                {msg.content}
                              </div>
                            )}
                            {msg.actionCards?.map((card, idx) => (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.08 }}
                                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 overflow-hidden shadow-sm"
                              >
                                <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                                  {card.title}
                                </div>
                                <div className="p-4 space-y-3">
                                  {card.type === 'suggestedName' && (
                                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                                      {card.name}
                                    </p>
                                  )}
                                  {card.type === 'identity' && (
                                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                                      {card.message}
                                      {card.capacity && (
                                        <span className="block mt-1 text-zinc-500 dark:text-zinc-400">{card.capacity}</span>
                                      )}
                                    </p>
                                  )}
                                  {card.type === 'setupBuffer' && (
                                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{card.message}</p>
                                  )}
                                  {card.type === 'shadowConflict' && (
                                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{card.message}</p>
                                  )}
                                  {card.type === 'power' && (
                                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{card.message}</p>
                                  )}
                                  {card.type === 'safety' && card.items?.length > 0 && (
                                    <ul className="list-disc list-inside space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                                      {card.items.map((item, i) => (
                                        <li key={i}>{item}</li>
                                      ))}
                                    </ul>
                                  )}
                                  {card.type === 'summary' && card.rows?.length > 0 && (
                                    <div className="space-y-0 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-600">
                                      {card.rows.map((row, i) => (
                                        <div
                                          key={i}
                                          className="flex items-center gap-3 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 even:bg-white dark:even:bg-zinc-800/30 text-sm"
                                        >
                                          <span className="w-24 shrink-0 font-medium text-zinc-700 dark:text-zinc-300">{row.department}</span>
                                          <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                            <Check className="w-3.5 h-3.5" />
                                          </span>
                                          <span className="flex-1 min-w-0 text-zinc-600 dark:text-zinc-400 truncate">{row.action}</span>
                                        </div>
                                      ))}
                                      <div className="p-3 border-t border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50 space-y-2">
                                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                          Create an event landing page for this event?
                                        </p>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                          <button
                                            type="button"
                                            onClick={() => msg.onPublish?.(true)}
                                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
                                          >
                                            <Check className="w-4 h-4" />
                                            Yes, save & create landing page
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => msg.onPublish?.(false)}
                                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-sm font-medium transition-colors"
                                          >
                                            No, just save to calendar
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {card.message && !['identity', 'setupBuffer', 'shadowConflict', 'power'].includes(card.type) && (
                                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                                      {card.message}
                                    </p>
                                  )}
                                  {card.type === 'conflict' && card.options?.map((opt) => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => msg.onOption?.(opt.id, opt)}
                                      className="block w-full text-left px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-800 text-sm font-medium text-zinc-800 dark:text-zinc-200 transition-colors"
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                  {card.type === 'resources' && (
                                    <div className="flex flex-wrap gap-2">
                                      {card.items?.map((item) => (
                                        <span
                                          key={item}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm"
                                        >
                                          {item === 'Projector' && <Monitor className="w-3.5 h-3.5" />}
                                          {item === 'Speakers' && <Mic className="w-3.5 h-3.5" />}
                                          {item === 'Lighting' && <Lightbulb className="w-3.5 h-3.5" />}
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {card.type === 'branch' && card.actions?.map((act) => (
                                    <button
                                      key={act.id}
                                      type="button"
                                      onClick={() => msg.onBranch?.(act.id)}
                                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-500/90 to-fuchsia-500/90 text-white text-sm font-medium hover:opacity-90 transition-opacity"
                                    >
                                      {act.icon === 'check' && <Check className="w-4 h-4" />}
                                      {act.icon === 'ticket' && <Ticket className="w-4 h-4" />}
                                      {act.icon === 'layout' && <LayoutTemplate className="w-4 h-4" />}
                                      {act.label}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Listening: real-time transcript in blue */}
                  <AnimatePresence>
                    {listening && interimTranscript && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex justify-end"
                      >
                        <p className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300" style={{ color: VOICE_BLUE }}>
                          {interimTranscript}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {/* AI thinking: shimmer / rotating gradient */}
                  <AnimatePresence>
                    {thinking && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex justify-start"
                      >
                        <motion.div
                          animate={{
                            opacity: [0.7, 1, 0.7],
                            boxShadow: [
                              '0 0 20px rgba(59, 130, 246, 0.2)',
                              '0 0 30px rgba(59, 130, 246, 0.4)',
                              '0 0 20px rgba(59, 130, 246, 0.2)',
                            ],
                          }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-3 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 border border-blue-200 dark:border-blue-800"
                        >
                          <Sparkles className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Checking the calendar and pulling together your options…</span>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                <div ref={bottomRef} />
              </div>

              <div className="shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30">
                {/* Status: Listening | Thinking | idle */}
                <div className="flex items-center gap-2 mb-2 min-h-[20px]">
                  {listening && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs font-medium flex items-center gap-1.5"
                      style={{ color: VOICE_BLUE }}
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                      </span>
                      Listening…
                    </motion.span>
                  )}
                  {thinking && !listening && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400"
                    >
                      Thinking…
                    </motion.span>
                  )}
                  {voiceError && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-amber-600 dark:text-amber-400"
                    >
                      {voiceError}
                    </motion.span>
                  )}
                </div>
                {voiceError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200"
                  >
                    {voiceError}
                  </motion.div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    sendMessage()
                  }}
                  className="flex gap-2 items-center"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={listening ? 'Listening…' : 'Tell me about your event…'}
                    className="flex-1 px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                    disabled={thinking}
                  />
                  {/* Voice: pulse blue + waveform when listening */}
                  <motion.button
                    type="button"
                    onClick={listening ? stopListening : startListening}
                    disabled={thinking}
                    className={`shrink-0 p-3 rounded-xl flex items-center justify-center transition-colors ${
                      listening
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600'
                    }`}
                    animate={listening ? { boxShadow: ['0 0 0 0 rgba(59, 130, 246, 0.4)', '0 0 0 12px rgba(59, 130, 246, 0)'] } : {}}
                    transition={listening ? { repeat: Infinity, duration: 1.2 } : {}}
                    aria-label={listening ? 'Stop listening' : 'Start voice input'}
                    title={listening ? 'Stop listening (submit what you said)' : 'Click to speak your event details'}
                  >
                    {listening ? (
                      <span className="flex items-center gap-0.5 h-5">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <motion.span
                            key={i}
                            className="w-0.5 rounded-full bg-white"
                            animate={{ height: [4, 16, 4] }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                          />
                        ))}
                      </span>
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </motion.button>
                  <motion.button
                    type="submit"
                    disabled={!input.trim() || thinking}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="shrink-0 p-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Send className="w-5 h-5" />
                  </motion.button>
                </form>
              </div>
            </div>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  )
}
