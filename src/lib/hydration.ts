/**
 * Fluid replacement estimate.
 *
 * A bad day of diarrhoea costs more fluid than people replace by drinking when
 * they feel like it, and the impact scales with body size: at 130 lb, losing
 * 1.5–2 L is roughly 3–4% of body weight, and measurable cognitive and
 * physical impairment starts around 2%. That is why an afternoon can vanish
 * after a bad morning — it is not weakness, it is volume.
 *
 * These are rough planning numbers, not clinical measurements.
 */
import type { StoolEntry } from '../db/schema'
import { DAY } from './time'

/** Typical fluid volume per event, in US fluid ounces, by Bristol type. */
const LOSS_OZ_BY_TYPE: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 4: 0, 5: 2, 6: 6, 7: 10,
}

export type HydrationSeverity = 'none' | 'mild' | 'moderate' | 'significant'

export interface HydrationPlan {
  looseEvents: number
  estimatedLossOz: number
  /** Loss as a share of body weight — the number that predicts how wrecked you feel. */
  percentBodyWeight: number | null
  /** Replacement for what was lost, above normal intake. */
  replacementOz: number
  /** Ordinary daily intake for this body weight. */
  maintenanceOz: number
  totalTargetOz: number
  severity: HydrationSeverity
  /** Plain water alone stops being enough once losses are this large. */
  needsElectrolytes: boolean
}

export const ORS_RECIPE = {
  title: 'Oral rehydration solution',
  body: '1 litre of water + 6 level teaspoons of sugar + ½ teaspoon of salt.',
  note: 'Pedialyte, Liquid IV or DripDrop do the same job if you would rather buy it. Sports drinks are sugar-heavy relative to their electrolytes, so they replace less than they look like they do.',
} as const

export function hydrationPlan(
  stool: StoolEntry[],
  bodyWeightLb: number | null,
  now = Date.now(),
): HydrationPlan {
  const recent = stool.filter((e) => e.ts >= now - DAY && e.ts <= now)

  let estimatedLossOz = 0
  let looseEvents = 0
  for (const e of recent) {
    if (e.bristol === null) continue
    const oz = LOSS_OZ_BY_TYPE[e.bristol] ?? 0
    if (oz > 0) {
      estimatedLossOz += oz
      looseEvents++
    }
  }

  // A fluid-weighted body responds to replacement above 1:1; 1.5× is the usual
  // planning figure because some of what is drunk passes straight through.
  const replacementOz = Math.round(estimatedLossOz * 1.5)
  const maintenanceOz = bodyWeightLb ? Math.round(bodyWeightLb * 0.5) : 80
  const percentBodyWeight = bodyWeightLb
    ? // 1 lb of body weight ≈ 16 fl oz of fluid.
      (estimatedLossOz / 16 / bodyWeightLb) * 100
    : null

  let severity: HydrationSeverity = 'none'
  if (percentBodyWeight !== null) {
    if (percentBodyWeight >= 3) severity = 'significant'
    else if (percentBodyWeight >= 2) severity = 'moderate'
    else if (percentBodyWeight > 0.5) severity = 'mild'
  } else if (estimatedLossOz >= 40) severity = 'significant'
  else if (estimatedLossOz >= 24) severity = 'moderate'
  else if (estimatedLossOz > 0) severity = 'mild'

  return {
    looseEvents,
    estimatedLossOz,
    percentBodyWeight,
    replacementOz,
    maintenanceOz,
    totalTargetOz: maintenanceOz + replacementOz,
    severity,
    needsElectrolytes: severity === 'moderate' || severity === 'significant',
  }
}

/** Weighing before and after a bad day is the most accurate home measurement. */
export function fluidFromWeightChange(beforeLb: number, afterLb: number): number {
  return Math.max(0, (beforeLb - afterLb) * 16)
}
