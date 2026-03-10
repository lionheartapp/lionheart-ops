'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Web Speech API hook for voice input.
 * Falls back gracefully when the browser doesn't support it.
 */

// Extend Window for SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList
  readonly resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

export interface UseSpeechRecognitionReturn {
  /** Whether the browser supports speech recognition */
  isSupported: boolean
  /** Whether we're currently listening */
  isListening: boolean
  /** The current transcript (interim + final) */
  transcript: string
  /** Start listening */
  startListening: () => void
  /** Stop listening */
  stopListening: () => void
  /** Toggle listening on/off */
  toggleListening: () => void
  /** Clear the transcript */
  clearTranscript: () => void
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  )
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const isSupported = typeof window !== 'undefined' && !!getSpeechRecognition()

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [])

  const startListening = useCallback(() => {
    const SR = getSpeechRecognition()
    if (!SR) return

    // Stop any existing instance
    if (recognitionRef.current) {
      recognitionRef.current.abort()
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }

      setTranscript(finalTranscript + interimTranscript)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are expected — don't treat as errors
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[SpeechRecognition] Error:', event.error)
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch (error) {
      console.warn('[SpeechRecognition] Failed to start:', error)
      setIsListening(false)
    }
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      setTranscript('')
      startListening()
    }
  }, [isListening, startListening, stopListening])

  const clearTranscript = useCallback(() => {
    setTranscript('')
  }, [])

  return {
    isSupported,
    isListening,
    transcript,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
  }
}
