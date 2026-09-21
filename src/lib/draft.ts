/**
 * Hand-off between the voice screen and the full entry forms.
 *
 * Hash routes carry no state, and a parsed draft is too large and too
 * transient to put in the URL. It lives here for exactly one navigation and is
 * consumed on read, so a later visit to the same route always starts clean.
 */
import type { FoodEntry, StoolEntry } from '../db/schema'

let stoolDraft: Partial<StoolEntry> | null = null
let foodDraft: Partial<FoodEntry> | null = null

export function setStoolDraft(d: Partial<StoolEntry> | null): void {
  stoolDraft = d
}

export function takeStoolDraft(): Partial<StoolEntry> | undefined {
  const d = stoolDraft
  stoolDraft = null
  return d ?? undefined
}

export function setFoodDraft(d: Partial<FoodEntry> | null): void {
  foodDraft = d
}

export function takeFoodDraft(): Partial<FoodEntry> | undefined {
  const d = foodDraft
  foodDraft = null
  return d ?? undefined
}
