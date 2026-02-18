import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Users,
  Building2,
  Headphones,
  Check,
  CheckCircle2,
  LayoutTemplate,
  ChevronRight,
  ChevronLeft,
  Ticket,
  DollarSign,
  ClipboardList,
  Plus,
} from 'lucide-react'

const CURRENT_USER = 'You (current user)'
const STEPS = [
  { id: 0, label: 'Basics', short: '1' },
  { id: 1, label: 'Facilities', short: '2' },
  { id: 2, label: 'Tech', short: '3' },
  { id: 3, label: 'Overview', short: '4' },
]

const MOCK_OWNER_OPTIONS = [
  'Jane Smith',
  'John Doe',
  'Maria Garcia',
  'IT Department Head',
  'Cafeteria Manager',
  'Facilities Lead',
  'Sarah Chen',
  'Mike Johnson',
  'Alex Rivera',
  'Jordan Lee',
]

const DEFAULT_LOCATIONS = [
  'Main Hall',
  'Auditorium',
  'Gym',
  'Cafeteria',
  'Library',
  'Campus',
  'Classroom',
]

const LOCATIONS_BY_CATEGORY = {
  'Athletics Event': ['Football field', 'Baseball field', 'Gym', 'Softball field', 'Middle school field'],
  'Arts Event': ['Auditorium', 'Theater', 'Gallery', 'Main Hall', 'Band room', 'Chorus room'],
  'Elementary School': ['Cafeteria', 'Gym', 'Library', 'Classroom', 'Playground', 'Multi-purpose room'],
  'Middle School': ['Main Hall', 'Auditorium', 'Gym', 'Cafeteria', 'Library', 'Classroom'],
  'High School': ['Main Hall', 'Auditorium', 'Gym', 'Cafeteria', 'Library', 'Classroom', 'Campus'],
  'Global Event': ['Main Hall', 'Auditorium', 'Campus', 'Conference room', 'Online'],
}

function getLocationOptionsForCategory(category) {
  if (category && LOCATIONS_BY_CATEGORY[category]) return LOCATIONS_BY_CATEGORY[category]
  return DEFAULT_LOCATIONS
}

const EVENT_CATEGORY_OPTIONS = [
  'Elementary School',
  'Middle School',
  'High School',
  'Athletics Event',
  'Arts Event',
  'Global Event',
]

// Suggest watchers from name/description
function suggestWatchers(name, description) {
  const text = `${name || ''} ${description || ''}`.toLowerCase()
  const hasTech = /tech|hackathon|coding|digital|film|movie|screen|av|projector|webinar|conference/.test(text)
  const hasFood = /food|cafeteria|dinner|lunch|banquet|reception|breakfast|catering|meal/.test(text)
  const suggestions = []
  if (hasTech) suggestions.push('IT Department Head')
  if (hasFood) suggestions.push('Cafeteria Manager')
  return suggestions
}

// AI: suggest facilities items WITH quantities based on event type/name
function suggestFacilitiesWithQuantities(name, description, location) {
  const text = `${name || ''} ${description || ''} ${location || ''}`.toLowerCase()
  const hasParty = /gala|banquet|dinner|reception|fair|festival|dance/.test(text)
  const hasSport = /game|tournament|match|sports|pep rally|rally/.test(text)
  const hasMeeting = /meeting|conference|assembly|presentation|talk|lecture|webinar|parent night/.test(text)
  const isLarge = /gala|banquet|fair|festival|assembly|parent night|campus/.test(text)
  const isGym = /gym/.test(text)

  const items = []
  if (hasParty || hasSport || hasMeeting) {
    const tableCount = isLarge ? 12 : isGym ? 8 : 6
    const chairCount = isLarge ? 120 : isGym ? 80 : 40
    items.push({ item: "8' table", quantity: tableCount })
    items.push({ item: 'Folding chair', quantity: chairCount })
  }
  if (hasParty) {
    items.push({ item: "6' table", quantity: 4 })
    items.push({ item: 'Stage/risers', quantity: 1 })
  }
  if (items.length === 0) {
    items.push({ item: "8' table", quantity: 4 })
    items.push({ item: 'Folding chair', quantity: 30 })
  }
  return items
}

