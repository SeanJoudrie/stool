/**
 * Speech / free-text parser.
 *
 * Turns "had a really bad one this morning, basically water, cramping like an
 * eight" into a structured entry. Rule-based on purpose: it has to run with no
 * network, return the same answer every time, and never silently invent a
 * clinical value.
 *
 * Nothing this produces is saved directly. The parse populates a form that the
 * user confirms, `matched` explains what was understood in plain words, and
 * the raw transcript is stored alongside the entry so no detail is lost to a
 * missed keyword.
 */
import type {
  BristolType,
  FoodTag,
  MealKind,
  PainPhase,
  StoolColor,
  StoolFlag,
} from '../db/schema'
import { autoTagItems, splitItems } from './foodTags'

export interface ParsedStool {
  bristol: BristolType | null
  color: StoolColor | null
  urgency: number | null
  pain: number | null
  painPhase: PainPhase[]
  rating: number | null
  flags: StoolFlag[]
  notes: string
  ts: number
  tsExplicit: boolean
}

export interface ParsedFood {
  items: string[]
  tags: FoodTag[]
  mealKind: MealKind
  notes: string
  ts: number
  tsExplicit: boolean
}

export interface ParseResult {
  intent: 'stool' | 'food' | 'both' | 'unknown'
  stool: ParsedStool | null
  food: ParsedFood | null
  /** Plain-language list of what was understood, shown on the confirm screen. */
  matched: string[]
  transcript: string
}

