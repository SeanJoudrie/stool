/**
 * Speech recognition.
 *
 * Uses the Web Speech API where it exists. Where it does not — and iOS Safari
 * is inconsistent about it — the screen falls back to a plain text field, and
 * the keyboard's own dictation key does the same job. That fallback is not a
 * degraded path: it produces exactly the same transcript through exactly the
 * same parser, and on iOS it is usually the more reliable of the two.
 *
 * Recognition runs in the browser's own speech service. Nothing is recorded or
 * stored by this app beyond the text the user confirms.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionAlternativeLike {
  transcript: string
}
interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: SpeechRecognitionAlternativeLike
  length: number
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const speechSupported = (): boolean => getRecognitionCtor() !== null

export interface SpeechState {
  supported: boolean
  listening: boolean
  transcript: string
  interim: string
  error: string | null
  start: () => void
  stop: () => void
  reset: () => void
  setTranscript: (text: string) => void
}

export function useSpeech(): SpeechState {
  const [supported] = useState(speechSupported)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setError('This browser cannot listen directly. Type below, or use your keyboard’s dictation key.')
      return
    }
    setError(null)
    setInterim('')

    const recognition = new Ctor()
    recognition.lang = navigator.language || 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (!result) continue
        const text = result[0].transcript
        if (result.isFinal) finalText += text
        else interimText += text
      }
      if (finalText) setTranscript((prev) => `${prev}${prev ? ' ' : ''}${finalText.trim()}`)
      setInterim(interimText)
    }

    recognition.onerror = (event) => {
      setListening(false)
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone access was blocked. Allow it in your browser settings, or type below.')
      } else if (event.error === 'no-speech') {
        setError('Did not catch anything. Try again, or type below.')
      } else if (event.error !== 'aborted') {
        setError('Speech recognition stopped unexpectedly. Type below instead.')
      }
    }

    recognition.onend = () => {
      setListening(false)
      setInterim('')
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      setError('Could not start listening. Type below instead.')
    }
  }, [])

  const reset = useCallback(() => {
    setTranscript('')
    setInterim('')
    setError(null)
  }, [])

  useEffect(() => () => recognitionRef.current?.abort(), [])

  return { supported, listening, transcript, interim, error, start, stop, reset, setTranscript }
}
