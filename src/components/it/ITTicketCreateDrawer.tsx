'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOptimisticMutation } from '@/lib/hooks/useOptimisticMutation'
import { queryKeys } from '@/lib/queries'
import { getAuthHeaders, fetchApi } from '@/lib/api-client'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingTextarea } from '@/components/ui/FloatingInput'
import { useToast } from '@/components/Toast'
import DynamicCategoryField from '@/components/shared/DynamicCategoryField'
import { FIELD_LIBRARY } from '@/lib/services/categoryFieldLibrary'
import type { CategoryFieldType } from '@prisma/client'
import FormRenderer from '@/components/forms/FormRenderer'
import type { FormFieldData } from '@/components/forms/FormFieldRenderer'
import {
  Loader2,
  Mic,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  Laptop,
  Code,
  KeyRound,
  Wifi,
  Projector,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react'

// ─── Speech Recognition types (non-standard browser API) ─────────────────────

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly [index: number]: { readonly transcript: string }
}

interface SpeechRecognitionResultList {
  readonly length: number
  readonly [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
  __speechRecognition?: SpeechRecognitionInstance | null
}

function getWindowWithSpeech(): WindowWithSpeech | undefined {
  return typeof window !== 'undefined' ? (window as unknown as WindowWithSpeech) : undefined
}

interface ITTicketCreateDrawerProps {
  isOpen: boolean
  onClose: () => void
  canManage: boolean
}

interface Building {
  id: string
  name: string
  areas?: Area[]
  rooms?: Room[]
}

interface Area {
  id: string
  name: string
  rooms?: Room[]
}

interface Room {
  id: string
  roomNumber?: string
  displayName?: string | null
}

interface School {
  id: string
  name: string
}

const ISSUE_TYPES: Array<{ value: string; label: string; icon: LucideIcon; color: string; selectedColor: string }> = [
  { value: 'HARDWARE', label: 'Hardware', icon: Laptop, color: 'text-slate-500 bg-slate-50', selectedColor: 'text-slate-700 bg-slate-100 border-slate-400 ring-2 ring-slate-200' },
  { value: 'SOFTWARE', label: 'Software', icon: Code, color: 'text-blue-500 bg-blue-50', selectedColor: 'text-blue-700 bg-blue-100 border-blue-400 ring-2 ring-blue-200' },
  { value: 'ACCOUNT_PASSWORD', label: 'Account / Password', icon: KeyRound, color: 'text-amber-500 bg-amber-50', selectedColor: 'text-amber-700 bg-amber-100 border-amber-400 ring-2 ring-amber-200' },
  { value: 'NETWORK', label: 'Network', icon: Wifi, color: 'text-green-500 bg-green-50', selectedColor: 'text-green-700 bg-green-100 border-green-400 ring-2 ring-green-200' },
  { value: 'DISPLAY_AV', label: 'Display / A/V', icon: Projector, color: 'text-purple-500 bg-purple-50', selectedColor: 'text-purple-700 bg-purple-100 border-purple-400 ring-2 ring-purple-200' },
  { value: 'OTHER', label: 'Other', icon: HelpCircle, color: 'text-slate-400 bg-slate-50', selectedColor: 'text-slate-700 bg-slate-100 border-slate-400 ring-2 ring-slate-200' },
]

const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]

const PASSWORD_SUB_TYPES = [
  { value: 'RESET', label: 'Password Reset' },
  { value: 'LOCKED', label: 'Account Locked' },
  { value: 'NEW_ACCOUNT', label: 'New Account' },
  { value: 'PERMISSION_CHANGE', label: 'Permission Change' },
]

const AV_SUB_TYPES = [
  { value: 'PROJECTOR', label: 'Projector' },
  { value: 'SOUNDBOARD', label: 'Soundboard' },
  { value: 'DISPLAY', label: 'Display / Monitor' },
  { value: 'APPLE_TV', label: 'Apple TV' },
  { value: 'OTHER_AV', label: 'Other A/V' },
]

