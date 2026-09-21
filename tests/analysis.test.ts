import { describe, expect, it } from 'vitest'
import { analyse, deriveRating, headlineFor, isPoorEvent, THRESHOLDS } from '../src/lib/analysis'
import { ratingTier } from '../src/components/RatingDot'
import { hydrationPlan } from '../src/lib/hydration'
import { allFlags } from '../src/lib/redflags'
import type { FoodEntry, StoolEntry } from '../src/db/schema'

const HOUR = 3_600_000
const DAY = 86_400_000
const NOW = new Date(2026, 8, 21, 12, 0, 0, 0).getTime()

function stool(ts: number, over: Partial<StoolEntry> = {}): StoolEntry {
  return {
    id: `s${ts}-${Math.random()}`, kind: 'stool', ts,
    bristol: 4, color: 'brown', urgency: 2, pain: 1, painPhase: [],
    rating: null, flags: [], photoId: null, notes: '', source: 'manual',
    createdAt: ts, updatedAt: ts, ...over,
  }
}

function food(
  ts: number,
  tags: FoodEntry['tags'],
  items: string[] = ['thing'],
  waterOz: number | null = null,
): FoodEntry {
  return {
    id: `f${ts}-${Math.random()}`, kind: 'food', ts, items, tags, waterOz,
    mealKind: 'meal', notes: '', source: 'manual', createdAt: ts, updatedAt: ts,
  }
}

describe('deriveRating', () => {
  it('scores the reference form as healthy', () => {
    expect(deriveRating({ bristol: 4, pain: 1, urgency: 2, flags: [], color: 'brown' })).toBe(10)
  })

  it('scores a severe liquid event near the bottom', () => {
    const r = deriveRating({ bristol: 7, pain: 9, urgency: 9, flags: ['undigested'], color: 'yellow' })!
    expect(r).toBeLessThanOrEqual(2)
  })

  it('returns null when nothing clinical was recorded', () => {
    expect(deriveRating({ bristol: null, pain: null, urgency: null, flags: [], color: null })).toBeNull()
  })

  it('lets an explicit user rating override the derived one', () => {
    expect(isPoorEvent(stool(NOW, { bristol: 4, rating: 2 }))).toBe(true)
    expect(isPoorEvent(stool(NOW, { bristol: 7, pain: 9, rating: 9 }))).toBe(false)
  })
})

describe('analyse', () => {
  it('refuses to report anything below the evidence threshold', () => {
    const events = [stool(NOW - DAY), stool(NOW - 2 * DAY)]
    const result = analyse(events, [food(NOW - DAY - HOUR, ['dairy'])])
    expect(result.ready).toBe(false)
    expect(result.triggers).toHaveLength(0)
    expect(result.reason).toContain('stool events')
  })

  it('finds a planted association and reports honest counts', () => {
    const stools: StoolEntry[] = []
    const foods: FoodEntry[] = []
    // 10 days with dairy → poor events; 10 days without → normal events.
    for (let d = 0; d < 20; d++) {
      const base = NOW - (d + 1) * DAY
      const withDairy = d < 10
      foods.push(food(base, withDairy ? ['dairy'] : ['high-fiber']))
      stools.push(
        stool(base + 3 * HOUR, withDairy ? { bristol: 7, pain: 8, urgency: 9 } : { bristol: 4 }),
      )
    }
    const result = analyse(stools, foods)
    expect(result.ready).toBe(true)
    const dairy = result.triggers.find((t) => t.key === 'tag:dairy')
    expect(dairy).toBeDefined()
    expect(dairy!.exposedCount).toBe(10)
    expect(dairy!.exposedPoor).toBe(10)
    expect(dairy!.unexposedPoor).toBe(0)
    expect(dairy!.lift).toBeCloseTo(1)
    // The gap between the meal and the event should be recovered.
    expect(dairy!.medianGapHours).toBeCloseTo(3, 1)
  })

  it('excludes events with no food logged in the previous 24 hours', () => {
    const stools = Array.from({ length: 12 }, (_, i) => stool(NOW - (i + 1) * DAY, { bristol: 7 }))
    const result = analyse(stools, [])
    expect(result.coverage.eventsAnalysed).toBe(0)
    expect(result.ready).toBe(false)
    expect(result.reason).toContain('food logged')
  })

  it('buckets events into one column per day, including empty days', () => {
    const stools = [stool(NOW - 4 * DAY, { bristol: 7 }), stool(NOW, { bristol: 4 })]
    const result = analyse(stools, [])
    expect(result.days).toHaveLength(5)
    expect(result.days[0]!.loose).toBe(1)
    expect(result.days[1]!.total).toBe(0)
    expect(result.days[4]!.normal).toBe(1)
  })

  it('needs more evidence for a single item than for a tag', () => {
    expect(THRESHOLDS.minExposedItem).toBeGreaterThan(THRESHOLDS.minExposed)
  })
})

