import { describe, expect, it } from 'vitest'
import { parseTime, parseTranscript } from '../src/lib/parse'

// Fixed reference point: Sunday 21 September 2026, 14:30 local.
const NOW = new Date(2026, 8, 21, 14, 30, 0, 0).getTime()

const hourOf = (ts: number) => new Date(ts).getHours()
const dayOf = (ts: number) => new Date(ts).getDate()

describe('parseTranscript — stool', () => {
  it('reads the plain-language case the app is designed around', () => {
    const r = parseTranscript('I had a poop that was bad, it was basically all water', NOW)
    expect(r.intent).toBe('stool')
    expect(r.stool?.bristol).toBe(7)
    expect(r.stool?.rating).toBe(3)
  })

  it('reads pellets plus a spoken pain score', () => {
    const r = parseTranscript('just pebbles, really painful like an 8', NOW)
    expect(r.stool?.bristol).toBe(1)
    expect(r.stool?.pain).toBe(8)
  })

  it('reads a healthy entry and its negations', () => {
    const r = parseTranscript('had a smooth one this morning, no pain, felt clean', NOW)
    expect(r.stool?.bristol).toBe(4)
    expect(r.stool?.pain).toBe(1)
    expect(r.stool?.rating).toBe(8)
    expect(hourOf(r.stool!.ts)).toBe(8)
  })

  it('does not set a flag that was explicitly denied', () => {
    const r = parseTranscript('stool was loose but there was no blood and no mucus', NOW)
    expect(r.stool?.flags).not.toContain('blood')
    expect(r.stool?.flags).not.toContain('mucus')
  })

  it('sets flags that were stated', () => {
    const r = parseTranscript('watery stool with mucus, and it was really urgent', NOW)
    expect(r.stool?.bristol).toBe(7)
    expect(r.stool?.flags).toContain('mucus')
    expect(r.stool?.urgency).toBe(8)
  })

  it('infers the blood flag from a red colour', () => {
    const r = parseTranscript('bowel movement was red', NOW)
    expect(r.stool?.color).toBe('red')
    expect(r.stool?.flags).toContain('blood')
  })

  it('honours an explicit Bristol number over any description', () => {
    const r = parseTranscript('bristol type 6 stool, mushy', NOW)
    expect(r.stool?.bristol).toBe(6)
  })

  it('captures urgency from "barely made it"', () => {
    const r = parseTranscript('barely made it to the bathroom, diarrhea', NOW)
    expect(r.stool?.urgency).toBe(9)
    expect(r.stool?.bristol).toBe(7)
  })
})

describe('parseTranscript — food', () => {
  it('splits items and derives exposure tags', () => {
    const r = parseTranscript('I ate a hotdog, some chili and rice at 6pm', NOW)
    expect(r.intent).toBe('food')
    expect(r.food?.items).toEqual(['hotdog', 'chili', 'rice'])
    expect(r.food?.tags).toContain('cured-meat')
    expect(r.food?.tags).toContain('red-meat')
    expect(hourOf(r.food!.ts)).toBe(18)
  })

  it('tags dairy from a composite dish', () => {
    const r = parseTranscript('had a pastrami sandwich with coleslaw for lunch', NOW)
    expect(r.food?.tags).toContain('cured-meat')
    expect(r.food?.tags).toContain('dairy')
  })
})

describe('parseTranscript — both in one utterance', () => {
  it('separates the meal from the stool event and times each', () => {
    const r = parseTranscript(
      'I ate a donut and coffee at 8am. then at 10am I had a really bad watery one',
      NOW,
    )
    expect(r.intent).toBe('both')
    expect(r.food?.items).toContain('donut')
    expect(hourOf(r.food!.ts)).toBe(8)
    expect(r.stool?.bristol).toBe(7)
    expect(hourOf(r.stool!.ts)).toBe(10)
  })
})

describe('parseTime', () => {
  it('resolves relative offsets', () => {
    expect(parseTime('20 minutes ago', NOW).ts).toBe(NOW - 20 * 60_000)
    expect(parseTime('2 hours ago', NOW).ts).toBe(NOW - 2 * 3_600_000)
  })

  it('puts "last night" on the previous evening', () => {
    const r = parseTime('last night', NOW)
    expect(dayOf(r.ts)).toBe(20)
    expect(hourOf(r.ts)).toBe(22)
  })

  it('puts "overnight" in the small hours of today', () => {
    expect(hourOf(parseTime('overnight', NOW).ts)).toBe(3)
  })

  it('reads a bare clock time as the reading that most recently passed', () => {
    // 2:17 with no meridiem, spoken at 14:30 → 14:17 today, not 02:17.
    const r = parseTime('at 2:17', NOW)
    expect(hourOf(r.ts)).toBe(14)
    expect(new Date(r.ts).getMinutes()).toBe(17)
  })

  it('does not read a bare rating number as a clock time', () => {
    const r = parseTime('rate it a 3', NOW)
    expect(r.explicit).toBe(false)
    expect(r.ts).toBe(NOW)
  })

  it('shifts to yesterday when asked', () => {
    expect(dayOf(parseTime('yesterday at 9pm', NOW).ts)).toBe(20)
  })
})