const NEGATORS = /\b(no|not|non|never|without|wasn'?t|isn'?t|didn'?t|doesn'?t|hasn'?t|hardly|barely any|zero)\b/

/**
 * True when a negation word sits just before `index` — "no blood", "didn't
 * hurt". The window stops at the nearest punctuation, because a negation
 * belongs to its own phrase: in "no pain, felt clean" the "no" must not reach
 * across the comma and cancel "clean".
 */
function negatedBefore(text: string, index: number): boolean {
  let window = text.slice(Math.max(0, index - 26), index)
  const cut = Math.max(window.lastIndexOf(','), window.lastIndexOf('.'), window.lastIndexOf(';'))
  if (cut >= 0) window = window.slice(cut + 1)
  return NEGATORS.test(window)
}

function findKeyword(text: string, keywords: string[]): { index: number; keyword: string } | null {
  for (const keyword of keywords) {
    const pattern = new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`)
    const m = pattern.exec(text)
    if (m) return { index: m.index, keyword }
  }
  return null
}

function matchesUnnegated(text: string, keywords: string[]): boolean {
  const hit = findKeyword(text, keywords)
  return hit !== null && !negatedBefore(text, hit.index)
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9'":/\s.,;-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// -------------------------------------------------------------- Bristol ---

/** Ordered most-specific first; the highest-scoring type wins. */
const BRISTOL_KEYWORDS: { type: BristolType; words: string[] }[] = [
  // Multi-word water phrases only. A bare "water" would drag "drank water"
  // into being scored as a stool clause.
  { type: 7, words: ['entirely liquid', 'pure liquid', 'all liquid', 'basically water', 'just water', 'all water', 'mostly water', 'like water', 'nothing but water', 'brown water', 'watery', 'liquid', 'diarrhea', 'diarrhoea', 'runny', 'explosive', 'squirt', 'no solid'] },
  { type: 6, words: ['mushy', 'ragged', 'fluffy', 'soft serve', 'pasty', 'paste', 'applesauce', 'oatmeal like', 'unformed', 'formless', 'sludge'] },
  { type: 5, words: ['soft blobs', 'blobs', 'soft pieces', 'soft chunks', 'mounds', 'clear cut edges', 'small soft'] },
  { type: 4, words: ['smooth and soft', 'smooth', 'snake', 'perfect', 'textbook', 'well formed', 'nicely formed', 'ideal'] },
  { type: 3, words: ['cracks', 'cracked', 'dry sausage', 'crackly'] },
  { type: 2, words: ['lumpy sausage', 'lumpy', 'clumpy', 'hard sausage', 'bumpy'] },
  { type: 1, words: ['pebbles', 'pellets', 'rabbit', 'little balls', 'hard lumps', 'separate lumps', 'marbles', 'rocks', 'nuggets', 'like nuts'] },
]

function parseBristol(text: string): { type: BristolType; via: string } | null {
  // "bristol 6" / "type 7" — an explicit number beats any description.
  const explicit = /\b(?:bristol|type)\s*(?:a\s*)?([1-7])\b/.exec(text)
  if (explicit?.[1]) {
    return { type: Number(explicit[1]) as BristolType, via: `Bristol type ${explicit[1]}` }
  }
  let best: { type: BristolType; via: string; score: number } | null = null
  for (const { type, words } of BRISTOL_KEYWORDS) {
    const hit = findKeyword(text, words)
    if (!hit || negatedBefore(text, hit.index)) continue
    // Longer phrases are more specific, so they outrank a single loose word.
    const score = hit.keyword.length
    if (!best || score > best.score) best = { type, via: hit.keyword, score }
  }
  return best ? { type: best.type, via: best.via } : null
}

// ---------------------------------------------------------------- colour ---

const COLOR_KEYWORDS: { color: StoolColor; words: string[] }[] = [
  { color: 'black', words: ['black', 'tarry', 'tar like', 'very dark'] },
  { color: 'red', words: ['red', 'bloody', 'blood', 'pink', 'maroon'] },
  { color: 'pale', words: ['pale', 'clay', 'chalky', 'grey', 'gray', 'white', 'light colored', 'light coloured', 'putty'] },
  { color: 'green', words: ['green', 'olive', 'greenish'] },
  { color: 'yellow', words: ['yellow', 'yellowish', 'mustard', 'tan'] },
  { color: 'brown', words: ['brown', 'normal color', 'normal colour'] },
]

function parseColor(text: string): { color: StoolColor; via: string } | null {
  for (const { color, words } of COLOR_KEYWORDS) {
    const hit = findKeyword(text, words)
    if (hit && !negatedBefore(text, hit.index)) return { color, via: hit.keyword }
  }
  return null
}

// ----------------------------------------------------------------- flags ---

const FLAG_KEYWORDS: { flag: StoolFlag; words: string[] }[] = [
  { flag: 'blood', words: ['blood', 'bloody', 'blood on the paper', 'red streaks'] },
  { flag: 'mucus', words: ['mucus', 'mucous', 'slime', 'slimy', 'jelly', 'stringy'] },
  { flag: 'oil', words: ['oily', 'greasy', 'oil sheen', 'oil slick', 'film on the water', 'sheen', 'fatty'] },
  { flag: 'floating', words: ['floating', 'floated', 'float', 'did not sink', 'didn t sink'] },
  { flag: 'undigested', words: ['undigested', 'recognizable', 'recognisable', 'pieces of food', 'whole pieces', 'saw corn'] },
  { flag: 'odor', words: ['smell', 'smelled', 'smelt', 'odor', 'odour', 'stank', 'stinks', 'foul', 'rancid', 'rotten'] },
  { flag: 'straining', words: ['straining', 'strained', 'had to push', 'pushing', 'struggled', 'took forever'] },
  { flag: 'incomplete', words: ['incomplete', 'still backed up', 'not empty', 'not finished', 'more in there', 'didn t feel done', 'did not feel done', 'unfinished'] },
]

function parseFlags(text: string): { flags: StoolFlag[]; via: string[] } {
  const flags: StoolFlag[] = []
  const via: string[] = []
  for (const { flag, words } of FLAG_KEYWORDS) {
    const hit = findKeyword(text, words)
    if (hit && !negatedBefore(text, hit.index)) {
      flags.push(flag)
      via.push(hit.keyword)
    }
  }
  return { flags, via }
}

// -------------------------------------------------------- scales (1–10) ---

function clamp10(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)))
}

/** Pulls "8 out of 10" / "an eight" style numbers attached to a subject word. */
function scaleNear(text: string, subjects: string[]): number | null {
  for (const subject of subjects) {
    const patterns = [
      new RegExp(`${subject}\\D{0,18}?(\\d{1,2})\\s*(?:out of|/)\\s*(?:10|ten)`),
      new RegExp(`(\\d{1,2})\\s*(?:out of|/)\\s*(?:10|ten)\\D{0,18}?${subject}`),
      new RegExp(`${subject}\\D{0,12}?(?:was|is|of|at|like|about)?\\s*(?:an?\\s*)?(\\d{1,2})\\b`),
    ]
    for (const p of patterns) {
      const m = p.exec(text)
      if (m?.[1]) {
        const n = Number(m[1])
        if (n >= 0 && n <= 10) return clamp10(n === 0 ? 1 : n)
      }
    }
  }
  return null
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
}

function wordScaleNear(text: string, subjects: string[]): number | null {
  const words = Object.keys(WORD_NUMBERS).join('|')
  for (const subject of subjects) {
    const m = new RegExp(`${subject}\\D{0,14}?(?:an?\\s*)?(${words})\\b`).exec(text)
    if (m?.[1]) return WORD_NUMBERS[m[1]] ?? null
  }
  return null
}

const PAIN_SUBJECTS = ['pain', 'painful', 'hurt', 'cramp', 'cramping', 'cramps', 'ache', 'aching']

function parsePain(text: string): { value: number; via: string } | null {
  const explicit = scaleNear(text, PAIN_SUBJECTS) ?? wordScaleNear(text, PAIN_SUBJECTS)
  if (explicit !== null) return { value: explicit, via: `pain ${explicit}/10` }

  if (matchesUnnegated(text, ['excruciating', 'worst pain', 'unbearable', 'doubled over'])) {
    return { value: 9, via: 'severe pain described' }
  }
  if (matchesUnnegated(text, ['really painful', 'very painful', 'hurt a lot', 'bad cramps', 'cramping badly', 'severe cramps'])) {
    return { value: 7, via: 'significant pain described' }
  }
  if (matchesUnnegated(text, PAIN_SUBJECTS)) return { value: 5, via: 'pain mentioned' }

  const hit = findKeyword(text, ['pain', 'hurt', 'cramp', 'cramps', 'painful'])
  if (hit && negatedBefore(text, hit.index)) return { value: 1, via: 'no pain' }
  return null
}

function parsePainPhase(text: string): PainPhase[] {
  const phases: PainPhase[] = []
  if (matchesUnnegated(text, ['before', 'beforehand', 'leading up', 'build up', 'all morning before'])) phases.push('before')
  if (matchesUnnegated(text, ['during', 'while going', 'when it came out', 'passing it'])) phases.push('during')
  if (matchesUnnegated(text, ['after', 'afterwards', 'afterward', 'still hurts', 'lingering'])) phases.push('after')
  return phases
}

const URGENCY_SUBJECTS = ['urgency', 'urgent']

function parseUrgency(text: string): { value: number; via: string } | null {
  const explicit = scaleNear(text, URGENCY_SUBJECTS) ?? wordScaleNear(text, URGENCY_SUBJECTS)
  if (explicit !== null) return { value: explicit, via: `urgency ${explicit}/10` }

  if (matchesUnnegated(text, ['did not make it', 'didn t make it', 'had an accident', 'accident'])) {
    return { value: 10, via: 'did not make it' }
  }
  if (matchesUnnegated(text, ['barely made it', 'almost did not make it', 'almost didn t make it', 'ran to the bathroom', 'sprinted', 'emergency', 'could not hold', 'couldn t hold'])) {
    return { value: 9, via: 'barely made it' }
  }
  if (matchesUnnegated(text, ['urgent', 'no warning', 'out of nowhere', 'sudden', 'suddenly', 'right away', 'immediately'])) {
    return { value: 8, via: 'urgent' }
  }
  if (matchesUnnegated(text, ['could have waited', 'no rush', 'not urgent', 'took my time'])) {
    return { value: 2, via: 'not urgent' }
  }
  return null
}

function parseRating(text: string): { value: number; via: string } | null {
  const explicit =
    scaleNear(text, ['rate', 'rating', 'score', 'call it']) ??
    wordScaleNear(text, ['rate', 'rating', 'score'])
  if (explicit !== null) return { value: explicit, via: `rated ${explicit}/10` }

  if (matchesUnnegated(text, ['worst', 'terrible', 'awful', 'horrible', 'brutal', 'miserable'])) {
    return { value: 1, via: 'described as terrible' }
  }
  if (matchesUnnegated(text, ['really bad', 'very bad', 'rough', 'nasty'])) return { value: 2, via: 'described as bad' }
  if (matchesUnnegated(text, ['bad', 'not good', 'unpleasant'])) return { value: 3, via: 'described as bad' }
  if (matchesUnnegated(text, ['perfect', 'great', 'excellent', 'ideal', 'textbook'])) {
    return { value: 10, via: 'described as healthy' }
  }
  if (matchesUnnegated(text, ['good', 'fine', 'normal', 'clean', 'easy', 'no issues', 'no problems'])) {
    return { value: 8, via: 'described as normal' }
  }
  if (matchesUnnegated(text, ['ok', 'okay', 'alright', 'decent', 'average', 'meh'])) {
    return { value: 6, via: 'described as okay' }
  }
  return null
}

// ------------------------------------------------------------------ time ---

const TIME_PHRASES = [
  /\b(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?\b/,
  /\bat\s+(\d{1,2})\s*(am|pm)\b/,
  /\b(\d{1,2})\s*(am|pm)\b/,
  /\b(\d{1,2})\s*(?:minutes?|mins?)\s+ago\b/,
  /\b(\d{1,2})\s*(?:hours?|hrs?)\s+ago\b/,
  /\b(this morning|this afternoon|this evening|tonight|last night|overnight|middle of the night|yesterday|just now|right now|earlier)\b/,
]

/**
 * Resolves a spoken time against `now`. A bare "2:17" with no am/pm is read as
 * whichever of the two readings most recently passed — you are describing
 * something that already happened.
 */
export function parseTime(text: string, now = Date.now()): { ts: number; explicit: boolean; via: string } {
  const base = new Date(now)
  let dayShift = 0
  let via = ''

  if (/\byesterday\b/.test(text)) {
    dayShift = -1
    via = 'yesterday'
  }

  const minsAgo = /\b(\d{1,3})\s*(?:minutes?|mins?)\s+ago\b/.exec(text)
  if (minsAgo?.[1]) {
    return { ts: now - Number(minsAgo[1]) * 60_000, explicit: true, via: `${minsAgo[1]} minutes ago` }
  }
  const hrsAgo = /\b(\d{1,2})(?:\.5)?\s*(?:hours?|hrs?)\s+ago\b/.exec(text)
  if (hrsAgo?.[1]) {
    return { ts: now - Number(hrsAgo[1]) * 3_600_000, explicit: true, via: `${hrsAgo[1]} hours ago` }
  }
  if (/\b(just now|right now)\b/.test(text)) return { ts: now, explicit: true, via: 'just now' }

  const named: { pattern: RegExp; hour: number; minute: number; shift: number; label: string }[] = [
    { pattern: /\blast night\b/, hour: 22, minute: 0, shift: -1, label: 'last night' },
    { pattern: /\b(overnight|middle of the night)\b/, hour: 3, minute: 0, shift: 0, label: 'overnight' },
    { pattern: /\bthis morning\b/, hour: 8, minute: 0, shift: 0, label: 'this morning' },
    { pattern: /\bthis afternoon\b/, hour: 14, minute: 0, shift: 0, label: 'this afternoon' },
    { pattern: /\b(this evening|tonight)\b/, hour: 20, minute: 0, shift: 0, label: 'this evening' },
  ]

  const clock = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(text)
  const hasClock =
    clock?.[1] !== undefined &&
    // A bare number with no colon and no meridiem is far more likely to be a
    // 1–10 rating than a time, so require one of the two.
    (clock[2] !== undefined || clock[3] !== undefined)

  if (hasClock && clock?.[1]) {
    let hour = Number(clock[1])
    const minute = clock[2] ? Number(clock[2]) : 0
    const meridiem = clock[3]
    if (meridiem === 'pm' && hour < 12) hour += 12
    if (meridiem === 'am' && hour === 12) hour = 0

    const candidate = new Date(base)
    candidate.setDate(candidate.getDate() + dayShift)
    candidate.setHours(hour, minute, 0, 0)

    if (!meridiem) {
      // Pick whichever 12-hour reading most recently passed.
      const alt = new Date(candidate)
      alt.setHours((hour + 12) % 24)
      const opts = [candidate, alt].filter((d) => d.getTime() <= now + 60_000)
      if (opts.length > 0) {
        opts.sort((a, b) => b.getTime() - a.getTime())
        return { ts: opts[0]!.getTime(), explicit: true, via: `at ${clock[0]!.replace('at ', '').trim()}` }
      }
      candidate.setDate(candidate.getDate() - 1)
    } else if (candidate.getTime() > now + 60_000 && dayShift === 0) {
      candidate.setDate(candidate.getDate() - 1)
    }
    return { ts: candidate.getTime(), explicit: true, via: `at ${clock[0]!.replace('at ', '').trim()}` }
  }

  for (const n of named) {
    if (n.pattern.test(text)) {
      const d = new Date(base)
      d.setDate(d.getDate() + n.shift + dayShift)
      d.setHours(n.hour, n.minute, 0, 0)
      return { ts: d.getTime(), explicit: true, via: n.label }
    }
  }

  if (dayShift !== 0) {
    const d = new Date(base)
    d.setDate(d.getDate() + dayShift)
    d.setHours(12, 0, 0, 0)
    return { ts: d.getTime(), explicit: true, via }
  }

  return { ts: now, explicit: false, via: '' }
}

function stripTimePhrases(text: string): string {
  let out = text
  for (const p of TIME_PHRASES) out = out.replace(new RegExp(p.source, 'g'), ' ')
  return out.replace(/\s+/g, ' ').trim()
}

// ------------------------------------------------------------ segmenting ---

const STOOL_NOUNS = ['poop', 'pooped', 'stool', 'bowel movement', 'bm', 'bathroom', 'diarrhea', 'diarrhoea', 'shit', 'crap', 'dump', 'number two', 'went', 'movement', 'toilet', 'constipated', 'constipation']
const FOOD_VERBS = ['ate', 'eat', 'eating', 'had for', 'drank', 'drink', 'drinking', 'breakfast', 'lunch', 'dinner', 'snack', 'meal', 'lunch was', 'for dinner']

function segmentScores(clause: string): { stool: number; food: number } {
  let stool = 0
  let food = 0
  for (const w of STOOL_NOUNS) if (findKeyword(clause, [w])) stool += 2
  for (const w of FOOD_VERBS) if (findKeyword(clause, [w])) food += 2
  // Descriptors only a stool clause would carry.
  if (parseBristol(clause)) stool += 2
  if (parseColor(clause)) stool += 1
  if (parseFlags(clause).flags.length > 0) stool += 1
  return { stool, food }
}

function splitClauses(text: string): string[] {
  return text
    .split(/[.;]|\bthen\b|\band then\b|\balso\b|\bbut\b/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// -------------------------------------------------------------- assembly ---

function parseMealKind(text: string): MealKind {
  if (findKeyword(text, ['snack', 'snacked'])) return 'snack'
  if (findKeyword(text, ['drank', 'drink', 'drinking', 'sipped'])) return 'drink'
  return 'meal'
}

function stripLeadIns(text: string): string {
  return text
    .replace(/^\s*(?:i\s+)?(?:just\s+)?(?:ate|had|have|having|eating|drank|drinking|got)\s+/i, '')
    .replace(/\b(?:for|at)\s+(?:breakfast|lunch|dinner|a snack|snack)\b/gi, ' ')
    .replace(/\b(?:breakfast|lunch|dinner|snack)\s+was\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseTranscript(raw: string, now = Date.now()): ParseResult {
  const transcript = raw.trim()
  const text = normalize(transcript)
  const matched: string[] = []

  if (!text) {
    return { intent: 'unknown', stool: null, food: null, matched, transcript }
  }

  const clauses = splitClauses(text)
  const stoolClauses: string[] = []
  const foodClauses: string[] = []

  for (const clause of clauses) {
    const { stool, food } = segmentScores(clause)
    if (stool === 0 && food === 0) continue
    if (stool >= food) stoolClauses.push(clause)
    else foodClauses.push(clause)
  }

  // A single unclassifiable clause still gets read as a stool entry if it
  // carries any stool descriptor at all — that is the common case in a hurry.
  if (stoolClauses.length === 0 && foodClauses.length === 0) {
    if (parseBristol(text) || parseColor(text) || parseFlags(text).flags.length > 0 || parsePain(text)) {
      stoolClauses.push(text)
    }
  }

  const globalTime = parseTime(text, now)

  let stool: ParsedStool | null = null
  if (stoolClauses.length > 0) {
    const s = stoolClauses.join('. ')
    const time = parseTime(s, now)
    const resolved = time.explicit ? time : globalTime

    const bristol = parseBristol(s)
    const color = parseColor(s)
    const pain = parsePain(s)
    const urgency = parseUrgency(s)
    const rating = parseRating(s)
    const { flags, via: flagVia } = parseFlags(s)

    // A colour that is itself a warning sign implies the matching flag.
    if (color?.color === 'red' && !flags.includes('blood')) flags.push('blood')

    stool = {
      bristol: bristol?.type ?? null,
      color: color?.color ?? null,
      urgency: urgency?.value ?? null,
      pain: pain?.value ?? null,
      painPhase: parsePainPhase(s),
      rating: rating?.value ?? null,
      flags,
      notes: '',
      ts: resolved.ts,
      tsExplicit: resolved.explicit,
    }

    if (bristol) matched.push(`Bristol type ${bristol.type} — "${bristol.via}"`)
    if (color) matched.push(`Colour: ${color.color} — "${color.via}"`)
    if (pain) matched.push(`Pain ${pain.value}/10 — ${pain.via}`)
    if (urgency) matched.push(`Urgency ${urgency.value}/10 — ${urgency.via}`)
    if (rating) matched.push(`Rated ${rating.value}/10 — ${rating.via}`)
    if (flagVia.length > 0) matched.push(`Flags: ${flagVia.join(', ')}`)
    if (resolved.explicit && resolved.via) matched.push(`Time: ${resolved.via}`)
  }

  let food: ParsedFood | null = null
  if (foodClauses.length > 0) {
    const f = foodClauses.join('. ')
    const time = parseTime(f, now)
    const resolved = time.explicit ? time : globalTime
    const itemText = stripLeadIns(stripTimePhrases(f))
    const items = splitItems(itemText)
    if (items.length > 0) {
      const tags = autoTagItems(items)
      food = {
        items,
        tags,
        mealKind: parseMealKind(f),
        notes: '',
        ts: resolved.ts,
        tsExplicit: resolved.explicit,
      }
      matched.push(`Food: ${items.join(', ')}`)
      if (tags.length > 0) matched.push(`Tags: ${tags.join(', ')}`)
      if (resolved.explicit && resolved.via) matched.push(`Time: ${resolved.via}`)
    }
  }

  const intent: ParseResult['intent'] =
    stool && food ? 'both' : stool ? 'stool' : food ? 'food' : 'unknown'

  return { intent, stool, food, matched, transcript }
}