const TITLE_SUGGESTIONS: Record<string, string[] | Record<string, string[]>> = {
  HARDWARE: ["Computer won't turn on", "Keyboard/mouse not working", "Printer issue", "Monitor not displaying"],
  SOFTWARE: ["Application won't open", "Software update needed", "Software installation request", "Application running slowly"],
  ACCOUNT_PASSWORD: {
    '': ["Password reset needed", "Account locked out", "New account request", "Permission/access change needed"],
    RESET: ["Password reset needed"],
    LOCKED: ["Account locked out"],
    NEW_ACCOUNT: ["New account request"],
    PERMISSION_CHANGE: ["Permission/access change needed"],
 },
  NETWORK: ["No internet connection", "Wi-Fi not working", "Network drive not accessible", "Slow internet"],
  DISPLAY_AV: {
    '': ["Projector not working", "Sound system issue", "Classroom display not working", "Apple TV not connecting", "A/V equipment issue"],
    PROJECTOR: ["Projector not working"],
    SOUNDBOARD: ["Sound system issue"],
    DISPLAY: ["Classroom display not working"],
    APPLE_TV: ["Apple TV not connecting"],
    OTHER_AV: ["A/V equipment issue"],
 },
  OTHER: ["General IT help needed"],
}

export default function ITTicketCreateDrawer({ isOpen, onClose, canManage }: ITTicketCreateDrawerProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [issueType, setIssueType] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [passwordSubType, setPasswordSubType] = useState('')
  const [avSubType, setAvSubType] = useState('')
  const [buildingId, setBuildingId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({})
  const [quickDescribe, setQuickDescribe] = useState('')
  const [classifying, setClassifying] = useState(false)
  const [classifyResult, setClassifyResult] = useState<{ confidence: string; reasoning: string } | null>(null)
  const [error, setError] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)

  useEffect(() => {
    const win = getWindowWithSpeech()
    const SR = win?.SpeechRecognition || win?.webkitSpeechRecognition
    setSpeechSupported(!!SR)
 }, [])

  const toggleVoiceInput = () => {
    const win = getWindowWithSpeech()
    const SR = win?.SpeechRecognition || win?.webkitSpeechRecognition
    if (!SR || !win) return

    if (isRecording) {
      if (win.__speechRecognition) {
        win.__speechRecognition.stop()
        win.__speechRecognition = null
     }
      setIsRecording(false)
      return
   }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript
       }
     }
      if (transcript) {
        setDescription((prev) => prev ? `${prev} ${transcript}` : transcript)
     }
   }

    recognition.onerror = () => setIsRecording(false)
    recognition.onend = () => setIsRecording(false)

    recognition.start()
    setIsRecording(true)

    // Store reference to stop later
    win.__speechRecognition = recognition
 }

  // Fetch buildings for location picker
  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['campus-buildings-for-it'],
    queryFn: async () => {
      const res = await fetch('/api/settings/campus/buildings', { headers: getAuthHeaders() })
      if (!res.ok) return []
      const data = await res.json()
      return data.ok ? data.data : []
   },
    staleTime: 5 * 60_000,
 })

  // Fetch schools
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ['schools-for-it'],
    queryFn: async () => {
      const res = await fetch('/api/settings/schools', { headers: getAuthHeaders() })
      if (!res.ok) return []
      const data = await res.json()
      return data.ok ? data.data : []
   },
    staleTime: 5 * 60_000,
 })

  // Fetch dynamic fields for selected issue type
  interface FieldConfigRecord {
    fieldType: CategoryFieldType
    required: boolean
    sortOrder: number
 }
  const { data: enabledFieldConfigs } = useQuery({
    queryKey: ['category-fields', 'IT', issueType],
    queryFn: () =>
      fetchApi<FieldConfigRecord[]>(
        `/api/settings/ticket-routing/fields?module=IT&categoryKey=${issueType}`
      ),
    enabled: !!issueType,
 })

  // Fetch form definition fields (new forms system)
  interface FormDefResponse {
    id: string
    fields: FormFieldData[]
 }
  const { data: formDef } = useQuery({
    queryKey: ['form-definition', 'category', issueType?.toLowerCase()],
    queryFn: () =>
      fetchApi<FormDefResponse>(
        `/api/forms/category/${issueType?.toLowerCase()}`
      ),
    enabled: !!issueType,
 })
  const formDefFields = formDef?.fields ?? []
  const [formFieldResponses, setFormFieldResponses] = useState<Record<string, unknown>>({})

  const selectedBuilding = buildings.find((b) => b.id === buildingId)
  const areas = selectedBuilding?.areas ?? []
  const selectedArea = areas.find((a) => a.id === areaId)
  const rooms = selectedArea?.rooms ?? selectedBuilding?.rooms ?? []

  const createMutation = useOptimisticMutation<unknown, void, unknown>({
    queryKey: queryKeys.itTickets.all,
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title: title.trim(),
        issueType,
        priority,
     }
      if (description.trim()) body.description = description.trim()
      if (passwordSubType) body.passwordSubType = passwordSubType
      if (avSubType) body.avSubType = avSubType
      if (buildingId) body.buildingId = buildingId
      if (areaId) body.areaId = areaId
      if (roomId) body.roomId = roomId
      if (schoolId) body.schoolId = schoolId
      const mergedCustomFields = { ...customFields, ...formFieldResponses }
      if (Object.keys(mergedCustomFields).length > 0) body.customFields = mergedCustomFields

      const res = await fetch('/api/it/tickets', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
     })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || 'Failed to create ticket')
     }
      return res.json()
   },
    invalidateKeys: [queryKeys.itBoard.all, queryKeys.itDashboard.all],
    onSuccess: () => {
      toast('IT ticket submitted successfully', 'success')
      resetForm()
      onClose()
   },
    onError: (err) => {
      const msg = err.message.includes('Insufficient permissions')
        ? "You don't have permission to submit IT tickets. Ask your administrator to update your role in Settings > Members."
        : err.message
      setError(msg)
   },
 })

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setIssueType('')
    setPriority('MEDIUM')
    setPasswordSubType('')
    setAvSubType('')
    setBuildingId('')
    setAreaId('')
    setRoomId('')
    setSchoolId('')
    setError('')
 }

  const handleClose = () => {
    resetForm()
    onClose()
 }

  // Compute title suggestions based on issue type + sub-type
  const titleSuggestions = useMemo<string[]>(() => {
    if (!issueType) return []
    const map = TITLE_SUGGESTIONS[issueType]
    if (!map) return []
    if (Array.isArray(map)) return map
    // It's a sub-type map
    const subType = issueType === 'ACCOUNT_PASSWORD' ? passwordSubType : avSubType
    return map[subType || ''] ?? []
 }, [issueType, passwordSubType, avSubType])

  const showSuggestions = issueType && titleSuggestions.length > 0 && title.trim().length < 10

  const canSubmit = title.trim().length > 0 && issueType !== ''

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title="New IT Request"
      width="md"
      footer={
        <div className="flex gap-3">
          <button
            type="submit"
            form="it-ticket-create-form"
            disabled={!canSubmit || createMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Request
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all"
          >
            Cancel
          </button>
        </div>
     }
    >
      <form
        id="it-ticket-create-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) createMutation.mutate()
       }}
        className="space-y-4"
      >
        {/* Quick Describe — AI Classify */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-medium text-indigo-900">Quick Describe</span>
            <span className="text-xs text-indigo-500">AI-powered</span>
          </div>
          <textarea
            value={quickDescribe}
            onChange={(e) => setQuickDescribe(e.target.value)}
            placeholder="Describe the issue in your own words... e.g. 'Wi-Fi is down in the library, 30 students can't connect'"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-indigo-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus:border-transparent transition-shadow resize-none"
          />
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={async () => {
                if (quickDescribe.trim().length < 5) return
                setClassifying(true)
                setClassifyResult(null)
                try {
                  const res = await fetchApi<{
                    category: string
                    suggestedTitle: string
                    suggestedPriority: string
                    confidence: string
                    reasoning: string
                 }>('/api/ai/ticket-intake/classify', {
                    method: 'POST',
                    body: JSON.stringify({ description: quickDescribe, module: 'IT' }),
                 })
                  if (res) {
                    setTitle(res.suggestedTitle)
                    setIssueType(res.category)
                    setPriority(res.suggestedPriority)
                    setDescription(quickDescribe)
                    setClassifyResult({ confidence: res.confidence, reasoning: res.reasoning })
                 }
               } catch { /* user can fill manually */ }
                finally { setClassifying(false) }
             }}
              disabled={classifying || quickDescribe.trim().length < 5}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer"
            >
              {classifying ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Classifying...</>
              ) : (
                <><Wand2 className="w-3.5 h-3.5" /> Let AI Classify</>
              )}
            </button>
            {classifyResult && (
              <div className="flex items-center gap-1.5 text-xs">
                {classifyResult.confidence === 'HIGH' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span className={classifyResult.confidence === 'HIGH' ? 'text-green-700' : 'text-amber-700'}>
                  {classifyResult.confidence} confidence
                </span>
              </div>
            )}
          </div>
        </div>

        <FloatingInput
          label="Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
        />

        {/* Title suggestions */}
        {showSuggestions && (
          <div className="flex flex-wrap gap-1.5 -mt-2 animate-[fadeIn_200ms_ease-out]">
            <span className="text-[11px] text-slate-400 mr-1 self-center">Suggestions:</span>
            {titleSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTitle(s)}
                className="px-2.5 py-1 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-full hover:bg-blue-100 active:scale-[0.97] transition-all cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Issue Type *</label>
          <div className="grid grid-cols-3 gap-2">
            {ISSUE_TYPES.map((t) => {
              const Icon = t.icon
              const isSelected = issueType === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setIssueType(t.value)
                    setPasswordSubType('')
                    setAvSubType('')
                 }}
                  className={`
                    flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border transition-all cursor-pointer
                    ${isSelected ? t.selectedColor : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}
                  `}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? '' : t.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-medium text-center leading-tight ${isSelected ? '' : 'text-slate-700'}`}>{t.label}</span>
                </button>
              )
           })}
          </div>
        </div>

        {/* Password sub-type */}
        {issueType === 'ACCOUNT_PASSWORD' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password Issue Type</label>
            <select
              value={passwordSubType}
              onChange={(e) => setPasswordSubType(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              <option value="">Select...</option>
              {PASSWORD_SUB_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* A/V sub-type */}
        {issueType === 'DISPLAY_AV' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">A/V Equipment</label>
            <select
              value={avSubType}
              onChange={(e) => setAvSubType(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              <option value="">Select...</option>
              {AV_SUB_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Dynamic category-scoped fields (legacy toggle system) */}
        {enabledFieldConfigs && enabledFieldConfigs.length > 0 && (
          <div className="space-y-4">
            {enabledFieldConfigs
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((fc) => {
                const fieldDef = FIELD_LIBRARY[fc.fieldType]
                if (!fieldDef) return null
                return (
                  <DynamicCategoryField
                    key={fc.fieldType}
                    field={{ ...fieldDef, required: fc.required }}
                    value={customFields[fc.fieldType] ?? null}
                    onChange={(val) =>
                      setCustomFields((prev) => ({ ...prev, [fc.fieldType]: val }))
                   }
                    formValues={{ priority, issueType, ...customFields }}
                    module="IT"
                  />
                )
             })}
          </div>
        )}

        {/* Form definition fields (new configurable forms system) */}
        {formDefFields.length > 0 && (
          <div className="space-y-4">
            <FormRenderer
              fields={formDefFields}
              responses={{ ...formFieldResponses, priority }}
              setResponses={(next) => {
                const { priority: _p, ...rest } = next
                setFormFieldResponses(rest)
             }}
            />
          </div>
        )}

        <div className="relative">
          <FloatingTextarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          {speechSupported && (
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`absolute right-3 top-3 p-1.5 rounded-lg transition-colors ${
                isRecording
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
             }`}
              title={isRecording ? 'Stop recording' : 'Voice input'}
            >
              {isRecording ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <Mic className="w-4 h-4" />
                </span>
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Priority — visible to coordinators */}
        {canManage && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Location: Building → Area → Room */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Location (optional)</label>
          <select
            value={buildingId}
            onChange={(e) => {
              setBuildingId(e.target.value)
              setAreaId('')
              setRoomId('')
           }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
          >
            <option value="">Select building...</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {areas.length > 0 && (
            <select
              value={areaId}
              onChange={(e) => { setAreaId(e.target.value); setRoomId('') }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              <option value="">Select area...</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}

          {rooms.length > 0 && (
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              <option value="">Select room...</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.displayName || r.roomNumber || r.id}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Campus */}
        {schools.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Campus</label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              <option value="">Select campus...</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

      </form>
    </DetailDrawer>
  )
}