// AI: suggest tech items (with optional quantities where it makes sense)
function suggestTechItems(name, description) {
  const text = `${name || ''} ${description || ''}`.toLowerCase()
  const hasMeeting = /meeting|conference|assembly|presentation|talk|lecture|webinar/.test(text)
  const hasTech = /tech|hackathon|coding|digital|film|movie|screen/.test(text)
  const hasMusic = /concert|music|performance|dance/.test(text)
  const items = []
  if (hasMeeting || hasTech) {
    items.push({ item: 'Projector', quantity: 1 })
    items.push({ item: 'Screen', quantity: 1 })
    items.push({ item: 'Microphones', quantity: 2 })
    items.push({ item: 'Video cables', quantity: 2 })
  }
  if (hasMusic) {
    items.push({ item: 'PA system', quantity: 1 })
    items.push({ item: 'Microphones', quantity: 4 })
  }
  if (items.length === 0) {
    items.push({ item: 'Projector', quantity: 1 })
    items.push({ item: 'Microphones', quantity: 2 })
  }
  return items
}

// Mock AI: description + initial facility/tech hints from name
function mockAISuggest(name) {
  const lower = (name || '').toLowerCase()
  const hasMeeting = /meeting|conference|assembly|presentation|talk|lecture|webinar/.test(lower)
  const hasParty = /dance|party|gala|banquet|dinner|reception|fair|festival/.test(lower)
  const hasSport = /game|tournament|match|sports|pep rally/.test(lower)
  const hasTech = /tech|hackathon|coding|digital|film|movie|screen/.test(lower)
  let description = ''
  if (hasMeeting || hasTech) {
    description = `A structured ${name} with presentations and Q&A. Setup includes AV equipment and seating for attendees.`
  }
  if (hasParty || hasSport) {
    if (!description) description = `A lively ${name} with space for guests and activities. Tables and seating will be arranged.`
    else description = `Combined event: ${name}. Both presentation setup and seating/refreshments will be arranged.`
  }
  if (!description) description = `School event: ${name}. We can suggest setup once you add more details.`
  return { description }
}

function toDateStr(d) {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  return date.toISOString().slice(0, 10)
}

