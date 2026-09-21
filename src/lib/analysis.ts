/**
 * The correlation engine.
 *
 * For every stool event it looks back over 2 / 6 / 12 / 24 / 48 hour windows
 * and asks which exposures were present. The window that best explains an
 * association is itself the clinically interesting part: a two-hour response
 * looks like an intolerance, a twelve-to-twenty-four hour one looks like
 * foodborne illness or an inflammatory response.
 *
 * The hard constraint here is honesty. With a few weeks of data and twenty
 * candidate tags across five windows, noise will happily produce a
 * "correlation" for anything, so this module:
 *
 *   - ignores any event whose preceding 24 h contains no food entries at all,
 *     because "no exposure logged" is not the same as "no exposure";
 *   - requires a minimum number of both exposed and unexposed events before a
 *     comparison is allowed to exist;
 *   - requires a minimum difference in rate, not just any difference;
 *   - reports the raw counts on both sides so the user can see how thin the
 *     evidence is;
 *   - never uses causal language, and never names a disease.
 */
import {
  FOOD_TAGS,
  FOOD_TAG_LABEL,
  bristolBand,
  type FoodEntry,
  type FoodTag,
  type StoolEntry,
} from '../db/schema'
import { normalizeFoodText } from './foodTags'
import { HOUR, dateKey, dateKeyToTs, dayKeysBetween, isOvernight } from './time'

export const LOOKBACK_WINDOWS = [2, 6, 12, 24, 48] as const
export type LookbackWindow = (typeof LOOKBACK_WINDOWS)[number]

/** Evidence thresholds. Exported so the UI can state them verbatim. */
export const THRESHOLDS = {
  minExposed: 6,
  minUnexposed: 6,
  minLift: 0.25,
  minEventsForAnalysis: 10,
  minDaysForAnalysis: 7,
  /**
   * Individual items need more evidence than tags. There are an order of
   * magnitude more of them, so at the same threshold the top of the list fills
   * with four-out-of-four coincidences that push the real, better-evidenced
   * tag findings off the screen.
   */
  minExposedItem: 8,
  /**
   * An exposure present in almost every event has no usable comparison group.
   * Someone who drinks coffee daily produces "caffeine: 11/44 poor versus 0/6"
   * — which is not evidence about caffeine, it is six atypical days. Above this
   * share the comparison is dropped rather than reported.
   */
  maxExposedShare: 0.8,
} as const

// ------------------------------------------------------------- severity ---

/**
 * Derives a 1–10 quality score from the clinical fields, where 10 is the
 * "healthy, quick, clean" end. Used to pre-fill the rating on the entry form
 * and to classify an event when the user did not rate it themselves.
 */
export function deriveRating(e: Pick<StoolEntry, 'bristol' | 'pain' | 'urgency' | 'flags' | 'color'>): number | null {
  const hasAnything =
    e.bristol !== null || e.pain !== null || e.urgency !== null || e.flags.length > 0 || e.color !== null
  if (!hasAnything) return null

  let score = 10

  if (e.bristol !== null) {
    const penalty: Record<number, number> = { 1: 5, 2: 3, 3: 1, 4: 0, 5: 1, 6: 3, 7: 5 }
    score -= penalty[e.bristol] ?? 0
  }
  if (e.pain !== null) score -= (e.pain - 1) * 0.55
  if (e.urgency !== null) {
    if (e.urgency >= 8) score -= 2
    else if (e.urgency >= 6) score -= 1
  }
  if (e.color === 'black' || e.color === 'red' || e.color === 'pale') score -= 3
  else if (e.color === 'yellow' || e.color === 'green') score -= 1

  const flagPenalty: Record<string, number> = {
    blood: 4, oil: 2, mucus: 1, undigested: 1, straining: 1, incomplete: 1, odor: 0.5, floating: 0.5,
  }
  for (const f of e.flags) score -= flagPenalty[f] ?? 0

  return Math.max(1, Math.min(10, Math.round(score)))
}