describe('red flags', () => {
  it('raises blood as urgent', () => {
    const flags = allFlags([stool(NOW, { flags: ['blood'] })], NOW)
    expect(flags.find((f) => f.id === 'blood')?.severity).toBe('urgent')
  })

  it('raises a run of loose stool lasting beyond 48 hours', () => {
    const events = [0, 24, 48, 60].map((h) => stool(NOW - (72 - h) * HOUR, { bristol: 7 }))
    const flags = allFlags(events, NOW)
    expect(flags.some((f) => f.id === 'sustained-diarrhoea')).toBe(true)
  })

  it('does not raise that run when a formed stool breaks it', () => {
    const events = [
      stool(NOW - 72 * HOUR, { bristol: 7 }),
      stool(NOW - 36 * HOUR, { bristol: 4 }),
      stool(NOW - 2 * HOUR, { bristol: 7 }),
    ]
    expect(allFlags(events, NOW).some((f) => f.id === 'sustained-diarrhoea')).toBe(false)
  })

})

describe('hydration', () => {
  it('scales severity against body weight', () => {
    const events = Array.from({ length: 5 }, (_, i) => stool(NOW - i * HOUR, { bristol: 7 }))
    const light = hydrationPlan(events, 130, NOW)
    const heavy = hydrationPlan(events, 260, NOW)
    // 50 oz is ~3.1 lb of fluid, which is 2.4% of 130 lb but only 1.2% of 260.
    expect(light.estimatedLossOz).toBe(50)
    expect(light.percentBodyWeight!).toBeCloseTo(2.4, 1)
    expect(light.percentBodyWeight!).toBeGreaterThan(heavy.percentBodyWeight!)
    expect(light.severity).toBe('moderate')
    expect(heavy.severity).toBe('mild')
    expect(light.needsElectrolytes).toBe(true)
    expect(heavy.needsElectrolytes).toBe(false)
  })

  it('reaches the top tier once loss passes 3 per cent of body weight', () => {
    const events = Array.from({ length: 7 }, (_, i) => stool(NOW - i * HOUR, { bristol: 7 }))
    const plan = hydrationPlan(events, 130, NOW)
    expect(plan.percentBodyWeight!).toBeGreaterThanOrEqual(3)
    expect(plan.severity).toBe('significant')
  })

  it('reports nothing when stool has been formed', () => {
    const plan = hydrationPlan([stool(NOW, { bristol: 4 })], 130, NOW)
    expect(plan.severity).toBe('none')
    expect(plan.looseEvents).toBe(0)
  })

  it('ignores events older than 24 hours', () => {
    expect(hydrationPlan([stool(NOW - 30 * HOUR, { bristol: 7 })], 130, NOW).looseEvents).toBe(0)
  })
})

describe('ubiquity guard', () => {
  it('drops an exposure that is present in nearly every event', () => {
    const stools: StoolEntry[] = []
    const foods: FoodEntry[] = []
    // Caffeine on 44 of 50 days; the 6 without it happen to be clean days.
    for (let d = 0; d < 50; d++) {
      const base = NOW - (d + 1) * DAY
      const hasCaffeine = d >= 6
      foods.push(food(base, hasCaffeine ? ['caffeine'] : ['high-fiber']))
      stools.push(stool(base + 3 * HOUR, hasCaffeine && d % 4 === 0 ? { bristol: 7, pain: 8 } : { bristol: 4 }))
    }
    const result = analyse(stools, foods)
    expect(result.ready).toBe(true)
    expect(result.triggers.find((t) => t.key === 'tag:caffeine')).toBeUndefined()
  })

  it('still reports an exposure with a real comparison group', () => {
    const stools: StoolEntry[] = []
    const foods: FoodEntry[] = []
    for (let d = 0; d < 30; d++) {
      const base = NOW - (d + 1) * DAY
      const withDairy = d % 2 === 0
      foods.push(food(base, withDairy ? ['dairy'] : ['high-fiber']))
      stools.push(stool(base + 2 * HOUR, withDairy ? { bristol: 7, pain: 8 } : { bristol: 4 }))
    }
    const result = analyse(stools, foods)
    expect(result.triggers.find((t) => t.key === 'tag:dairy')).toBeDefined()
  })
})

