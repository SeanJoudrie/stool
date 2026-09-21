/**
 * Application state.
 *
 * The whole journal is held in memory and mirrored to IndexedDB on write. That
 * is a defensible choice at this scale — a few years of diligent logging is a
 * few thousand small records — and it makes the analysis pass, which needs to
 * see every event at once, trivial instead of a query-planning exercise.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as db from './db/db'
import { DEFAULT_SETTINGS, newId, type FoodEntry, type Settings, type StoolEntry } from './db/schema'
import { processImage } from './lib/image'

interface StoreValue {
  ready: boolean
  error: string | null
  stool: StoolEntry[]
  food: FoodEntry[]
  settings: Settings

  saveStool: (entry: StoolEntry) => Promise<void>
  removeStool: (id: string) => Promise<void>
  saveFood: (entry: FoodEntry) => Promise<void>
  removeFood: (id: string) => Promise<void>
  saveSettings: (patch: Partial<Settings>) => Promise<void>

  addPhoto: (file: File) => Promise<string>
  removePhoto: (id: string) => Promise<void>

  reload: () => Promise<void>
  toast: (message: string) => void
  toastMessage: string | null
}

const StoreContext = createContext<StoreValue | null>(null)

export function blankStool(ts = Date.now()): StoolEntry {
  return {
    id: newId(),
    kind: 'stool',
    ts,
    bristol: null,
    color: null,
    urgency: null,
    pain: null,
    painPhase: [],
    rating: null,
    flags: [],
    photoId: null,
    notes: '',
    source: 'manual',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function blankFood(ts = Date.now()): FoodEntry {
  return {
    id: newId(),
    kind: 'food',
    ts,
    items: [],
    tags: [],
    mealKind: 'meal',
    waterOz: null,
    notes: '',
    source: 'manual',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stool, setStool] = useState<StoolEntry[]>([])
  const [food, setFood] = useState<FoodEntry[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const reload = useCallback(async () => {
    try {
      const [s, f, cfg] = await Promise.all([db.listStool(), db.listFood(), db.getSettings()])
      setStool(s.sort((a, b) => b.ts - a.ts))
      setFood(f.sort((a, b) => b.ts - a.ts))
      setSettings(cfg)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the journal.')
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // Theme is applied here rather than in a screen so it survives navigation.
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  const toast = useCallback((message: string) => {
    setToastMessage(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMessage(null), 3200)
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const saveStool = useCallback(async (entry: StoolEntry) => {
    const record = { ...entry, updatedAt: Date.now() }
    await db.putStool(record)
    setStool((prev) => [record, ...prev.filter((e) => e.id !== record.id)].sort((a, b) => b.ts - a.ts))
  }, [])

  const removeStool = useCallback(async (id: string) => {
    const existing = await db.getStool(id)
    if (existing?.photoId) await db.deletePhoto(existing.photoId)
    await db.deleteStool(id)
    setStool((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const saveFood = useCallback(async (entry: FoodEntry) => {
    const record = { ...entry, updatedAt: Date.now() }
    await db.putFood(record)
    setFood((prev) => [record, ...prev.filter((e) => e.id !== record.id)].sort((a, b) => b.ts - a.ts))
  }, [])

  const removeFood = useCallback(async (id: string) => {
    await db.deleteFood(id)
    setFood((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      void db.putSettings(next)
      return next
    })
  }, [])

  const addPhoto = useCallback(async (file: File) => {
    const { blob, width, height, mime } = await processImage(file)
    const id = newId()
    await db.putPhoto({ id, blob, mime, width, height, createdAt: Date.now() })
    return id
  }, [])

  const removePhoto = useCallback(async (id: string) => {
    await db.deletePhoto(id)
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      ready, error, stool, food, settings,
      saveStool, removeStool, saveFood, removeFood, saveSettings,
      addPhoto, removePhoto, reload, toast, toastMessage,
    }),
    [
      ready, error, stool, food, settings,
      saveStool, removeStool, saveFood, removeFood, saveSettings,
      addPhoto, removePhoto, reload, toast, toastMessage,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

/** Loads a stored photo as an object URL, revoking it when it goes away. */
export function usePhotoUrl(photoId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!photoId) {
      setUrl(null)
      return
    }
    let revoked = false
    let created: string | null = null

    void db.getPhoto(photoId).then((rec) => {
      if (!rec || revoked) return
      created = URL.createObjectURL(rec.blob)
      setUrl(created)
    })

    return () => {
      revoked = true
      if (created) URL.revokeObjectURL(created)
      setUrl(null)
    }
  }, [photoId])

  return url
}
