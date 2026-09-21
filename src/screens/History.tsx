/**
 * The full log, newest first.
 *
 * Grouped by day so a bad stretch reads as a stretch rather than a list, and
 * every row opens the entry for correction — a record only stays accurate if
 * fixing a mistyped time is easy.
 */
import { useMemo, useState } from 'react'
import { BRISTOL, bristolBand, type DailyEntry, type FoodEntry, type StoolEntry } from '../db/schema'
import { useStore } from '../store'
import { effectiveRating } from '../lib/analysis'
import { dateKey, dateKeyToTs, formatDayLong, formatTime } from '../lib/time'
import { navigate } from '../router'
import { AppBar, Card, EmptyState, Segmented } from '../components/ui'

type Filter = 'all' | 'stool' | 'food'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'stool', label: 'Stool' },
  { id: 'food', label: 'Food' },
]

type Row =
  | { kind: 'stool'; ts: number; entry: StoolEntry }
  | { kind: 'food'; ts: number; entry: FoodEntry }

export function History() {
  const { stool, food, daily } = useStore()
  const [filter, setFilter] = useState<Filter>('all')

  const days = useMemo(() => {
    const rows: Row[] = []
    if (filter !== 'food') for (const e of stool) rows.push({ kind: 'stool', ts: e.ts, entry: e })
    if (filter !== 'stool') for (const e of food) rows.push({ kind: 'food', ts: e.ts, entry: e })
    rows.sort((a, b) => b.ts - a.ts)

    const grouped = new Map<string, Row[]>()
    for (const r of rows) {
      const key = dateKey(r.ts)
      const list = grouped.get(key)
      if (list) list.push(r)
      else grouped.set(key, [r])
    }
    return [...grouped.entries()]
  }, [stool, food, filter])

  const dailyByKey = useMemo(() => new Map(daily.map((d) => [d.id, d])), [daily])

  return (
    <>
      <AppBar title="History" />
      <main className="main">
        <div className="stack">
          <Segmented options={FILTERS} value={filter} onChange={setFilter} />

          {days.length === 0 && (
            <Card>
              <EmptyState>Nothing logged yet.</EmptyState>
            </Card>
          )}

          {days.map(([key, rows]) => (
            <section className="card" key={key}>
              <div className="card__head">
                <h2 className="card__title" style={{ fontSize: 'var(--fs-sm)' }}>
                  {formatDayLong(dateKeyToTs(key))}
                </h2>
                <button
                  className="appbar__action"
                  style={{ fontSize: 'var(--fs-xs)' }}
                  onClick={() => navigate({ name: 'log-daily', date: key })}
                >
                  {dailyByKey.has(key) ? 'Check-in' : 'Add check-in'}
                </button>
              </div>
              <DailySummary entry={dailyByKey.get(key)} />
              <div className="list">
                {rows.map((r) =>
                  r.kind === 'stool' ? (
                    <StoolRow key={r.entry.id} entry={r.entry} />
                  ) : (
                    <FoodRow key={r.entry.id} entry={r.entry} />
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  )
}

function DailySummary({ entry }: { entry: DailyEntry | undefined }) {
  if (!entry) return null
  const bits = [
    entry.waterOz !== null ? `${entry.waterOz} oz water` : null,
    entry.sleepHours !== null ? `${entry.sleepHours} h sleep` : null,
    entry.stress !== null ? `stress ${entry.stress}/10` : null,
    entry.weightLb !== null ? `${entry.weightLb} lb` : null,
    entry.travel ? 'travel' : null,
    entry.drillWeekend ? 'drill' : null,
    entry.fieldFood ? 'field food' : null,
    entry.ruckOrRun ? 'ruck/run' : null,
  ].filter(Boolean)
  if (bits.length === 0) return null
  return <p className="card__sub xsmall">{bits.join(' · ')}</p>
}

function StoolRow({ entry }: { entry: StoolEntry }) {
  const rating = effectiveRating(entry)
  const band = entry.bristol ? bristolBand(entry.bristol) : null
  const rule =
    band === 'hard' ? 'var(--viz-hard)' : band === 'loose' ? 'var(--viz-loose)' : 'var(--viz-normal)'
  return (
    <button className="list__item" onClick={() => navigate({ name: 'log-stool', id: entry.id })}>
      <span className="list__time">{formatTime(entry.ts)}</span>
      <span className="list__rule" style={{ background: rule }} />
      <span className="list__body">
        <span className="list__title">
          {entry.bristol ? `Type ${entry.bristol} · ${BRISTOL[entry.bristol - 1]!.name}` : 'Stool entry'}
          {rating !== null && <span className="muted"> · {rating}/10</span>}
        </span>
        <span className="list__meta">
          {[
            entry.pain !== null && entry.pain > 1 ? `pain ${entry.pain}/10` : null,
            entry.urgency !== null && entry.urgency >= 7 ? 'urgent' : null,
            entry.photoId ? 'photo attached' : null,
            entry.flags.length > 0 ? `${entry.flags.length} observations` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'No further detail'}
        </span>
      </span>
    </button>
  )
}

function FoodRow({ entry }: { entry: FoodEntry }) {
  return (
    <button className="list__item" onClick={() => navigate({ name: 'log-food', id: entry.id })}>
      <span className="list__time">{formatTime(entry.ts)}</span>
      <span className="list__rule" style={{ background: 'var(--line-strong)' }} />
      <span className="list__body">
        <span className="list__title" style={{ textTransform: 'capitalize' }}>{entry.mealKind}</span>
        <span className="list__meta">{entry.items.join(', ')}</span>
      </span>
    </button>
  )
}