/** The event classifier every rate in this module is computed against. */
export function isPoorEvent(e: StoolEntry): boolean {
  const rating = e.rating ?? deriveRating(e)
  if (rating === null) return false
  return rating <= 4
}

export function effectiveRating(e: StoolEntry): number | null {
  return e.rating ?? deriveRating(e)
}

// ------------------------------------------------------------- exposures ---

interface Exposure {
  tags: Set<FoodTag>
  items: Set<string>
  /** First time each tag appeared inside the window, for transit timing. */
  firstSeen: Map<string, number>
}

function exposuresWithin(event: StoolEntry, foods: FoodEntry[], windowHours: number): Exposure {
  const from = event.ts - windowHours * HOUR
  const tags = new Set<FoodTag>()
  const items = new Set<string>()
  const firstSeen = new Map<string, number>()

  for (const f of foods) {
    if (f.ts < from || f.ts > event.ts) continue
    for (const t of f.tags) {
      tags.add(t)
      const prev = firstSeen.get(t)
      if (prev === undefined || f.ts < prev) firstSeen.set(t, f.ts)
    }
    for (const raw of f.items) {
      const item = normalizeFoodText(raw)
      if (!item) continue
      items.add(item)
      const prev = firstSeen.get(`item:${item}`)
      if (prev === undefined || f.ts < prev) firstSeen.set(`item:${item}`, f.ts)
    }
  }
  return { tags, items, firstSeen }
}

// ----------------------------------------------------------- correlation ---

export type Confidence = 'preliminary' | 'emerging' | 'consistent'

export interface Correlation {
  key: string
  kind: 'tag' | 'item'
  label: string
  note: string
  windowHours: number
  exposedCount: number
  exposedPoor: number
  unexposedCount: number
  unexposedPoor: number
  exposedRate: number
  unexposedRate: number
  /** Percentage-point difference. Positive means worse after exposure. */
  lift: number
  confidence: Confidence
  /** Median hours from the exposure to the poor event, when measurable. */
  medianGapHours: number | null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? ((s[mid - 1]! + s[mid]!) / 2) : s[mid]!
}

function confidenceFor(exposedCount: number): Confidence {
  if (exposedCount >= 10) return 'consistent'
  if (exposedCount >= 6) return 'emerging'
  return 'preliminary'
}

interface Candidate {
  key: string
  kind: Correlation['kind']
  label: string
  note: string
  present: (ex: Exposure) => boolean
  gapKey?: string
}

function buildCorrelation(
  candidate: Candidate,
  events: StoolEntry[],
  exposureByEvent: Map<string, Exposure>,
  windowHours: number,
): Correlation | null {
  let exposedCount = 0
  let exposedPoor = 0
  let unexposedCount = 0
  let unexposedPoor = 0
  const gaps: number[] = []

  for (const e of events) {
    const ex = exposureByEvent.get(e.id)
    if (!ex) continue
    const poor = isPoorEvent(e)
    if (candidate.present(ex)) {
      exposedCount++
      if (poor) {
        exposedPoor++
        const seen = candidate.gapKey ? ex.firstSeen.get(candidate.gapKey) : undefined
        if (seen !== undefined) gaps.push((e.ts - seen) / HOUR)
      }
    } else {
      unexposedCount++
      if (poor) unexposedPoor++
    }
  }

  const minExposed =
    candidate.kind === 'item' ? THRESHOLDS.minExposedItem : THRESHOLDS.minExposed
  if (exposedCount < minExposed || unexposedCount < THRESHOLDS.minUnexposed) return null

  const total = exposedCount + unexposedCount
  if (exposedCount / total > THRESHOLDS.maxExposedShare) return null

  const exposedRate = exposedPoor / exposedCount
  const unexposedRate = unexposedPoor / unexposedCount

  return {
    key: candidate.key,
    kind: candidate.kind,
    label: candidate.label,
    note: candidate.note,
    windowHours,
    exposedCount,
    exposedPoor,
    unexposedCount,
    unexposedPoor,
    exposedRate,
    unexposedRate,
    lift: exposedRate - unexposedRate,
    confidence: confidenceFor(exposedCount),
    medianGapHours: median(gaps),
  }
}

