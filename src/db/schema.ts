/**
 * The record schema.
 *
 * Every field here exists because it changes what a clinician can conclude.
 * The two load-bearing ones are the timestamps: `hours since eating` is what
 * separates a two-hour intolerance response from a twelve-to-twenty-four hour
 * foodborne or inflammatory one. A log without accurate times is close to
 * useless for that, which is why nothing in the UI lets you save an entry
 * without one.
 */

export type ID = string

/** Bristol Stool Form Scale, 1 (hardest) to 7 (liquid). */
export type BristolType = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface BristolSpec {
  type: BristolType
  name: string
  description: string
  band: BristolBand
}

export type BristolBand = 'hard' | 'normal' | 'loose'

export const BRISTOL: readonly BristolSpec[] = [
  {
    type: 1,
    name: 'Separate hard lumps',
    description: 'Like nuts or pebbles. Hard to pass.',
    band: 'hard',
  },
  {
    type: 2,
    name: 'Lumpy sausage',
    description: 'Sausage-shaped but visibly lumpy.',
    band: 'hard',
  },
  {
    type: 3,
    name: 'Cracked sausage',
    description: 'Sausage-shaped with cracks on the surface.',
    band: 'normal',
  },
  {
    type: 4,
    name: 'Smooth and soft',
    description: 'Smooth, soft sausage or snake. The reference form.',
    band: 'normal',
  },
  {
    type: 5,
    name: 'Soft blobs',
    description: 'Soft blobs with clear-cut edges. Passed easily.',
    band: 'normal',
  },
  {
    type: 6,
    name: 'Mushy, ragged edges',
    description: 'Fluffy pieces with ragged edges. Mushy.',
    band: 'loose',
  },
  {
    type: 7,
    name: 'Entirely liquid',
    description: 'Watery, no solid pieces. Diarrhoea.',
    band: 'loose',
  },
] as const

export function bristolBand(type: BristolType): BristolBand {
  return BRISTOL[type - 1]!.band
}

export const BRISTOL_BAND_LABEL: Record<BristolBand, string> = {
  hard: 'Hard (1–2)',
  normal: 'Normal (3–5)',
  loose: 'Loose (6–7)',
}

/** Stool colour. `pale`, `black` and `red` are clinically significant. */
export type StoolColor = 'brown' | 'yellow' | 'green' | 'pale' | 'black' | 'red'

export interface ColorSpec {
  id: StoolColor
  label: string
  note: string
  /** Approximate swatch — an illustration of the category, not a measurement. */
  swatch: string
  concerning: boolean
}

export const COLORS: readonly ColorSpec[] = [
  { id: 'brown', label: 'Brown', note: 'Typical.', swatch: '#6b4a2f', concerning: false },
  {
    id: 'yellow',
    label: 'Yellow',
    note: 'Can indicate fat not being absorbed, or fast transit.',
    swatch: '#c8a12c',
    concerning: false,
  },
  {
    id: 'green',
    label: 'Green',
    note: 'Often fast transit — bile has not fully broken down.',
    swatch: '#5c7a3a',
    concerning: false,
  },
  {
    id: 'pale',
    label: 'Pale / clay',
    note: 'Persistent pale stool can point to a bile duct or liver issue.',
    swatch: '#cbbfa8',
    concerning: true,
  },
  {
    id: 'black',
    label: 'Black / tarry',
    note: 'Can indicate bleeding higher in the gut. Iron and bismuth also cause it.',
    swatch: '#26211c',
    concerning: true,
  },
  {
    id: 'red',
    label: 'Red',
    note: 'Can indicate bleeding lower in the gut. Beets and red dye also cause it.',
    swatch: '#8f2d2d',
    concerning: true,
  },
] as const

export type StoolFlag =
  | 'blood'
  | 'mucus'
  | 'oil'
  | 'floating'
  | 'undigested'
  | 'odor'
  | 'straining'
  | 'incomplete'

export interface FlagSpec {
  id: StoolFlag
  label: string
  note: string
  concerning: boolean
}

export const STOOL_FLAGS: readonly FlagSpec[] = [
  { id: 'blood', label: 'Blood', note: 'Visible red blood, on the stool or the paper.', concerning: true },
  { id: 'mucus', label: 'Mucus', note: 'Slimy or jelly-like coating.', concerning: false },
  { id: 'oil', label: 'Oil sheen', note: 'Greasy film on the water.', concerning: false },
  { id: 'floating', label: 'Floating', note: 'Did not sink.', concerning: false },
  { id: 'undigested', label: 'Undigested food', note: 'Recognisable pieces.', concerning: false },
  { id: 'odor', label: 'Odour change', note: 'Notably different from your normal.', concerning: false },
  { id: 'straining', label: 'Straining', note: 'Had to push hard.', concerning: false },
  { id: 'incomplete', label: 'Still backed up', note: 'Did not feel emptied afterwards.', concerning: false },
] as const

export type PainPhase = 'before' | 'during' | 'after'

