'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Sparkles, X, Loader2, Check, ArrowRight, RotateCcw } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'

// Web Speech API types (not in default TS lib)
interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}
interface SpeechRecognitionCtor { new(): SpeechRecognitionInstance }

// ─── Types ──────────────────────────────────────────────────────────────────

interface ContextItem {
  id: string
  name: string
  schoolName?: string
  teamName?: string
}

interface WorkflowContext {
  schools: ContextItem[]
  campuses: ContextItem[]
  categories: ContextItem[]
  teams: ContextItem[]
  members: ContextItem[]
}

interface ResolvedStep {
  teamId: string | null
  assignedUserId: string | null
  assignedUserName: string | null
  teamName: string
  mode: string
  trigger: string
}

interface ResolvedRule {
  name: string
  schoolId: string | null
  campusId: string | null
  categoryId: string | null
  executionMode: string
  isDefault: boolean
  steps: ResolvedStep[]
}

interface ParsedResult {
  rules: ResolvedRule[]
  summary: string
}

type Phase = 'input' | 'processing' | 'preview' | 'saving' | 'done'

// ─── Props ──────────────────────────────────────────────────────────────────

interface AIWorkflowCreatorProps {
  isOpen: boolean
  onClose: () => void
  context: WorkflowContext
  onRulesCreated: () => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AIWorkflowCreator({
  isOpen,
  onClose,
  context,
  onRulesCreated,
}: AIWorkflowCreatorProps) {
  const [phase, setPhase] = useState<Phase>('input')
  const [text, setText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState<ParsedResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // @ mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState(-1)
  const [mentionFilter, setMentionFilter] = useState<'person' | 'team' | 'school' | 'campus'>('person')
  const mentionContainerRef = useRef<HTMLDivElement>(null)

  // Cascading mention state — after selecting a school, offer to narrow to campus
  const [cascadeSchoolId, setCascadeSchoolId] = useState<string | null>(null)
  const [cascadeSchoolName, setCascadeSchoolName] = useState<string | null>(null)
  const [cascadeIndex, setCascadeIndex] = useState(0)
  const [cascadeInsertPos, setCascadeInsertPos] = useState(-1)

  // Build mention suggestions filtered by active category tab
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    const f = mentionFilter

    const people = f === 'person'
      ? context.members
          .filter(m => m.name.toLowerCase().includes(q))
          .map(m => ({ id: m.id, label: m.name, sublabel: m.teamName || '', type: 'person' as const }))
      : []
    const teamList = f === 'team'
      ? context.teams
          .filter(t => t.name.toLowerCase().includes(q))
          .map(t => ({ id: t.id, label: t.name, sublabel: 'Team', type: 'team' as const }))
      : []
    const schoolList = f === 'school'
      ? context.schools
          .filter(s => s.name.toLowerCase().includes(q))
          .map(s => ({ id: s.id, label: s.name, sublabel: 'School', type: 'school' as const }))
      : []
    const campusList = f === 'campus'
      ? context.campuses
          .filter(c => c.name.toLowerCase().includes(q))
          .map(c => ({ id: c.id, label: c.name, sublabel: c.schoolName || 'Campus', type: 'campus' as const }))
      : []
    return [...people, ...teamList, ...schoolList, ...campusList].slice(0, 10)
  }, [mentionQuery, mentionFilter, context.members, context.teams, context.schools, context.campuses])