// --------------------------------------------------------------- summary ---

export interface Summary {
  totalEvents: number
  eventsPerDay: number
  daysLogged: number
  normalBandShare: number
  medianRating: number | null
  medianPain: number | null
  overnightEvents: number
  bloodEvents: number
  poorEvents: number
  /** Ounces of water logged per day alongside meals, when any were. */
  avgWaterOz: number | null
  longestGapDays: number | null
}

export interface BristolBucket {
  type: number
  count: number
  share: number
}

export interface DayBucket {
  key: string
  ts: number
  hard: number
  normal: number
  loose: number
  total: number
}

export interface TimelinePoint {
  ts: number
  bristol: number | null
  rating: number | null
  poor: boolean
}

/**
 * A plain-language read on the log that works with stool entries alone.
 *
 * Most people will only ever log the bad ones and will never meet the bar for
 * a food correlation. They still deserve an answer when they open this screen,
 * so this never depends on meals being logged.
 */
export interface Headline {
  sentence: string
  /** Rate of poor events in the last 14 days against the 14 before, when both exist. */
  direction: 'better' | 'worse' | 'steady' | 'unknown'
  detail: string | null
}

export function headlineFor(stool: StoolEntry[], now = Date.now()): Headline {
  const total = stool.length
  if (total === 0) {
    return {
      sentence: 'Nothing logged yet.',
      direction: 'unknown',
      detail: 'Log an entry whenever something is worth remembering — good or bad.',
    }
  }

  const poor = stool.filter(isPoorEvent).length
  const days = new Set(stool.map((e) => dateKey(e.ts))).size
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  // "1 entry over 1 day. 1 of them was rough" is technically right and reads
  // like a robot, and this is the first sentence a new user ever sees.
  const sentence =
    total === 1
      ? poor === 1
        ? 'One entry so far, and it was a rough one.'
        : 'One entry so far. Keep going — a few more and this starts telling you something.'
      : poor === 0
        ? `${plural(total, 'entry', 'entries')} over ${plural(days, 'day', 'days')}, and none of them were rough.`
        : `${plural(total, 'entry', 'entries')} over ${plural(days, 'day', 'days')}. ${poor} of them ${poor === 1 ? 'was' : 'were'} rough or worse.`

  const recentWindow = stool.filter((e) => e.ts >= now - 14 * 86_400_000)
  const priorWindow = stool.filter(
    (e) => e.ts >= now - 28 * 86_400_000 && e.ts < now - 14 * 86_400_000,
  )

  // Both halves need enough events for a comparison to mean anything.
  if (recentWindow.length < 4 || priorWindow.length < 4) {
    return { sentence, direction: 'unknown', detail: null }
  }

  const recentRate = recentWindow.filter(isPoorEvent).length / recentWindow.length
  const priorRate = priorWindow.filter(isPoorEvent).length / priorWindow.length
  const delta = recentRate - priorRate

  if (Math.abs(delta) < 0.15) {
    return { sentence, direction: 'steady', detail: 'The last two weeks look much like the two before.' }
  }
  return {
    sentence,
    direction: delta < 0 ? 'better' : 'worse',
    detail:
      delta < 0
        ? `The last two weeks have gone better than the two before — ${Math.round(recentRate * 100)}% rough, down from ${Math.round(priorRate * 100)}%.`
        : `The last two weeks have been worse than the two before — ${Math.round(recentRate * 100)}% rough, up from ${Math.round(priorRate * 100)}%.`,
  }
}

export interface AnalysisResult {
  /** False when there is not yet enough logged to say anything at all. */
  ready: boolean
  reason: string | null
  coverage: {
    eventsTotal: number
    eventsAnalysed: number
    daysLogged: number
    foodEntries: number
  }
  summary: Summary
  bristol: BristolBucket[]
  timeline: TimelinePoint[]
  days: DayBucket[]
  triggers: Correlation[]
  protective: Correlation[]
}

