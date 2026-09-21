/**
 * Storage.
 *
 * Everything lives in IndexedDB on the device. There is no server, no account
 * and no sync, which is a deliberate choice rather than a missing feature:
 * this database holds symptom records and photographs of them, and the safest
 * place for that is the one place it cannot leak from. Export produces a file
 * the user moves themselves.
 */
import {
  DEFAULT_SETTINGS,
  type DailyEntry,
  type FoodEntry,
  type PhotoRecord,
  type Settings,
  type StoolEntry,
} from './schema'

const DB_NAME = 'stool-journal'
const DB_VERSION = 1

export const STORE = {
  stool: 'stool',
  food: 'food',
  daily: 'daily',
  photos: 'photos',
  settings: 'settings',
} as const

type StoreName = (typeof STORE)[keyof typeof STORE]

let dbPromise: Promise<IDBDatabase> | null = null

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser has no IndexedDB, so the journal cannot be stored.'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE.stool)) {
        db.createObjectStore(STORE.stool, { keyPath: 'id' }).createIndex('ts', 'ts')
      }
      if (!db.objectStoreNames.contains(STORE.food)) {
        db.createObjectStore(STORE.food, { keyPath: 'id' }).createIndex('ts', 'ts')
      }
      if (!db.objectStoreNames.contains(STORE.daily)) {
        db.createObjectStore(STORE.daily, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE.photos)) {
        db.createObjectStore(STORE.photos, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE.settings)) {
        db.createObjectStore(STORE.settings, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open the journal database.'))
    req.onblocked = () =>
      reject(new Error('The journal is open in another tab. Close it and reload.'))
  })
  return dbPromise
}

function tx<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode)
        const req = run(transaction.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        transaction.onabort = () => reject(transaction.error)
      }),
  )
}

async function getAllInRange<T>(store: StoreName, from?: number, to?: number): Promise<T[]> {
  const db = await openDb()
  return new Promise<T[]>((resolve, reject) => {
    const transaction = db.transaction(store, 'readonly')
    const index = transaction.objectStore(store).index('ts')
    let range: IDBKeyRange | undefined
    if (from !== undefined && to !== undefined) range = IDBKeyRange.bound(from, to)
    else if (from !== undefined) range = IDBKeyRange.lowerBound(from)
    else if (to !== undefined) range = IDBKeyRange.upperBound(to)
    const req = index.getAll(range)
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

// -- stool ---------------------------------------------------------------

export const putStool = (e: StoolEntry) => tx(STORE.stool, 'readwrite', (s) => s.put(e))
export const deleteStool = (id: string) => tx(STORE.stool, 'readwrite', (s) => s.delete(id))
export const getStool = (id: string) =>
  tx<StoolEntry | undefined>(STORE.stool, 'readonly', (s) => s.get(id))
export const listStool = (from?: number, to?: number) =>
  getAllInRange<StoolEntry>(STORE.stool, from, to)

// -- food ----------------------------------------------------------------

export const putFood = (e: FoodEntry) => tx(STORE.food, 'readwrite', (s) => s.put(e))
export const deleteFood = (id: string) => tx(STORE.food, 'readwrite', (s) => s.delete(id))
export const getFood = (id: string) =>
  tx<FoodEntry | undefined>(STORE.food, 'readonly', (s) => s.get(id))
export const listFood = (from?: number, to?: number) =>
  getAllInRange<FoodEntry>(STORE.food, from, to)

// -- daily ---------------------------------------------------------------

export const putDaily = (e: DailyEntry) => tx(STORE.daily, 'readwrite', (s) => s.put(e))
export const getDaily = (dateKey: string) =>
  tx<DailyEntry | undefined>(STORE.daily, 'readonly', (s) => s.get(dateKey))
export const listDaily = () => tx<DailyEntry[]>(STORE.daily, 'readonly', (s) => s.getAll())
export const deleteDaily = (id: string) => tx(STORE.daily, 'readwrite', (s) => s.delete(id))

// -- photos --------------------------------------------------------------

export const putPhoto = (p: PhotoRecord) => tx(STORE.photos, 'readwrite', (s) => s.put(p))
export const getPhoto = (id: string) =>
  tx<PhotoRecord | undefined>(STORE.photos, 'readonly', (s) => s.get(id))
export const deletePhoto = (id: string) => tx(STORE.photos, 'readwrite', (s) => s.delete(id))
export const listPhotoIds = () => tx<string[]>(STORE.photos, 'readonly', (s) => s.getAllKeys() as IDBRequest<string[]>)

// -- settings ------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  const stored = await tx<Settings | undefined>(STORE.settings, 'readonly', (s) => s.get('settings'))
  // Merge rather than replace so a schema addition does not wipe preferences.
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
}

export const putSettings = (s: Settings) => tx(STORE.settings, 'readwrite', (st) => st.put(s))

// -- whole-database operations -------------------------------------------

export interface ExportBundle {
  format: 'stool-journal-export'
  version: number
  exportedAt: string
  settings: Settings
  stool: StoolEntry[]
  food: FoodEntry[]
  daily: DailyEntry[]
  /** Present only when the user explicitly opts to include images. */
  photos?: { id: string; mime: string; width: number; height: number; dataUrl: string }[]
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

export async function exportAll(includePhotos: boolean): Promise<ExportBundle> {
  const [settings, stool, food, daily] = await Promise.all([
    getSettings(),
    listStool(),
    listFood(),
    listDaily(),
  ])
  const bundle: ExportBundle = {
    format: 'stool-journal-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    stool,
    food,
    daily,
  }
  if (includePhotos) {
    const ids = await listPhotoIds()
    const photos: NonNullable<ExportBundle['photos']> = []
    for (const id of ids) {
      const rec = await getPhoto(id)
      if (!rec) continue
      photos.push({
        id: rec.id,
        mime: rec.mime,
        width: rec.width,
        height: rec.height,
        dataUrl: await blobToDataUrl(rec.blob),
      })
    }
    bundle.photos = photos
  }
  return bundle
}

export interface ImportResult {
  stool: number
  food: number
  daily: number
  photos: number
}

/**
 * Merges a bundle into the existing journal. Entries are keyed by id, so
 * re-importing the same export is idempotent rather than duplicating.
 */
export async function importAll(bundle: unknown): Promise<ImportResult> {
  if (
    typeof bundle !== 'object' ||
    bundle === null ||
    (bundle as ExportBundle).format !== 'stool-journal-export'
  ) {
    throw new Error('That file is not a journal export.')
  }
  const b = bundle as ExportBundle
  const result: ImportResult = { stool: 0, food: 0, daily: 0, photos: 0 }

  for (const e of b.stool ?? []) {
    await putStool(e)
    result.stool++
  }
  for (const e of b.food ?? []) {
    await putFood(e)
    result.food++
  }
  for (const e of b.daily ?? []) {
    await putDaily(e)
    result.daily++
  }
  for (const p of b.photos ?? []) {
    await putPhoto({
      id: p.id,
      blob: await dataUrlToBlob(p.dataUrl),
      mime: p.mime,
      width: p.width,
      height: p.height,
      createdAt: Date.now(),
    })
    result.photos++
  }
  return result
}

export async function wipeAll(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const names: StoreName[] = [STORE.stool, STORE.food, STORE.daily, STORE.photos, STORE.settings]
    const transaction = db.transaction(names, 'readwrite')
    for (const n of names) transaction.objectStore(n).clear()
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

/** Rough on-device footprint, for the storage line in Settings. */
export async function estimateUsage(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usage, quota }
}