  // Cascade suggestions — campuses belonging to the selected school
  const cascadeSuggestions = useMemo(() => {
    if (!cascadeSchoolId) return []
    return context.campuses
      .filter(c => c.schoolName === cascadeSchoolName)
      .map(c => ({ id: c.id, label: c.name, sublabel: cascadeSchoolName || 'Campus', type: 'campus' as const }))
  }, [cascadeSchoolId, cascadeSchoolName, context.campuses])

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)

    // Dismiss cascade if user starts typing
    if (cascadeSchoolId) {
      setCascadeSchoolId(null)
      setCascadeSchoolName(null)
    }

    // Detect @ mention
    const cursor = e.target.selectionStart || 0
    const before = val.slice(0, cursor)
    const atMatch = before.match(/@(\w*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setMentionStart(cursor - atMatch[0].length)
      setMentionIndex(0)
      setMentionFilter('person')
    } else {
      setMentionQuery(null)
    }
  }, [cascadeSchoolId])

  const insertMention = useCallback((suggestion: { id: string; label: string; type: 'person' | 'team' | 'school' | 'campus' }) => {
    const before = text.slice(0, mentionStart)
    const after = text.slice(textareaRef.current?.selectionStart || mentionStart)
    const newText = `${before}@${suggestion.label} ${after}`
    setText(newText)
    setMentionQuery(null)

    const insertEnd = mentionStart + suggestion.label.length + 2 // @name + space

    // If a school was selected and it has campuses, trigger cascade
    if (suggestion.type === 'school') {
      const schoolCampuses = context.campuses.filter(c => c.schoolName === suggestion.label)
      if (schoolCampuses.length > 0) {
        setCascadeSchoolId(suggestion.id)
        setCascadeSchoolName(suggestion.label)
        setCascadeIndex(0)
        setCascadeInsertPos(insertEnd)
        // Focus textarea but don't close cascade
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus()
            textareaRef.current.setSelectionRange(insertEnd, insertEnd)
          }
        })
        return
      }
    }

    // Normal flow — focus back on textarea
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(insertEnd, insertEnd)
      }
    })
  }, [text, mentionStart, context.campuses])

  // Insert a campus from the cascade dropdown
  const insertCascadeCampus = useCallback((suggestion: { label: string }) => {
    const before = text.slice(0, cascadeInsertPos)
    const after = text.slice(cascadeInsertPos)
    const newText = `${before}@${suggestion.label} ${after}`
    setText(newText)

    // Clear cascade state
    setCascadeSchoolId(null)
    setCascadeSchoolName(null)

    const pos = cascadeInsertPos + suggestion.label.length + 2
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(pos, pos)
      }
    })
  }, [text, cascadeInsertPos])

  // Skip cascade — dismiss without inserting a campus
  const dismissCascade = useCallback(() => {
    setCascadeSchoolId(null)
    setCascadeSchoolName(null)
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(cascadeInsertPos, cascadeInsertPos)
      }
    })
  }, [cascadeInsertPos])

  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle cascade dropdown navigation first
    if (cascadeSchoolId && cascadeSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        // +1 for the "Skip" option at the end
        setCascadeIndex(i => (i + 1) % (cascadeSuggestions.length + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCascadeIndex(i => (i - 1 + cascadeSuggestions.length + 1) % (cascadeSuggestions.length + 1))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (cascadeIndex < cascadeSuggestions.length) {
          insertCascadeCampus(cascadeSuggestions[cascadeIndex])
        } else {
          dismissCascade()
        }
      } else if (e.key === 'Escape') {
        dismissCascade()
      }
      return
    }

    // Normal @ mention navigation
    if (mentionQuery === null || mentionSuggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMentionIndex(i => (i + 1) % mentionSuggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionIndex(i => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      insertMention(mentionSuggestions[mentionIndex])
    } else if (e.key === 'Escape') {
      setMentionQuery(null)
    }
  }, [mentionQuery, mentionSuggestions, mentionIndex, insertMention, cascadeSchoolId, cascadeSuggestions, cascadeIndex, insertCascadeCampus, dismissCascade])

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setPhase('input')
      setText('')
      setTranscript('')
      setResult(null)
      setError(null)
      setIsListening(false)
      setCascadeSchoolId(null)
      setCascadeSchoolName(null)
    }
  }, [isOpen])

  // ─── Voice ──────────────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    const win = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
    const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      setError('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }

    // Request microphone permission explicitly — triggers the browser prompt
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Stop the stream immediately — we just needed the permission
      stream.getTracks().forEach(t => t.stop())
    } catch {
      setError('Microphone access denied. Please allow microphone access and try again.')
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript + ' '
        } else {
          interim = result[0].transcript
        }
      }
      setTranscript(final)
      setText(final + interim)
    }

    recognition.onerror = (event) => {
      if (event.error !== 'aborted') {
        setError(`Voice error: ${event.error}`)
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
    setError(null)
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
    // Use the final transcript
    if (transcript) {
      setText(transcript.trim())
    }
  }, [transcript])

  // ─── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const input = text.trim()
    if (input.length < 10) {
      setError('Please describe your approval workflow in more detail.')
      return
    }

    setPhase('processing')
    setError(null)

    try {
      const res = await fetch('/api/ai/parse-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: input, context }),
      })

      if (!res.ok) {
        throw new Error('Failed to parse workflow')
      }

      const json = await res.json()
      if (json.ok && json.data) {
        setResult(json.data as ParsedResult)
        setPhase('preview')
      } else {
        throw new Error(json.error?.message || 'Failed to parse')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('input')
    }
  }, [text, context])

  // ─── Create rules ───────────────────────────────────────────────────────

  const handleConfirm = useCallback(async () => {
    if (!result) return
    setPhase('saving')

    try {
      for (const rule of result.rules) {
        // Create the rule
        const ruleRes = await fetchApi('/api/settings/approval-rules', {
          method: 'POST',
          body: JSON.stringify({
            name: rule.name,
            schoolId: rule.schoolId,
            campusId: rule.campusId,
            eventCategory: rule.categoryId,
            isDefault: rule.isDefault,
            executionMode: rule.executionMode,
          }),
        }) as { rules?: Array<{ id: string; name: string }> }

        // Find the created rule's ID from the returned list
        const createdRules = ruleRes?.rules || (ruleRes as unknown as Array<{ id: string; name: string }>)
        const created = Array.isArray(createdRules)
          ? createdRules.find((r: { name: string }) => r.name === rule.name)
          : null

        if (created) {
          // Add steps to the rule
          for (const step of rule.steps) {
            if (!step.teamId) continue
            await fetchApi(`/api/settings/approval-rules/${created.id}/steps`, {
              method: 'POST',
              body: JSON.stringify({
                teamId: step.teamId,
                assignedUserId: step.assignedUserId,
                mode: step.mode,
                trigger: step.trigger,
              }),
            })
          }
        }
      }

      setPhase('done')
      onRulesCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rules')
      setPhase('preview')
    }
  }, [result, onRulesCreated])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-[100]"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-x-4 top-[10%] mx-auto max-w-2xl bg-white rounded-2xl shadow-2xl z-[100] flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Create with AI</h3>
              <p className="text-xs text-slate-500">Describe your approval workflow in plain English</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className={`flex-1 px-6 py-5 ${mentionQuery !== null || cascadeSchoolId ? 'overflow-visible' : 'overflow-y-auto'}`}>
          <AnimatePresence mode="wait">
            {/* ── Input phase ────────────────────────────────────────── */}
            {phase === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="relative" ref={mentionContainerRef}>
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleTextChange}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder={'Describe how approvals should work... Use @ to mention people or teams.\n\nExample: "For River Springs, any event that needs AV should be approved by @Kevin Patel. Large events need facilities and security sign-off too. Everything else just needs admin approval."'}
                    className="w-full h-40 px-4 py-3 text-sm bg-slate-50 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none resize-none placeholder:text-slate-400 transition-colors"
                  />
                  {isListening && (
                    <div className="absolute bottom-3 left-4 flex items-center gap-2">
                      <span className="flex h-2 w-2">
                        <span className="animate-ping absolute h-2 w-2 rounded-full bg-red-400 opacity-75" />
                        <span className="relative rounded-full h-2 w-2 bg-red-500" />
                      </span>
                      <span className="text-xs text-red-500 font-medium">Listening...</span>
                    </div>
                  )}

                  {/* @ mention dropdown */}
                  <AnimatePresence>
                    {mentionQuery !== null && mentionSuggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-4 right-4 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-10"
                      >
                        <div className="py-1 max-h-56 overflow-y-auto">
                          {/* Category filter tabs */}
                          <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 mb-1">
                            {([
                              { key: 'person', label: 'People' },
                              { key: 'team', label: 'Teams' },
                              { key: 'school', label: 'Schools' },
                              { key: 'campus', label: 'Campuses' },
                            ] as const).map(tab => (
                              <button
                                key={tab.key}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); setMentionFilter(tab.key); setMentionIndex(0) }}
                                className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-colors cursor-pointer ${
                                  mentionFilter === tab.key
                                    ? 'bg-slate-900 text-white'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                          {mentionSuggestions.map((s, i) => (
                            <button
                              key={`${s.type}-${s.id}`}
                              type="button"
                              onClick={() => insertMention(s)}
                              onMouseEnter={() => setMentionIndex(i)}
                              className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                                i === mentionIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                                s.type === 'person' ? 'bg-blue-100 text-blue-700'
                                  : s.type === 'team' ? 'bg-amber-100 text-amber-700'
                                  : s.type === 'school' ? 'bg-violet-100 text-violet-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {s.label.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{s.label}</p>
                                <p className="text-[10px] text-slate-400">{s.sublabel}</p>
                              </div>
                              <span className="text-[10px] text-slate-300 flex-shrink-0">
                                {s.type === 'person' ? 'Person' : s.type === 'team' ? 'Team' : s.type === 'school' ? 'School' : 'Campus'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Cascade dropdown — narrow school to campus */}
                  <AnimatePresence>
                    {cascadeSchoolId && cascadeSuggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-4 right-4 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-10"
                      >
                        <div className="py-1 max-h-48 overflow-y-auto">
                          <p className="px-3 py-1.5 text-[10px] font-semibold text-violet-500 uppercase tracking-wide flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                            Narrow down — {cascadeSchoolName}
                          </p>
                          {cascadeSuggestions.map((c, i) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => insertCascadeCampus(c)}
                              onMouseEnter={() => setCascadeIndex(i)}
                              className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                                i === cascadeIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 bg-green-100 text-green-700">
                                {c.label.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{c.label}</p>
                                <p className="text-[10px] text-slate-400">{c.sublabel}</p>
                              </div>
                              <span className="text-[10px] text-slate-300 flex-shrink-0">Campus</span>
                            </button>
                          ))}
                          {/* Skip option */}
                          <button
                            type="button"
                            onClick={dismissCascade}
                            onMouseEnter={() => setCascadeIndex(cascadeSuggestions.length)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors cursor-pointer border-t border-slate-100 ${
                              cascadeIndex === cascadeSuggestions.length ? 'bg-slate-100' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 bg-slate-100 text-slate-400">
                              ×
                            </div>
                            <p className="text-sm text-slate-500">Skip — use all campuses</p>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <div className="flex items-center gap-2">
                  {/* Voice button */}
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                      isListening
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {isListening ? (
                      <><MicOff className="w-4 h-4" /> Stop</>
                    ) : (
                      <><Mic className="w-4 h-4" /> Voice</>
                    )}
                  </button>

                  <div className="flex-1" />

                  {/* Submit */}
                  <button
                    onClick={handleSubmit}
                    disabled={text.trim().length < 10}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" /> Generate Rules
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Processing phase ───────────────────────────────────── */}
            {phase === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                <p className="text-sm font-medium text-slate-700">Analyzing your workflow...</p>
                <p className="text-xs text-slate-400 mt-1">Creating approval rules from your description</p>
              </motion.div>
            )}

            {/* ── Preview phase ──────────────────────────────────────── */}
            {phase === 'preview' && result && (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Summary */}
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                  <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">{result.summary}</p>
                </div>

                {/* Rules preview */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {result.rules.length} rule{result.rules.length !== 1 ? 's' : ''} will be created
                  </p>

                  {result.rules.map((rule, i) => (
                    <div key={i} className="p-4 border border-slate-200 rounded-xl space-y-2">
                      <p className="text-sm font-semibold text-slate-900">{rule.name}</p>

                      {/* Conditions */}
                      {!rule.isDefault ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] font-medium text-amber-600">When</span>
                          {rule.schoolId && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {context.schools.find(s => s.id === rule.schoolId)?.name || 'School'}
                            </span>
                          )}
                          {rule.campusId && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {context.campuses.find(c => c.id === rule.campusId)?.name || 'Campus'}
                            </span>
                          )}
                          {rule.categoryId && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {context.categories.find(c => c.id === rule.categoryId)?.name || 'Category'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-blue-500">Default — applies when no other rules match</p>
                      )}

                      {/* Steps */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {rule.steps.map((step, j) => (
                          <span key={j} className="text-xs text-slate-600">
                            {j > 0 && (
                              <span className="text-slate-300 mr-1.5">
                                {rule.executionMode === 'SEQUENTIAL' ? '→' : '+'}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full ${
                              step.mode === 'REQUIRED'
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {step.assignedUserName || step.teamName}
                            </span>
                          </span>
                        ))}
                      </div>

                      {/* Execution mode */}
                      <p className="text-[10px] text-slate-400">
                        {rule.executionMode === 'SEQUENTIAL' ? 'Sequential — each step waits for the previous' : 'Parallel — all reviewers at once'}
                      </p>
                    </div>
                  ))}
                </div>

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}
              </motion.div>
            )}

            {/* ── Saving phase ───────────────────────────────────────── */}
            {phase === 'saving' && (
              <motion.div
                key="saving"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <Loader2 className="w-8 h-8 text-slate-500 animate-spin mb-4" />
                <p className="text-sm font-medium text-slate-700">Creating approval rules...</p>
              </motion.div>
            )}

            {/* ── Done phase ─────────────────────────────────────────── */}
            {phase === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-slate-900">Workflow created!</p>
                <p className="text-xs text-slate-500 mt-1">
                  {result?.rules.length} rule{(result?.rules.length ?? 0) !== 1 ? 's' : ''} added to your approval workflow
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          {phase === 'preview' && (
            <>
              <button
                onClick={() => { setPhase('input'); setResult(null) }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Start over
              </button>
              <button
                onClick={handleConfirm}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Create {result?.rules.length} rule{(result?.rules.length ?? 0) !== 1 ? 's' : ''} <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
          {phase === 'done' && (
            <div className="w-full flex justify-center">
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
          {(phase === 'input' || phase === 'processing' || phase === 'saving') && (
            <div />
          )}
        </div>
      </motion.div>
    </>
  )
}
