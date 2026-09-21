/**
 * The 20–21 September 2026 episode, as a one-tap import.
 *
 * This is a reconstruction from notes written after the fact, not a live log,
 * and it is labelled as such on every record it creates. The clock times are
 * estimates — the source notes recorded the day and the sequence but not the
 * hour — which matters, because this app treats timestamps as clinical data.
 * Anyone importing this should correct the times to what they actually
 * remember before relying on the correlations it feeds.
 */
import { newId, type DailyEntry, type FoodEntry, type StoolEntry } from '../db/schema'
import { autoTagItems } from './foodTags'

const RECONSTRUCTED = 'Reconstructed from notes written on 21 Sep 2026. Clock times are estimates — correct them to what you remember.'

function at(year: number, month: number, day: number, hour: number, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
}

function food(ts: number, items: string[], mealKind: FoodEntry['mealKind'], notes: string): FoodEntry {
  return {
    id: newId(),
    kind: 'food',
    ts,
    items,
    tags: autoTagItems(items),
    mealKind,
    notes: `${notes} ${RECONSTRUCTED}`.trim(),
    source: 'manual',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function buildSeedEpisode(): {
  stool: StoolEntry[]
  food: FoodEntry[]
  daily: DailyEntry[]
} {
  const now = Date.now()

  const foods: FoodEntry[] = [
    food(at(2026, 9, 20, 13, 0), ['grilled hotdog', 'chili', 'rice'], 'meal', 'Cookout. Chili and rice had been held warm for a while.'),
    food(at(2026, 9, 20, 19, 0), ['homemade apple pie', 'mini cookies'], 'snack', 'Roughly three mini cookies.'),
    food(at(2026, 9, 20, 20, 0), ['Gatorade', 'water'], 'drink', 'Gatorade was the main fluid across the day.'),
    food(at(2026, 9, 21, 8, 30), ['donut'], 'snack', 'Travel day, on the road.'),
    food(at(2026, 9, 21, 12, 30), ['pastrami sandwich', 'coleslaw'], 'meal', 'Deli stop during the drive home.'),
  ]

  const stoolBase = {
    kind: 'stool' as const,
    bristol: 7 as const,
    color: 'yellow' as const,
    urgency: 9,
    pain: 9,
    painPhase: ['before' as const, 'during' as const],
    rating: 1,
    flags: ['undigested' as const, 'incomplete' as const],
    photoId: null,
    source: 'manual' as const,
    createdAt: now,
    updatedAt: now,
  }

  const stool: StoolEntry[] = [
    {
      ...stoolBase,
      id: newId(),
      ts: at(2026, 9, 21, 15, 0),
      notes: `Fully liquid, no form. Yellow-brown with an olive tint and dark particulate suspended throughout. Burning hot. Spatter up the bowl walls. Felt clogged up beforehand and worried about not being able to pass gas. Abdominal pain reported as 8.5/10. ${RECONSTRUCTED}`,
    },
    {
      ...stoolBase,
      id: newId(),
      ts: at(2026, 9, 21, 18, 0),
      notes: `Second large episode. Same picture as the first. Completely wiped out afterwards — slept about four hours immediately after getting home. ${RECONSTRUCTED}`,
    },
  ]

  const daily: DailyEntry[] = [
    {
      id: '2026-09-20',
      kind: 'daily',
      waterOz: null,
      sleepHours: null,
      stress: null,
      fatigue: 4,
      bloating: 'mild',
      gas: 'none',
      nausea: 'none',
      travel: true,
      weightLb: null,
      meds: [],
      caffeineDrinks: null,
      feverF: null,
      dehydrationSigns: false,
      drillWeekend: false,
      fieldFood: false,
      ruckOrRun: false,
      notes: `Long driving day on family vacation in Maine. ${RECONSTRUCTED}`,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '2026-09-21',
      kind: 'daily',
      waterOz: null,
      sleepHours: 4,
      stress: 6,
      fatigue: 10,
      bloating: 'bad',
      gas: 'bad',
      nausea: 'mild',
      travel: true,
      weightLb: 130,
      meds: [],
      caffeineDrinks: null,
      feverF: null,
      dehydrationSigns: false,
      drillWeekend: false,
      fieldFood: false,
      ruckOrRun: false,
      notes: `Travel day home. Exhausted and low-energy all day with brain fog. Malaise arrived before the GI symptoms. Slept about four hours immediately on getting home. ${RECONSTRUCTED}`,
      createdAt: now,
      updatedAt: now,
    },
  ]

  return { stool, food: foods, daily }
}