export interface StoolEntry {
  id: ID
  kind: 'stool'
  /** Epoch ms. Time of day matters: overnight urgency is diagnostic. */
  ts: number
  bristol: BristolType | null
  color: StoolColor | null
  /** 1 = could easily wait, 10 = did not make it / barely made it. */
  urgency: number | null
  /** 1 = none, 10 = worst. */
  pain: number | null
  painPhase: PainPhase[]
  /** Overall subjective quality. 10 = healthy, quick, clean. */
  rating: number | null
  flags: StoolFlag[]
  photoId: ID | null
  notes: string
  source: 'manual' | 'voice'
  /** Kept verbatim when the entry came from speech, so nothing is lost to parsing. */
  transcript?: string
  createdAt: number
  updatedAt: number
}

/**
 * Food is tracked as *exposure*, not nutrition. There are no calories and no
 * macros here on purpose — the only question this log has to answer is
 * "what went in, and when".
 */
export type FoodTag =
  | 'dairy'
  | 'high-fat'
  | 'fried'
  | 'cured-meat'
  | 'red-meat'
  | 'spicy'
  | 'high-fiber'
  | 'gluten'
  | 'alcohol'
  | 'caffeine'
  | 'artificial-sweetener'
  | 'high-sugar'
  | 'raw-produce'
  | 'shellfish'
  | 'egg'
  | 'legumes'
  | 'onion-garlic'
  | 'restaurant'
  | 'field-food'
  | 'carbonated'

export interface FoodTagSpec {
  id: FoodTag
  label: string
  /** Why this tag is worth isolating, shown in the insight copy. */
  note: string
}

export const FOOD_TAGS: readonly FoodTagSpec[] = [
  { id: 'dairy', label: 'Dairy', note: 'Lactose reactions usually land 30 minutes to 2 hours later.' },
  { id: 'high-fat', label: 'High fat', note: 'Fat speeds up the gut reflex that empties the colon.' },
  { id: 'fried', label: 'Fried', note: 'Fat load plus oxidised oil.' },
  { id: 'cured-meat', label: 'Cured meat', note: 'Nitrates, high salt, and a food-safety risk if held warm.' },
  { id: 'red-meat', label: 'Red meat', note: 'Slower to digest than poultry or fish.' },
  { id: 'spicy', label: 'Spicy', note: 'Capsaicin directly irritates the gut lining.' },
  { id: 'high-fiber', label: 'High fibre', note: 'The main lever in both directions.' },
  { id: 'gluten', label: 'Gluten', note: 'Worth isolating before any coeliac testing — do not cut it first.' },
  { id: 'alcohol', label: 'Alcohol', note: 'Speeds transit and pulls water into the gut.' },
  { id: 'caffeine', label: 'Caffeine', note: 'Stimulates colonic activity directly.' },
  { id: 'artificial-sweetener', label: 'Sweetener', note: 'Sugar alcohols are a very common and very missable cause.' },
  { id: 'high-sugar', label: 'High sugar', note: 'Draws water into the gut.' },
  { id: 'raw-produce', label: 'Raw produce', note: 'Fibre load plus a contamination route.' },
  { id: 'shellfish', label: 'Shellfish', note: 'Common foodborne-illness source.' },
  { id: 'egg', label: 'Egg', note: 'Common intolerance.' },
  { id: 'legumes', label: 'Beans / legumes', note: 'Fermentable — gas and bloating.' },
  { id: 'onion-garlic', label: 'Onion / garlic', note: 'High-FODMAP; a frequent IBS trigger.' },
  { id: 'restaurant', label: 'Restaurant', note: 'Unknown preparation and holding time.' },
  { id: 'field-food', label: 'Field food / MRE', note: 'Near-zero fibre. Reliably constipating.' },
  { id: 'carbonated', label: 'Carbonated', note: 'Gas and bloating.' },
] as const

export const FOOD_TAG_LABEL: Record<FoodTag, string> = Object.fromEntries(
  FOOD_TAGS.map((t) => [t.id, t.label]),
) as Record<FoodTag, string>

export type MealKind = 'meal' | 'snack' | 'drink'

export interface FoodEntry {
  id: ID
  kind: 'food'
  ts: number
  items: string[]
  tags: FoodTag[]
  mealKind: MealKind
  /** Ounces of water drunk with this. Water lives here rather than in a
      tracker of its own — it is the one non-food thing that changes stool, and
      it does not deserve a button. */
  waterOz: number | null
  notes: string
  source: 'manual' | 'voice'
  transcript?: string
  createdAt: number
  updatedAt: number
}

export interface PhotoRecord {
  id: ID
  /** Stored as a Blob in IndexedDB. It never leaves the device. */
  blob: Blob
  mime: string
  width: number
  height: number
  createdAt: number
}

export type ThemePref = 'system' | 'light' | 'dark'

export interface Settings {
  id: 'settings'
  /**
   * Optional, and only used to turn "you lost a lot of fluid today" into an
   * amount worth drinking. It is not a weight log and has no screen.
   */
  bodyWeightLb: number | null
  theme: ThemePref
  photosEnabled: boolean
  redFlagAlerts: boolean
  onboarded: boolean
  schemaVersion: number
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  bodyWeightLb: null,
  theme: 'system',
  photosEnabled: true,
  redFlagAlerts: true,
  onboarded: false,
  schemaVersion: 2,
}

export type AnyEntry = StoolEntry | FoodEntry

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
