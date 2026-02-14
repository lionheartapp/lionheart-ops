import { useState, useEffect, useRef } from 'react'
import { Plus, CalendarDays, Sparkles, ChevronDown, FileText, Building2, Headphones } from 'lucide-react'

const EVENT_OPTIONS = [
  { id: 'event', label: 'Event', icon: CalendarDays, description: 'Create a new event' },
  { id: 'smart-event', label: 'Smart Event', icon: Sparkles, description: 'Create with AI' },
]

const FORM_OPTIONS = [
  { id: 'form', label: 'Form', icon: FileText, description: 'Build a form with ease' },
  { id: 'form-ai', label: 'Smart Form', icon: Sparkles, description: 'Describe what you need, AI builds it' },
]

const DASHBOARD_OPTIONS = [
  { id: 'event', label: 'Event', icon: CalendarDays, description: 'Create a new event' },
  { id: 'smart-event', label: 'Smart Event', icon: Sparkles, description: 'Create with AI' },
  { id: 'form', label: 'Form', icon: FileText, description: 'Build a form with ease' },
  { id: 'form-ai', label: 'Smart Form', icon: Sparkles, description: 'Describe what you need, AI builds it' },
  { id: '_section-support', section: 'SUPPORT' },
  { id: 'facilities', label: 'Facilities Request', icon: Building2, description: 'Submit a facilities request' },
  { id: 'it', label: 'IT Request', icon: Headphones, description: 'Submit an IT support request' },
]

export default function CreateDropdown({
  mode = 'events', // 'events' | 'forms' | 'dashboard'
  onCreateEvent,
  onCreateSmartEvent,
  onFormsRequest,
  onFormsAIRequest,
  onFacilitiesRequest,
  onITRequest,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (id) => {
    setOpen(false)
    if (id === 'event') onCreateEvent?.()
    else if (id === 'smart-event') onCreateSmartEvent?.()
    else if (id === 'form') onFormsRequest?.()
    else if (id === 'form-ai') onFormsAIRequest?.()
    else if (id === 'facilities') onFacilitiesRequest?.()
    else if (id === 'it') onITRequest?.()
  }

  const allOptions =
    mode === 'dashboard'
      ? DASHBOARD_OPTIONS
      : mode === 'forms'
        ? FORM_OPTIONS
        : EVENT_OPTIONS

  const hasHandler = (id) => {
    if (id === 'event') return !!onCreateEvent
    if (id === 'smart-event') return !!onCreateSmartEvent
    if (id === 'form') return !!onFormsRequest
    if (id === 'form-ai') return !!onFormsAIRequest
    if (id === 'facilities') return !!onFacilitiesRequest
    if (id === 'it') return !!onITRequest
    return true
  }

  const filterWithSections = () => {
    const filtered = []
    for (const opt of allOptions) {
      if (opt.section) {
        if (opt.section === 'SUPPORT' && (hasHandler('facilities') || hasHandler('it'))) {
          filtered.push(opt)
        }
      } else if (hasHandler(opt.id)) {
        filtered.push(opt)
      }
    }
    return filtered
  }

  const options =
    mode === 'dashboard'
      ? filterWithSections()
      : allOptions

  const visibleOptions = options.filter((opt) => !opt.section)
  if (visibleOptions.length === 0) return null

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
      >
        <Plus className="w-4 h-4" />
        Create
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl z-[100] py-1">
          {options.map((opt) => {
            if (opt.section) {
              return (
                <div
                  key={opt.id}
                  className="px-4 py-2 pt-3 mt-1 border-t border-zinc-200 dark:border-zinc-700 first:border-t-0 first:mt-0 first:pt-0"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {opt.section}
                  </p>
                </div>
              )
            }
            const Icon = opt.icon
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <Icon className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                <div>
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{opt.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