function summarize(stool: StoolEntry[], food: FoodEntry[]): Summary {
  const days = new Set(stool.map((e) => dateKey(e.ts)))
  for (const f of food) days.add(dateKey(f.ts))
  const daysLogged = days.size || 1

  const ratings = stool.map(effectiveRating).filter((r): r is number => r !== null)
  const pains = stool.map((e) => e.pain).filter((p): p is number => p !== null)
  const inBand = stool.filter((e) => e.bristol !== null && bristolBand(e.bristol) === 'normal').length
  const withBristol = stool.filter((e) => e.bristol !== null).length

  // Water is logged against meals, so it totals per day rather than averaging
  // over entries.
  const waterByDay = new Map<string, number>()
  for (const f of food) {
    if (f.waterOz === null) continue
    const key = dateKey(f.ts)
    waterByDay.set(key, (waterByDay.get(key) ?? 0) + f.waterOz)
  }
  const waters = [...waterByDay.values()]

  // Longest run of days with no stool event at all — a constipation signal.
  let longestGapDays: number | null = null
  const sorted = [...stool].sort((a, b) => a.ts - b.ts)
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i]!.ts - sorted[i - 1]!.ts) / 86_400_000
    if (longestGapDays === null || gap > longestGapDays) longestGapDays = gap
  }

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

  return {
    totalEvents: stool.length,
    eventsPerDay: stool.length / daysLogged,
    daysLogged,
    normalBandShare: withBristol > 0 ? inBand / withBristol : 0,
    medianRating: median(ratings),
    medianPain: median(pains),
    overnightEvents: stool.filter((e) => isOvernight(e.ts)).length,
    bloodEvents: stool.filter((e) => e.flags.includes('blood') || e.color === 'red' || e.color === 'black').length,
    poorEvents: stool.filter(isPoorEvent).length,
    avgWaterOz: mean(waters),
    longestGapDays,
  }
}

// ------------------------------------------------------------------ main ---