describe('headline', () => {
  it('speaks plainly with no food logged at all', () => {
    const events = [
      stool(NOW - DAY, { bristol: 7, pain: 8 }),
      stool(NOW - 2 * DAY, { bristol: 4 }),
      stool(NOW - 3 * DAY, { bristol: 4 }),
    ]
    const h = headlineFor(events, NOW)
    expect(h.sentence).toContain('3 entries')
    expect(h.sentence).toContain('1 of them was rough')
  })

  it('handles an empty log without scolding', () => {
    expect(headlineFor([], NOW).sentence).toBe('Nothing logged yet.')
  })

  it('says so when nothing has been rough', () => {
    const events = Array.from({ length: 4 }, (_, i) => stool(NOW - i * DAY, { bristol: 4 }))
    expect(headlineFor(events, NOW).sentence).toContain('none of them were rough')
  })

  it('compares the last fortnight against the one before', () => {
    const recent = Array.from({ length: 6 }, (_, i) => stool(NOW - i * DAY, { bristol: 4 }))
    const prior = Array.from({ length: 6 }, (_, i) => stool(NOW - (16 + i) * DAY, { bristol: 7, pain: 8 }))
    const h = headlineFor([...recent, ...prior], NOW)
    expect(h.direction).toBe('better')
    expect(h.detail).toContain('down from')
  })

  it('withholds a trend when either half is too thin', () => {
    const events = [stool(NOW - DAY, { bristol: 7 }), stool(NOW - 20 * DAY, { bristol: 4 })]
    expect(headlineFor(events, NOW).direction).toBe('unknown')
  })
})

describe('rating tiers', () => {
  it('maps ratings onto the four reserved steps', () => {
    expect(ratingTier(1)).toBe('bad')
    expect(ratingTier(3)).toBe('bad')
    expect(ratingTier(4)).toBe('poor')
    expect(ratingTier(5)).toBe('poor')
    expect(ratingTier(6)).toBe('ok')
    expect(ratingTier(7)).toBe('ok')
    expect(ratingTier(8)).toBe('good')
    expect(ratingTier(10)).toBe('good')
    expect(ratingTier(null)).toBe('none')
  })
})

describe('headline copy in the singular', () => {
  it('does not say "1 of them was" about a single entry', () => {
    const one = headlineFor([stool(NOW, { bristol: 7, pain: 8 })], NOW)
    expect(one.sentence).toBe('One entry so far, and it was a rough one.')
    const fine = headlineFor([stool(NOW, { bristol: 4 })], NOW)
    expect(fine.sentence).toContain('One entry so far')
    expect(fine.sentence).not.toContain('1 of them')
  })
})

describe('water, now that it rides on meals', () => {
  it('totals per day rather than averaging per entry', () => {
    const stools = [stool(NOW, { bristol: 4 })]
    const foods = [
      food(NOW - HOUR, [], ['breakfast'], 16),
      food(NOW - 2 * HOUR, [], ['coffee'], 8),
      food(NOW - 25 * HOUR, [], ['dinner'], 40),
    ]
    // 24 oz on the first day, 40 on the other → mean of the two day totals.
    expect(analyse(stools, foods).summary.avgWaterOz).toBe(32)
  })

  it('ignores meals with no water logged', () => {
    const foods = [food(NOW - HOUR, [], ['lunch']), food(NOW - 2 * HOUR, [], ['snack'], 20)]
    expect(analyse([stool(NOW)], foods).summary.avgWaterOz).toBe(20)
  })

  it('reports nothing when water was never logged', () => {
    expect(analyse([stool(NOW)], [food(NOW - HOUR, [], ['lunch'])]).summary.avgWaterOz).toBeNull()
  })
})

describe('scope', () => {
  it('only ever surfaces food-derived correlations', () => {
    const stools: StoolEntry[] = []
    const foods: FoodEntry[] = []
    for (let d = 0; d < 30; d++) {
      const base = NOW - (d + 1) * DAY
      const withDairy = d % 2 === 0
      foods.push(food(base, withDairy ? ['dairy'] : ['high-fiber']))
      stools.push(stool(base + 2 * HOUR, withDairy ? { bristol: 7, pain: 8 } : { bristol: 4 }))
    }
    const result = analyse(stools, foods)
    expect(result.triggers.length).toBeGreaterThan(0)
    // Nothing about sleep, stress, travel or drill weekends can appear.
    for (const t of [...result.triggers, ...result.protective]) {
      expect(t.kind === 'tag' || t.kind === 'item').toBe(true)
      expect(t.key.startsWith('factor:')).toBe(false)
    }
  })

  it('derives red flags from stool entries alone', () => {
    const flags = allFlags([stool(NOW, { flags: ['blood'] }), stool(NOW - DAY, { color: 'black' })], NOW)
    const ids = flags.map((f) => f.id)
    expect(ids).toContain('blood')
    expect(ids).toContain('black')
    expect(ids).not.toContain('fever')
    expect(ids).not.toContain('weight-loss')
    expect(ids).not.toContain('dehydration')
  })
})
