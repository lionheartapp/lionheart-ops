'use client'

import { useState, useMemo, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingTextarea } from '@/components/ui/FloatingInput'
import { useToast } from '@/components/Toast'
import { Loader2, Mic } from 'lucide-react'

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

const ISSUE_TYPES = [
  { value: 'HARDWARE', label: 'Hardware' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'ACCOUNT_PASSWORD', label: 'Account / Password' },
  { value: 'NETWORK', label: 'Network' },
  { value: 'DISPLAY_AV', label: 'Display / A/V' },
  { value: 'OTHER', label: 'Other' },
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
  const [error, setError] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSpeechSupported(!!SpeechRecognition)
  }, [])

  const toggleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (isRecording) {
      if ((window as any).__speechRecognition) {
        (window as any).__speechRecognition.stop()
        ;(window as any).__speechRecognition = null
      }
      setIsRecording(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
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
    ;(window as any).__speechRecognition = recognition
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

  const selectedBuilding = buildings.find((b) => b.id === buildingId)
  const areas = selectedBuilding?.areas ?? []
  const selectedArea = areas.find((a) => a.id === areaId)
  const rooms = selectedArea?.rooms ?? selectedBuilding?.rooms ?? []

  const createMutation = useMutation({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itTickets.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.itBoard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.itDashboard.all })
      toast('IT ticket submitted successfully', 'success')
      resetForm()
      onClose()
    },
    onError: (err: Error) => {
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
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Request
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all"
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
        className="px-6 py-4 space-y-4"
      >
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
            <span className="text-[11px] text-gray-400 mr-1 self-center">Suggestions:</span>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Issue Type *</label>
          <select
            value={issueType}
            onChange={(e) => {
              setIssueType(e.target.value)
              setPasswordSubType('')
              setAvSubType('')
            }}
            required
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
          >
            <option value="">Select type...</option>
            {ISSUE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Password sub-type */}
        {issueType === 'ACCOUNT_PASSWORD' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password Issue Type</label>
            <select
              value={passwordSubType}
              onChange={(e) => setPasswordSubType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">A/V Equipment</label>
            <select
              value={avSubType}
              onChange={(e) => setAvSubType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              <option value="">Select...</option>
              {AV_SUB_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
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
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Location: Building → Area → Room */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Location (optional)</label>
          <select
            value={buildingId}
            onChange={(e) => {
              setBuildingId(e.target.value)
              setAreaId('')
              setRoomId('')
            }}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
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
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
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
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Campus</label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
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
