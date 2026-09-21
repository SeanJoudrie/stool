/**
 * Red-flag detection.
 *
 * Everything here is derived from stool entries alone. Fever, unintended
 * weight loss and volume-depletion signs were dropped along with the daily
 * check-in: this is a poop journal, and a rule with no honest data behind it
 * is worse than no rule.
 *
 * These are the findings that change what should happen next, rather than what
 * should be tracked. The app states what it observed and what that class of
 * finding warrants; it does not name a diagnosis, and it never tells someone
 * they are fine. "Nothing flagged" is always phrased as "nothing flagged in
 * what you logged".
 *
 * Copy discipline matters here. Someone reads these while already worried, in
 * a bathroom. Plain, specific, calm — no alarm words, no hedging into
 * uselessness.
 */
import type { StoolEntry } from '../db/schema'
import { DAY, HOUR, formatDay } from './time'

export type FlagSeverity = 'urgent' | 'soon' | 'discuss'

export interface RedFlag {
  id: string
  severity: FlagSeverity
  title: string
  /** What this class of finding warrants. Never a diagnosis. */
  detail: string
  /** What in the log triggered it, so the user can check the reasoning. */
  evidence: string
}

export const SEVERITY_HEADING: Record<FlagSeverity, string> = {
  urgent: 'Worth being seen promptly',
  soon: 'Worth booking an appointment',
  discuss: 'Worth raising at your next visit',
}

/**
 * Flags raised by a single entry, shown immediately after it saves. Kept
 * separate from the log-wide scan so saving an entry never runs a full
 * history pass.
 */
export function flagsForEntry(entry: StoolEntry): RedFlag[] {
  const flags: RedFlag[] = []

  if (entry.flags.includes('blood') || entry.color === 'red') {
    flags.push({
      id: 'blood',
      severity: 'urgent',
      title: 'You logged visible blood',
      detail:
        'Visible blood in stool always warrants being looked at, even when it turns out to be something minor like a fissure or haemorrhoid. Do not wait for it to happen again before mentioning it.',
      evidence: 'This entry recorded blood or red colour.',
    })
  }

  if (entry.color === 'black') {
    flags.push({
      id: 'black',
      severity: 'urgent',
      title: 'You logged black or tarry stool',
      detail:
        'Black, tarry stool can indicate bleeding higher in the digestive tract and should be assessed. Iron supplements, bismuth (Pepto-Bismol) and black liquorice also cause it — if you took any of those, note it, but still mention it.',
      evidence: 'This entry recorded black or tarry colour.',
    })
  }

  if (entry.color === 'pale') {
    flags.push({
      id: 'pale',
      severity: 'soon',
      title: 'You logged pale or clay-coloured stool',
      detail:
        'Pale stool that persists across several events can point to a problem with bile reaching the gut. A single pale event after a very fatty meal is less notable — the pattern is what matters.',
      evidence: 'This entry recorded pale or clay colour.',
    })
  }

  if (entry.pain !== null && entry.pain >= 8) {
    flags.push({
      id: 'severe-pain',
      severity: 'soon',
      title: `You logged pain at ${entry.pain}/10`,
      detail:
        'Pain at this level is worth reporting. If it is sharp and stays in one specific spot rather than moving or cramping across the abdomen, that detail is important — mention where.',
      evidence: `This entry recorded ${entry.pain}/10 pain.`,
    })
  }

  return flags
}

/** Flags that only emerge from looking across the whole log. */
export function scanLog(stool: StoolEntry[], now = Date.now()): RedFlag[] {
  const flags: RedFlag[] = []
  const recent = stool.filter((e) => e.ts >= now - 30 * DAY).sort((a, b) => a.ts - b.ts)

  // --- sustained diarrhoea -------------------------------------------------
  // A run of loose events with no formed stool in between, spanning >48 h.
  let runStart: number | null = null
  let longestRunHours = 0
  let longestRunStart = 0
  for (const e of recent) {
    const loose = e.bristol === 6 || e.bristol === 7
    if (loose) {
      if (runStart === null) runStart = e.ts
      const hours = (e.ts - runStart) / HOUR
      if (hours > longestRunHours) {
        longestRunHours = hours
        longestRunStart = runStart
      }
    } else if (e.bristol !== null) {
      runStart = null
    }
  }
  if (longestRunHours >= 48) {
    flags.push({
      id: 'sustained-diarrhoea',
      severity: longestRunHours >= 72 ? 'urgent' : 'soon',
      title: `Loose stool continued for about ${Math.round(longestRunHours)} hours`,
      detail:
        'Diarrhoea lasting beyond 48 to 72 hours is past the point where it is usually worth waiting out, mostly because of fluid and electrolyte loss. Replacing fluids properly matters as much as the cause.',
      evidence: `An unbroken run of type 6–7 events starting ${formatDay(longestRunStart)}.`,
    })
  }

  // --- nocturnal diarrhoea -------------------------------------------------
  const nocturnal = recent.filter(
    (e) => (e.bristol === 6 || e.bristol === 7) && new Date(e.ts).getHours() < 5,
  )
  if (nocturnal.length >= 2) {
    flags.push({
      id: 'nocturnal',
      severity: 'soon',
      title: `Loose stool woke you ${nocturnal.length} times`,
      detail:
        'Diarrhoea that wakes you from sleep is one of the details that separates an inflammatory cause from a functional one. It is a specific, useful thing to tell a gastroenterologist.',
      evidence: `${nocturnal.length} type 6–7 events between midnight and 5 a.m. in the last 30 days.`,
    })
  }

  // --- recurrence ----------------------------------------------------------
  const poor = recent.filter((e) => e.rating !== null && e.rating <= 3)
  if (poor.length >= 6) {
    flags.push({
      id: 'recurring',
      severity: 'discuss',
      title: `${poor.length} events you rated 3/10 or worse in the last 30 days`,
      detail:
        'Recurring episodes are the pattern that gets conditions like coeliac disease, inflammatory bowel disease, bile acid malabsorption and pancreatic insufficiency identified. All of them are manageable once named, and all of them are missed when episodes are treated as one-offs. This log is exactly what a gastroenterologist needs to see.',
      evidence: `${poor.length} low-rated events since ${formatDay(now - 30 * DAY)}.`,
    })
  }

  return flags
}

export function allFlags(stool: StoolEntry[], now = Date.now()): RedFlag[] {
  const perEntry = stool
    .filter((e) => e.ts >= now - 30 * DAY)
    .flatMap(flagsForEntry)
  // One card per finding type, keeping the most severe instance.
  const order: Record<FlagSeverity, number> = { urgent: 0, soon: 1, discuss: 2 }
  const byId = new Map<string, RedFlag>()
  for (const f of [...perEntry, ...scanLog(stool, now)]) {
    const prev = byId.get(f.id)
    if (!prev || order[f.severity] < order[prev.severity]) byId.set(f.id, f)
  }
  return [...byId.values()].sort((a, b) => order[a.severity] - order[b.severity])
}