export default function EventCreatorModal({
  isOpen,
  onClose,
  onEventUpdate,
  initialEvent,
  onSave,
  onGenerateLandingPage,
}) {
  const [step, setStep] = useState(0)
  const [success, setSuccess] = useState(false)
  const [savedEvent, setSavedEvent] = useState(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [locationOpen, setLocationOpen] = useState(false)
  const [locationSearch, setLocationSearch] = useState('')
  const [date, setDate] = useState(() => toDateStr(new Date()))
  const [endDate, setEndDate] = useState(() => toDateStr(new Date()))
  const [time, setTime] = useState('18:00')
  const [endTime, setEndTime] = useState('19:00')
  const [repeatRule, setRepeatRule] = useState('none')
  const [useTickets, setUseTickets] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [needsSignup, setNeedsSignup] = useState(false)
  const [category, setCategory] = useState('')
  const [includeSetupTime, setIncludeSetupTime] = useState(false)
  const [setupTimeDate, setSetupTimeDate] = useState(() => toDateStr(new Date()))
  const [setupTimeTime, setSetupTimeTime] = useState('02:00')
  const [customLocations, setCustomLocations] = useState([])

  const dateInputRef = useRef(null)
  const endDateInputRef = useRef(null)
  const timeInputRef = useRef(null)
  const endTimeInputRef = useRef(null)
  const dateTimeSectionRef = useRef(null)
  const sheetRef = useRef(null) // modal panel — native picker is rendered outside this
  const locationDropdownRef = useRef(null)

  const [owner, setOwner] = useState('')
  const [ownerSearch, setOwnerSearch] = useState('')
  const [ownerOpen, setOwnerOpen] = useState(false)
  const [watchers, setWatchers] = useState([])
  const [watcherSearch, setWatcherSearch] = useState('')
  const [watcherOpen, setWatcherOpen] = useState(false)

  const [facilitiesItems, setFacilitiesItems] = useState([])
  const [techItems, setTechItems] = useState([])
  const [facilityNewItem, setFacilityNewItem] = useState('')
  const [facilityNewQty, setFacilityNewQty] = useState(1)
  const [techNewItem, setTechNewItem] = useState('')
  const [techNewQty, setTechNewQty] = useState(1)

  const ownerDropdownRef = useRef(null)
  const watcherDropdownRef = useRef(null)

  const creator = CURRENT_USER

  // Close owner dropdown when clicking outside
  useEffect(() => {
    if (!ownerOpen) return
    const handleClickOutside = (e) => {
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(e.target)) {
        setOwnerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [ownerOpen])

  // Close watcher dropdown when clicking outside
  useEffect(() => {
    if (!watcherOpen) return
    const handleClickOutside = (e) => {
      if (watcherDropdownRef.current && !watcherDropdownRef.current.contains(e.target)) {
        setWatcherOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [watcherOpen])

  // Close location dropdown when clicking outside
  useEffect(() => {
    if (!locationOpen) return
    const handleClickOutside = (e) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target)) {
        setLocationOpen(false)
        setLocationSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [locationOpen])

  // Close date/time picker only when mousedown is inside our modal (not on the native picker), then open the field under the cursor
  useEffect(() => {
    const handleMouseDown = (e) => {
      const active = document.activeElement
      if (!active || (active.type !== 'date' && active.type !== 'time')) return

      const sheet = sheetRef.current
      const section = dateTimeSectionRef.current
      const target = e.target
      const clientX = e.clientX
      const clientY = e.clientY

      // Only blur when the click is inside our sheet — so we don't close the picker when user clicks a date/time inside the native picker
      if (sheet && !sheet.contains(target)) return

      active.blur()

      // After the picker closes (next tick), open the picker for the element under the cursor
      setTimeout(() => {
        if (!section) return
        const elementUnder = document.elementFromPoint(clientX, clientY)
        if (!elementUnder) return
        const wrapper = elementUnder.closest?.('[role="button"]')
        if (!wrapper || !section.contains(wrapper)) return
        const input = wrapper.querySelector?.('input[type="date"], input[type="time"]')
        if (input) {
          input.focus()
          input.showPicker?.()
        }
      }, 0)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // Escape closes date/time picker so you can then click elsewhere
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return
      const active = document.activeElement
      if (active && (active.type === 'date' || active.type === 'time')) {
        active.blur()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // When category changes, clear location if it's not in the new option list
  const locationOptions = useMemo(() => {
    const base = getLocationOptionsForCategory(category)
    const combined = [...base]
    customLocations.forEach((loc) => {
      if (!combined.includes(loc)) combined.push(loc)
    })
    return combined
  }, [category, customLocations])

  const filteredLocations = useMemo(() => {
    const q = locationSearch.trim().toLowerCase()
    if (!q) return locationOptions
    return locationOptions.filter((loc) => loc.toLowerCase().includes(q))
  }, [locationOptions, locationSearch])

  const showLocationAddOption = locationSearch.trim() && !locationOptions.map((l) => l.toLowerCase()).includes(locationSearch.trim().toLowerCase())

  useEffect(() => {
    if (category && location && !locationOptions.includes(location)) setLocation('')
  }, [category, locationOptions])

  useEffect(() => {
    if (isOpen && initialEvent) {
      setName(initialEvent.name || '')
      setDescription(initialEvent.description || '')
      setCategory(initialEvent.category ?? '')
      const loc = initialEvent.location || ''
      setLocation(loc)
      const opts = getLocationOptionsForCategory(initialEvent.category ?? '')
      if (loc && !opts.includes(loc)) setCustomLocations((prev) => (prev.includes(loc) ? prev : [...prev, loc]))
      const start = initialEvent.date || toDateStr(new Date())
      setDate(start)
      setEndDate(initialEvent.endDate || start)
      setTime(initialEvent.time || '18:00')
      setEndTime(initialEvent.endTime || '19:00')
      setRepeatRule(initialEvent.repeatRule || 'none')
      setIncludeSetupTime(!!initialEvent.includeSetupTime)
      setSetupTimeDate(initialEvent.setupTimeDate || toDateStr(new Date()))
      setSetupTimeTime(initialEvent.setupTimeTime || '02:00')
      setUseTickets(!!initialEvent.hasTicketSales)
      setIsPaid(!!initialEvent.isPaid)
      setNeedsSignup(!!initialEvent.needsSignup)
      onEventUpdate?.(initialEvent)
    }
    if (!isOpen) {
      setStep(0)
      setSuccess(false)
      setSavedEvent(null)
      setLocationOpen(false)
      setLocationSearch('')
    }
  }, [isOpen, initialEvent])

  const filteredOwners = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase()
    if (!q) return MOCK_OWNER_OPTIONS
    return MOCK_OWNER_OPTIONS.filter((o) => o.toLowerCase().includes(q))
  }, [ownerSearch])

  const filteredWatcherOptions = useMemo(() => {
    const q = watcherSearch.trim().toLowerCase()
    const exclude = new Set([owner, ...watchers].filter(Boolean))
    let list = MOCK_OWNER_OPTIONS.filter((o) => !exclude.has(o))
    if (q) list = list.filter((o) => o.toLowerCase().includes(q))
    return list
  }, [watcherSearch, owner, watchers])

  const updateFacilityQuantity = (index, quantity) => {
    setFacilitiesItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], quantity: Math.max(0, Number(quantity) || 0) }
      return next
    })
  }

  const updateTechQuantity = (index, quantity) => {
    setTechItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], quantity: Math.max(0, Number(quantity) || 0) }
      return next
    })
  }

  const removeFacility = (index) => setFacilitiesItems((prev) => prev.filter((_, i) => i !== index))
  const removeTech = (index) => setTechItems((prev) => prev.filter((_, i) => i !== index))

  const addFacility = () => {
    const item = facilityNewItem.trim()
    if (item) {
      setFacilitiesItems((prev) => [...prev, { item, quantity: Math.max(0, Number(facilityNewQty) || 1) }])
      setFacilityNewItem('')
      setFacilityNewQty(1)
    }
  }

  const addTech = () => {
    const item = techNewItem.trim()
    if (item) {
      setTechItems((prev) => [...prev, { item, quantity: Math.max(0, Number(techNewQty) || 1) }])
      setTechNewItem('')
      setTechNewQty(1)
    }
  }

  const addWatcher = (person) => {
    if (person && !watchers.includes(person)) {
      setWatchers((prev) => [...prev, person])
      setWatcherSearch('')
      setWatcherOpen(false)
    }
  }
  const removeWatcher = (w) => setWatchers((prev) => prev.filter((x) => x !== w))

  const addCustomLocation = (value) => {
    const v = (typeof value === 'string' ? value : locationSearch).trim()
    if (!v) return
    const normalized = v.trim()
    if (!locationOptions.some((l) => l.toLowerCase() === normalized.toLowerCase())) {
      setCustomLocations((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]))
      setLocation(normalized)
    }
    setLocationSearch('')
    setLocationOpen(false)
  }

  const selectLocation = (loc) => {
    setLocation(loc)
    setLocationSearch('')
    setLocationOpen(false)
  }

  const repeatOptions = useMemo(() => {
    const d = date ? new Date(date) : null
    const weekday = d ? d.toLocaleDateString(undefined, { weekday: 'long' }) : 'this day'
    const dayOfMonth = d ? d.getDate() : 1
    const monthDay = d ? d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) : 'this date'
    const nthIndex = Math.floor((dayOfMonth - 1) / 7)
    const ordinals = ['first', 'second', 'third', 'fourth', 'fifth']
    const ordinal = ordinals[nthIndex] || 'first'
    return [
      { id: 'none', label: 'Does not repeat' },
      { id: 'daily', label: 'Daily' },
      { id: 'weekly', label: `Weekly on ${weekday}` },
      { id: 'monthly', label: `Monthly on the ${ordinal} ${weekday}` },
      { id: 'yearly', label: `Annually on ${monthDay}` },
      { id: 'weekdays', label: 'Every weekday (Monday to Friday)' },
      { id: 'custom', label: 'Custom…' },
    ]
  }, [date])

  const canNext = () => {
    if (step === 0) return name.trim()
    return true
  }

  const handleSubmit = () => {
    const eventPayload = {
      id: initialEvent?.id || String(Date.now()),
      name: name.trim(),
      description: description.trim(),
      location: location.trim() || 'TBD',
      date: date || toDateStr(new Date()),
      endDate: endDate || date || toDateStr(new Date()),
      time: time || '',
      endTime: endTime || '',
      allDay: false,
      repeatEnabled: repeatRule && repeatRule !== 'none',
      repeatRule: repeatRule || 'none',
      hasTicketSales: useTickets,
      isPaid: isPaid,
      needsSignup: needsSignup,
      category: category || undefined,
      includeSetupTime: !!includeSetupTime,
      setupTimeDate: includeSetupTime ? setupTimeDate : undefined,
      setupTimeTime: includeSetupTime ? setupTimeTime : undefined,
      owner: owner.trim() || 'TBD',
      creator,
      watchers: [...watchers],
      facilitiesRequested: facilitiesItems.filter((f) => f.quantity > 0),
      techRequested: techItems.filter((t) => t.quantity > 0),
      communications: initialEvent?.communications ?? [],
    }
    onEventUpdate?.(eventPayload)
    onSave?.(eventPayload)
    setSavedEvent(eventPayload)
    setSuccess(true)
  }

  const showLandingPageOption = savedEvent && (savedEvent.hasTicketSales || savedEvent.isPaid || savedEvent.needsSignup)

  const handleCreateLandingPage = () => {
    onEventUpdate?.(savedEvent)
    onGenerateLandingPage?.()
    onClose?.()
  }

  const handleDone = () => {
    onClose?.()
  }

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
        {/* Top area (80px on desktop) with close button */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="fixed top-0 inset-x-0 h-20 z-[70] flex items-center justify-end px-6 pointer-events-none"
        >
          <button
            onClick={onClose}
            className="pointer-events-auto p-2 rounded-xl bg-zinc-200/90 dark:bg-zinc-900/80 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-900 transition-colors shadow-lg shadow-zinc-900/10 dark:shadow-black/30"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
        <motion.div
          ref={sheetRef}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-x-0 bottom-0 top-0 sm:top-20 z-[70] flex flex-col rounded-t-3xl bg-zinc-50 dark:bg-zinc-900 shadow-2xl border border-b-0 border-zinc-200 dark:border-zinc-800"
        >
          <div className="flex flex-col w-full max-w-[800px] mx-auto flex-1 min-h-0 overflow-hidden">
            {/* Drag handle - Dribbble-style */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0 sm:hidden">
              <div className="w-12 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" aria-hidden />
            </div>
            {!success ? (
              <>
                <div className="flex items-center justify-between px-8 pt-6 pb-0 flex-shrink-0">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    Create event
                  </h2>
                </div>

                {/* Stepper with labels */}
                <div className="px-8 pt-6 pb-3 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    {STEPS.map((s, i) => (
                      <div key={s.id} className="flex flex-1 items-center">
                        <button
                          type="button"
                          onClick={() => setStep(s.id)}
                          className={`flex flex-col items-center gap-1 min-w-0 flex-1 ${
                            step === s.id ? 'opacity-100' : step > s.id ? 'opacity-80' : 'opacity-50'
                          }`}
                        >
                          <span
                            className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-colors ${
                              step === s.id
                                ? 'bg-blue-500 text-white ring-2 ring-blue-500/30'
                                : step > s.id
                                  ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
                            }`}
                          >
                            {step > s.id ? <CheckCircle2 className="w-4 h-4" /> : s.short}
                          </span>
                          <span className={`text-[10px] font-medium truncate w-full text-center ${
                            step === s.id ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'
                          }`}>
                            {s.label}
                          </span>
                        </button>
                        {i < STEPS.length - 1 && (
                          <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700 mx-0.5 max-w-[20px]" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 px-8 py-5">
                  <AnimatePresence mode="wait">
                    {step === 0 && (
                      <motion.div
                        key="step0"
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-6"
                      >
                        <div>
                          <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">Event name</label>
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Spring Gala, Tech Talk"
                            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">Event category</label>
                          <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="select-arrow-padded w-full pl-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            aria-label="Event category"
                          >
                            <option value="">Select category...</option>
                            {EVENT_CATEGORY_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">Description</label>
                          <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={1}
                            placeholder="Brief description (optional)"
                            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm min-h-[36px]"
                          />
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Include setup time</span>
                            <button
                              type="button"
                              onClick={() => setIncludeSetupTime((v) => !v)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                includeSetupTime ? 'bg-blue-500' : 'bg-zinc-500/50'
                              }`}
                              aria-pressed={includeSetupTime}
                            >
                              <span
                                className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                                  includeSetupTime ? 'translate-x-4' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                          {includeSetupTime && (
                            <div className="pl-0 pt-1 pb-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 p-4 space-y-3">
                              <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400">Setup time</label>
                              <div className="flex flex-wrap gap-3 items-end">
                                <div className="min-w-[10rem]">
                                  <input
                                    type="date"
                                    value={setupTimeDate}
                                    onChange={(e) => setSetupTimeDate(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:light]"
                                  />
                                </div>
                                <div className="min-w-[8rem]">
                                  <input
                                    type="time"
                                    value={setupTimeTime}
                                    onChange={(e) => setSetupTimeTime(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:light]"
                                  />
                                </div>
                              </div>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">Time before the event starts for setup</p>
                            </div>
                          )}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 shrink-0">Repeat</label>
                            <select
                              value={repeatRule}
                              onChange={(e) => setRepeatRule(e.target.value)}
                              className="min-w-[11rem] px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {repeatOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">Location</label>
                          <div ref={locationDropdownRef} className="relative">
                            <input
                              type="text"
                              value={locationOpen ? locationSearch : location}
                              onChange={(e) => { setLocationSearch(e.target.value); setLocationOpen(true) }}
                              onFocus={() => setLocationOpen(true)}
                              placeholder="Search or add location..."
                              className="w-full pl-3 pr-10 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {locationOpen && (
                              <ul className="absolute top-full left-0 right-0 mt-1 py-1 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-lg max-h-48 overflow-y-auto z-10">
                                {showLocationAddOption && (
                                  <li>
                                    <button
                                      type="button"
                                      onClick={() => addCustomLocation(locationSearch.trim())}
                                      className="w-full px-3 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2"
                                    >
                                      <Plus className="w-4 h-4 shrink-0" />
                                      Add &quot;{locationSearch.trim()}&quot;
                                    </button>
                                  </li>
                                )}
                                {filteredLocations.map((loc) => (
                                  <li key={loc}>
                                    <button
                                      type="button"
                                      onClick={() => selectLocation(loc)}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                                    >
                                      {loc}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>

                        {/* Event options - compact pills with checkmark when selected */}
                        <div>
                          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Event options</label>
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => setUseTickets((v) => !v)}
                              className={`relative inline-flex items-center gap-2 pl-3 pr-8 py-2 rounded-xl text-sm font-medium border transition-colors ${
                                useTickets
                                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400'
                                  : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                              }`}
                            >
                              <Ticket className="w-4 h-4 shrink-0" />
                              <span>Tickets</span>
                              {useTickets && (
                                <span className="absolute top-1/2 right-2 -translate-y-1/2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center" aria-hidden>
                                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsPaid((v) => !v)}
                              className={`relative inline-flex items-center gap-2 pl-3 pr-8 py-2 rounded-xl text-sm font-medium border transition-colors ${
                                isPaid
                                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400'
                                  : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                              }`}
                            >
                              <DollarSign className="w-4 h-4 shrink-0" />
                              <span>Paid</span>
                              {isPaid && (
                                <span className="absolute top-1/2 right-2 -translate-y-1/2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center" aria-hidden>
                                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setNeedsSignup((v) => !v)}
                              className={`relative inline-flex items-center gap-2 pl-3 pr-8 py-2 rounded-xl text-sm font-medium border transition-colors ${
                                needsSignup
                                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400'
                                  : 'border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                              }`}
                            >
                              <ClipboardList className="w-4 h-4 shrink-0" />
                              <span>Signup</span>
                              {needsSignup && (
                                <span className="absolute top-1/2 right-2 -translate-y-1/2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center" aria-hidden>
                                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                </span>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Collaborators - always visible, no container */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                            <Users className="w-4 h-4 text-zinc-500" />
                            Collaborators
                          </h3>
                          <div>
                            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">Owner</label>
                            <div ref={ownerDropdownRef} className="relative">
                              <input
                                type="text"
                                value={ownerOpen ? ownerSearch : owner}
                                onChange={(e) => { setOwnerSearch(e.target.value); setOwnerOpen(true) }}
                                onFocus={() => setOwnerOpen(true)}
                                placeholder="Search to assign..."
                                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              {ownerOpen && (
                                <ul className="absolute top-full left-0 right-0 mt-1 py-1 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-lg max-h-36 overflow-y-auto z-10">
                                  {filteredOwners.map((opt) => (
                                    <li key={opt}>
                                      <button type="button" onClick={() => { setOwner(opt); setOwnerOpen(false); setOwnerSearch('') }} className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700">
                                        {opt}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">Watchers</label>
                            <div ref={watcherDropdownRef} className="relative">
                              <input
                                type="text"
                                value={watcherSearch}
                                onChange={(e) => { setWatcherSearch(e.target.value); setWatcherOpen(true) }}
                                onFocus={() => setWatcherOpen(true)}
                                placeholder="Search to add watcher..."
                                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              {watcherOpen && (
                                <ul className="absolute top-full left-0 right-0 mt-1 py-1 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-lg max-h-36 overflow-y-auto z-10">
                                  {filteredWatcherOptions.length === 0 ? (
                                    <li className="px-3 py-2 text-sm text-zinc-500">No one else to add</li>
                                  ) : (
                                    filteredWatcherOptions.map((opt) => (
                                      <li key={opt}>
                                        <button type="button" onClick={() => addWatcher(opt)} className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700">
                                          {opt}
                                        </button>
                                      </li>
                                    ))
                                  )}
                                </ul>
                              )}
                            </div>
                            {watchers.length > 0 && (
                              <ul className="flex flex-wrap gap-1.5 mt-2">
                                {watchers.map((w) => (
                                  <li key={w} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-700 text-xs">
                                    {w}
                                    <button type="button" onClick={() => removeWatcher(w)} className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-600"><X className="w-3 h-3" /></button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {step === 1 && (
                      <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-6"
                      >
                        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-amber-500" /> Facilities
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Add tables, chairs, and other setup.
                        </p>
                        <div className="flex gap-2 flex-wrap items-end">
                          <div className="flex-1 min-w-[140px]">
                            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Item</label>
                            <input
                              type="text"
                              value={facilityNewItem}
                              onChange={(e) => setFacilityNewItem(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFacility())}
                              placeholder="e.g. 8' table"
                              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                            />
                          </div>
                          <div className="w-20">
                            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Qty</label>
                            <input
                              type="number"
                              min={1}
                              value={facilityNewQty}
                              onChange={(e) => setFacilityNewQty(e.target.value)}
                              className="w-full px-2 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-center"
                            />
                          </div>
                          <button type="button" onClick={addFacility} className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
                            Add
                          </button>
                        </div>
                        {facilitiesItems.length > 0 && (
                          <ul className="space-y-2">
                            {facilitiesItems.map((f, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 truncate">{f.item}</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={f.quantity}
                                  onChange={(e) => updateFacilityQuantity(i, e.target.value)}
                                  className="w-16 px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-center"
                                />
                                <button type="button" onClick={() => removeFacility(i)} className="p-1.5 rounded text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-700">
                                  <X className="w-4 h-4" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </motion.div>
                    )}

                    {step === 2 && (
                      <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-6"
                      >
                        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                          <Headphones className="w-4 h-4 text-blue-500" /> Tech & AV
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Projectors, mics, PA, etc.
                        </p>
                        <div className="flex gap-2 flex-wrap items-end">
                          <div className="flex-1 min-w-[140px]">
                            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Item</label>
                            <input
                              type="text"
                              value={techNewItem}
                              onChange={(e) => setTechNewItem(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTech())}
                              placeholder="e.g. Projector"
                              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                            />
                          </div>
                          <div className="w-20">
                            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Qty</label>
                            <input
                              type="number"
                              min={1}
                              value={techNewQty}
                              onChange={(e) => setTechNewQty(e.target.value)}
                              className="w-full px-2 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-center"
                            />
                          </div>
                          <button type="button" onClick={addTech} className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
                            Add
                          </button>
                        </div>
                        {techItems.length > 0 && (
                          <ul className="space-y-2">
                            {techItems.map((t, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 truncate">{t.item}</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={t.quantity}
                                  onChange={(e) => updateTechQuantity(i, e.target.value)}
                                  className="w-16 px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-center"
                                />
                                <button type="button" onClick={() => removeTech(i)} className="p-1.5 rounded text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-700">
                                  <X className="w-4 h-4" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </motion.div>
                    )}

                    {step === 3 && (
                      <motion.div
                        key="step3"
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-6"
                      >
                        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Review</h3>
                        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30 p-6 space-y-4 text-sm">
                          <div className="flex justify-between gap-2"><span className="text-zinc-500 dark:text-zinc-400 shrink-0">Name</span><span className="text-right font-medium">{name || '—'}</span></div>
                          <div className="flex justify-between gap-2"><span className="text-zinc-500 dark:text-zinc-400 shrink-0">When</span><span>{date}{endDate && endDate !== date ? ` – ${endDate}` : ''}{time ? ` · ${time} – ${endTime || '—'}` : ''}</span></div>
                          <div className="flex justify-between gap-2"><span className="text-zinc-500 dark:text-zinc-400 shrink-0">Location</span><span>{location || '—'}</span></div>
                          <div className="flex justify-between gap-2"><span className="text-zinc-500 dark:text-zinc-400 shrink-0">Options</span><span>{[useTickets && 'Tickets', isPaid && 'Paid', needsSignup && 'Signup'].filter(Boolean).join(' · ') || 'None'}</span></div>
                          {category && (
                            <div className="flex justify-between gap-2"><span className="text-zinc-500 dark:text-zinc-400 shrink-0">Event category</span><span>{category}</span></div>
                          )}
                          {facilitiesItems.filter((f) => f.quantity > 0).length > 0 && (
                            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                              <span className="text-zinc-500 dark:text-zinc-400 text-xs block mb-1">Facilities</span>
                              <p className="text-zinc-800 dark:text-zinc-200">{facilitiesItems.filter((f) => f.quantity > 0).map((f) => `${f.item} (${f.quantity})`).join(', ')}</p>
                            </div>
                          )}
                          {techItems.filter((t) => t.quantity > 0).length > 0 && (
                            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                              <span className="text-zinc-500 dark:text-zinc-400 text-xs block mb-1">Tech</span>
                              <p className="text-zinc-800 dark:text-zinc-200">{techItems.filter((t) => t.quantity > 0).map((t) => `${t.item} (${t.quantity})`).join(', ')}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="px-8 py-6 flex-shrink-0 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-900/50 flex items-center gap-3">
                  <div className="flex-1">
                    {step > 0 && (
                      <button
                        type="button"
                        onClick={() => setStep((s) => s - 1)}
                        className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors inline-flex items-center gap-1.5"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Back</span>
                      </button>
                    )}
                  </div>
                  <div className="flex justify-end">
                    {step < 3 ? (
                      <button
                        type="button"
                        onClick={() => setStep((s) => s + 1)}
                        disabled={!canNext()}
                        className="px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSubmit}
                        className="px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 shadow-lg shadow-blue-500/20 inline-flex items-center justify-center gap-1.5"
                      >
                        <span>Submit</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="px-8 py-12 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mb-5 ring-4 ring-green-500/10">
                  <CheckCircle2 className="w-9 h-9 text-green-500" />
                </div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Event created</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                  “{savedEvent?.name}” is saved. You can find it on the Events calendar.
                </p>
                {showLandingPageOption && (
                  <button
                    type="button"
                    onClick={handleCreateLandingPage}
                    className="w-full max-w-xs inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 mb-3 shadow-lg shadow-blue-500/20"
                  >
                    <LayoutTemplate className="w-5 h-5" />
                    Create landing page
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDone}
                  className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline-offset-2 hover:underline"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  )
}