export function analyse(stool: StoolEntry[], food: FoodEntry[]): AnalysisResult {
  const events = [...stool].sort((a, b) => a.ts - b.ts)
  const foods = [...food].sort((a, b) => a.ts - b.ts)

  const summary = summarize(events, foods)

  const bristolCounts = new Map<number, number>()
  for (const e of events) if (e.bristol !== null) bristolCounts.set(e.bristol, (bristolCounts.get(e.bristol) ?? 0) + 1)
  const withBristol = [...bristolCounts.values()].reduce((a, b) => a + b, 0)
  const bristol: BristolBucket[] = [1, 2, 3, 4, 5, 6, 7].map((type) => {
    const count = bristolCounts.get(type) ?? 0
    return { type, count, share: withBristol > 0 ? count / withBristol : 0 }
  })

  const timeline: TimelinePoint[] = events.map((e) => ({
    ts: e.ts,
    bristol: e.bristol,
    rating: effectiveRating(e),
    poor: isPoorEvent(e),
  }))

  // One column per calendar day, including days with no events, so a gap in
  // the strip reads as a gap rather than being silently closed up.
  const days: DayBucket[] = []
  if (events.length > 0) {
    const buckets = new Map<string, DayBucket>()
    for (const key of dayKeysBetween(events[0]!.ts, events[events.length - 1]!.ts)) {
      buckets.set(key, { key, ts: dateKeyToTs(key), hard: 0, normal: 0, loose: 0, total: 0 })
    }
    for (const e of events) {
      if (e.bristol === null) continue
      const bucket = buckets.get(dateKey(e.ts))
      if (!bucket) continue
      bucket[bristolBand(e.bristol)]++
      bucket.total++
    }
    days.push(...buckets.values())
  }

  const coverage = {
    eventsTotal: events.length,
    eventsAnalysed: 0,
    daysLogged: summary.daysLogged,
    foodEntries: foods.length,
  }

  const base: AnalysisResult = {
    ready: false,
    reason: null,
    coverage,
    summary,
    bristol,
    timeline,
    days,
    triggers: [],
    protective: [],
  }

  // Only events with food logged in the preceding 24 h can be compared: an
  // event with nothing logged before it is unknown exposure, not zero exposure.
  const analysable = events.filter((e) => foods.some((f) => f.ts <= e.ts && f.ts >= e.ts - 24 * HOUR))
  coverage.eventsAnalysed = analysable.length

  if (events.length < THRESHOLDS.minEventsForAnalysis) {
    return { ...base, reason: `Log at least ${THRESHOLDS.minEventsForAnalysis} stool events before correlations mean anything. You have ${events.length}.` }
  }
  if (summary.daysLogged < THRESHOLDS.minDaysForAnalysis) {
    return { ...base, reason: `Keep logging for at least ${THRESHOLDS.minDaysForAnalysis} days. You have ${summary.daysLogged}.` }
  }
  if (analysable.length < THRESHOLDS.minEventsForAnalysis) {
    return {
      ...base,
      reason: `Only ${analysable.length} of your ${events.length} stool events have food logged in the 24 hours before them. Food timestamps are what make correlation possible — without them there is nothing to compare.`,
    }
  }

  const candidates: Candidate[] = FOOD_TAGS.map<Candidate>((t) => ({
    key: `tag:${t.id}`,
    kind: 'tag',
    label: t.label,
    note: t.note,
    gapKey: t.id,
    present: (ex) => ex.tags.has(t.id),
  }))

  // Individual items only become candidates once they recur often enough to
  // possibly clear the threshold — this keeps the comparison count down.
  const itemCounts = new Map<string, number>()
  for (const f of foods) {
    for (const raw of f.items) {
      const item = normalizeFoodText(raw)
      if (item) itemCounts.set(item, (itemCounts.get(item) ?? 0) + 1)
    }
  }
  for (const [item, count] of itemCounts) {
    if (count < THRESHOLDS.minExposedItem) continue
    candidates.push({
      key: `item:${item}`,
      kind: 'item',
      label: item.replace(/\b\w/g, (c) => c.toUpperCase()),
      note: 'A specific item that recurs in your log.',
      gapKey: `item:${item}`,
      present: (ex) => ex.items.has(item),
    })
  }

  // Best-window search per candidate. Testing five windows inflates the chance
  // of a spurious hit, which is why the surfacing threshold is a rate
  // *difference* rather than mere significance, and why confidence is reported
  // from the raw exposed count rather than from a p-value.
  const bestByKey = new Map<string, Correlation>()
  for (const w of LOOKBACK_WINDOWS) {
    const exposureByEvent = new Map<string, Exposure>()
    for (const e of analysable) exposureByEvent.set(e.id, exposuresWithin(e, foods, w))

    for (const c of candidates) {
      const corr = buildCorrelation(c, analysable, exposureByEvent, w)
      if (!corr) continue
      const prev = bestByKey.get(c.key)
      if (!prev || Math.abs(corr.lift) > Math.abs(prev.lift)) bestByKey.set(c.key, corr)
    }
  }

  const all = [...bestByKey.values()]
  // Gate on lift, which accounts for the baseline, but order by the rate that
  // is actually plotted and quoted — otherwise the bar chart reads as
  // arbitrarily ordered, with a longer bar sitting below a shorter one.
  const triggers = all
    .filter((c) => c.lift >= THRESHOLDS.minLift)
    .sort((a, b) => b.exposedRate - a.exposedRate || b.exposedCount - a.exposedCount)
  const protective = all
    .filter((c) => c.lift <= -THRESHOLDS.minLift)
    .sort((a, b) => a.lift - b.lift)

  return {
    ...base,
    ready: true,
    reason: triggers.length === 0 && protective.length === 0
      ? 'Nothing in your log clears the evidence threshold yet. That is a real result, not a failure — it means no single exposure stands out so far. Keep logging.'
      : null,
    triggers,
    protective,
  }
}

export { FOOD_TAG_LABEL }
