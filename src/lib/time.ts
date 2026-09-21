/** Local-time helpers. Everything the user sees is in their own timezone. */

export const HOUR = 3_600_000
export const DAY = 86_400_000

/** `YYYY-MM-DD` in local time — used to group entries by day. */
export function dateKey(ts: number | Date): string {
  const d = ts instanceof Date ? ts : new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function endOfDay(ts: number): number {
  return startOfDay(ts) + DAY - 1
}

export function dateKeyToTs(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime()
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDayLong(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(ts: number): string {
  return `${formatDay(ts)}, ${formatTime(ts)}`
}

/** "just now" / "14 min ago" / "3 h ago" / "Sun 2:17 PM". */
export function relativeTime(ts: number, now = Date.now()): string {
  const diff = now - ts
  if (diff < 0) return formatTime(ts)
  if (diff < 60_000) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < 12 * HOUR) {
    const h = Math.floor(diff / HOUR)
    return `${h} h ago`
  }
  if (startOfDay(now) === startOfDay(ts)) return formatTime(ts)
  if (startOfDay(now) - startOfDay(ts) === DAY) return `Yesterday ${formatTime(ts)}`
  return formatDateTime(ts)
}

/** Gap between a meal and a stool event, phrased the way the insights read. */
export function formatGap(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 10) return `${hours.toFixed(1)} h`
  return `${Math.round(hours)} h`
}

/** `<input type="datetime-local">` expects local wall-clock, not ISO/UTC. */
export function toLocalInput(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`
}

export function fromLocalInput(value: string): number {
  const ts = new Date(value).getTime()
  return Number.isNaN(ts) ? Date.now() : ts
}

/**
 * Inclusive list of local day keys spanning a range. Walks the calendar rather
 * than adding 86 400 000 ms, so a DST boundary does not skip or repeat a day.
 */
export function dayKeysBetween(from: number, to: number): string[] {
  const keys: string[] = []
  const cursor = new Date(startOfDay(from))
  while (cursor.getTime() <= to) {
    keys.push(dateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
    cursor.setHours(0, 0, 0, 0)
  }
  return keys
}

export function isOvernight(ts: number): boolean {
  const h = new Date(ts).getHours()
  return h >= 0 && h < 5
}
