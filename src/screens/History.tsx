/**
 * History, as a calendar.
 *
 * The thing people want from a log like this is to scroll back and see the
 * shape of a month at a glance — a run of red through the middle of February
 * tells you more than thirty rows of text. Each logged day carries the
 * rating as a coloured circle with the number inside it.
 *
 * Where a day has more than one entry the circle shows the *worst* of them.
 * That is the one that gets remembered and the one worth a doctor's time, and
 * averaging would quietly hide a bad morning behind a normal evening. The
 * count sits underneath so a heavy day is still visible as a heavy day.
 */
import { useMemo, useState } from 'react'
import { BRISTOL, type DailyEntry, type FoodEntry, type StoolEntry } from '../db/schema'
import { useStore } from '../store'
import { effectiveRating } from '../lib/analysis'
import { dateKey, dateKeyToTs, formatDayLong, formatTime } from '../lib/time'
import { navigate } from '../router'
import { AppBar, Card, EmptyState, Segmented } from '../components/ui'
import { RatingDot, RatingLegend } from '../components/RatingDot'
import { IconBack, IconChevron, IconFood, IconPlus } from '../components/icons'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface DaySummary {
  worst: number | null
  count: number
  meals: number
}

type View = 'calendar' | 'list'

export function History() {
  const { stool, food, daily } = useStore()
  const today = new Date()
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState<string>(() => dateKey(Date.now()))
  const [view, setView] = useState<View>('calendar')

  /** Worst rating, event count and meal count for every day that has anything. */
  const byDay = useMemo(() => {
    const map = new Map<string, DaySummary>()
    for (const e of stool) {
      const key = dateKey(e.ts)
      const cur = map.get(key) ?? { worst: null, count: 0, meals: 0 }
      const r = effectiveRating(e)
      if (r !== null && (cur.worst === null || r < cur.worst)) cur.worst = r
      cur.count++
      map.set(key, cur)
    }
    for (const f of food) {
      const key = dateKey(f.ts)
      const cur = map.get(key) ?? { worst: null, count: 0, meals: 0 }
      cur.meals++
      map.set(key, cur)
    }
    return map
  }, [stool, food])

  const cells = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const first = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const lead = first.getDay()
    const out: ({ key: string; day: number } | null)[] = []
    for (let i = 0; i < lead; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ key: dateKey(new Date(year, month, d)), day: d })
    }
    return out
  }, [cursor])

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const atCurrentMonth =
    cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth()
  const todayKey = dateKey(Date.now())

  const step = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1))

  const selectedStool = stool.filter((e) => dateKey(e.ts) === selected).sort((a, b) => a.ts - b.ts)
  const selectedFood = food.filter((e) => dateKey(e.ts) === selected).sort((a, b) => a.ts - b.ts)
  const selectedDaily = daily.find((d) => d.id === selected)

  return (
    <>
      <AppBar title="History" />
      <main className="main">
        <div className="stack">
          <Segmented
            options={[
              { id: 'calendar', label: 'Calendar' },
              { id: 'list', label: 'List' },
            ]}
            value={view}
            onChange={setView}
          />

          {view === 'calendar' ? (
            <>
              <section className="card">
                <div className="card__body">
                  <div className="cal-head">
                    <button className="cal-nav" onClick={() => step(-1)} aria-label="Previous month">
                      <IconBack />
                    </button>
                    <span className="cal-head__title">{monthLabel}</span>
                    <button
                      className="cal-nav"
                      onClick={() => step(1)}
                      disabled={atCurrentMonth}
                      aria-label="Next month"
                    >
                      <IconChevron />
                    </button>
                  </div>

                  <div className="cal">
                    {DOW.map((d, i) => (
                      <div key={i} className="cal__dow" aria-hidden="true">
                        {d}
                      </div>
                    ))}
                    {cells.map((cell, i) =>
                      cell === null ? (
                        <div key={`pad-${i}`} />
                      ) : (
                        <DayCell
                          key={cell.key}
                          dayKey={cell.key}
                          day={cell.day}
                          summary={byDay.get(cell.key)}
                          isToday={cell.key === todayKey}
                          isSelected={cell.key === selected}
                          isFuture={dateKeyToTs(cell.key) > Date.now()}
                          onSelect={setSelected}
                        />
                      ),
                    )}
                  </div>

                  <div style={{ marginTop: 'var(--s4)' }}>
                    <RatingLegend />
                  </div>
                </div>
              </section>

              <Card
                title={formatDayLong(dateKeyToTs(selected))}
                subtitle={
                  selectedStool.length === 0 && selectedFood.length === 0
                    ? 'Nothing logged on this day.'
                    : undefined
                }
              >
                <div className="stack stack--tight">
                  {selectedDaily && <DailyLine entry={selectedDaily} />}
                  <div className="btn-row">
                    <button
                      className="btn btn--secondary"
                      onClick={() => navigate({ name: 'log-stool' })}
                    >
                      <IconPlus />
                      Stool
                    </button>
                    <button
                      className="btn btn--secondary"
                      onClick={() => navigate({ name: 'log-food' })}
                    >
                      <IconFood />
                      Meal
                    </button>
                  </div>
                </div>
              </Card>

              {(selectedStool.length > 0 || selectedFood.length > 0) && (
                <section className="card">
                  <div className="list">
                    {selectedStool.map((e) => (
                      <StoolRow key={e.id} entry={e} />
                    ))}
                    {selectedFood.map((e) => (
                      <FoodRow key={e.id} entry={e} />
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <ListView stool={stool} food={food} />
          )}
        </div>
      </main>
    </>
  )
}

function DayCell({
  dayKey,
  day,
  summary,
  isToday,
  isSelected,
  isFuture,
  onSelect,
}: {
  dayKey: string
  day: number
  summary: DaySummary | undefined
  isToday: boolean
  isSelected: boolean
  isFuture: boolean
  onSelect: (key: string) => void
}) {
  const label = summary
    ? `${day}: ${summary.count} stool ${summary.count === 1 ? 'entry' : 'entries'}${
        summary.worst !== null ? `, worst rated ${summary.worst} out of 10` : ''
      }`
    : `${day}: nothing logged`

  return (
    <button
      className="cal__cell"
      data-today={isToday}
      aria-label={label}
      aria-pressed={isSelected}
      disabled={isFuture}
      style={isSelected ? { background: 'var(--accent-wash)' } : undefined}
      onClick={() => onSelect(dayKey)}
    >
      <span className="cal__num">{day}</span>
      {summary && summary.count > 0 ? (
        <RatingDot rating={summary.worst} size="sm" />
      ) : (
        <span className="cal__empty" aria-hidden="true" />
      )}
      {summary && summary.count > 1 && <span className="cal__more">×{summary.count}</span>}
    </button>
  )
}

function DailyLine({ entry }: { entry: DailyEntry }) {
  const bits = [
    entry.waterOz !== null ? `${entry.waterOz} oz water` : null,
    entry.sleepHours !== null ? `${entry.sleepHours} h sleep` : null,
    entry.bloating && entry.bloating !== 'none' ? `${entry.bloating} bloating` : null,
    entry.weightLb !== null ? `${entry.weightLb} lb` : null,
    entry.travel ? 'travel' : null,
  ].filter(Boolean)
  if (bits.length === 0) return null
  return <p className="small muted">{bits.join(' · ')}</p>
}

function StoolRow({ entry }: { entry: StoolEntry }) {
  const rating = effectiveRating(entry)
  return (
    <button className="list__item" onClick={() => navigate({ name: 'log-stool', id: entry.id })}>
      <span className="list__time">{formatTime(entry.ts)}</span>
      <RatingDot rating={rating} size="sm" />
      <span className="list__body">
        <span className="list__title">
          {entry.bristol ? `Type ${entry.bristol} · ${BRISTOL[entry.bristol - 1]!.name}` : 'Stool'}
        </span>
        <span className="list__meta">
          {[
            entry.pain !== null && entry.pain > 1 ? `pain ${entry.pain}/10` : null,
            entry.flags.includes('blood') ? 'blood' : null,
            entry.photoId ? 'photo' : null,
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
        <span className="list__title" style={{ textTransform: 'capitalize' }}>
          {entry.mealKind}
        </span>
        <span className="list__meta">{entry.items.join(', ')}</span>
      </span>
    </button>
  )
}

/** The plain reverse-chronological view, for when you want to read rather than scan. */
function ListView({ stool, food }: { stool: StoolEntry[]; food: FoodEntry[] }) {
  const days = useMemo(() => {
    type Row = { kind: 'stool'; ts: number; entry: StoolEntry } | { kind: 'food'; ts: number; entry: FoodEntry }
    const rows: Row[] = [
      ...stool.map<Row>((e) => ({ kind: 'stool', ts: e.ts, entry: e })),
      ...food.map<Row>((e) => ({ kind: 'food', ts: e.ts, entry: e })),
    ].sort((a, b) => b.ts - a.ts)

    const grouped = new Map<string, Row[]>()
    for (const r of rows) {
      const key = dateKey(r.ts)
      const list = grouped.get(key)
      if (list) list.push(r)
      else grouped.set(key, [r])
    }
    return [...grouped.entries()]
  }, [stool, food])

  if (days.length === 0) {
    return (
      <Card>
        <EmptyState>Nothing logged yet.</EmptyState>
      </Card>
    )
  }

  return (
    <>
      {days.map(([key, rows]) => (
        <section className="card" key={key}>
          <div className="card__head">
            <h2 className="card__title" style={{ fontSize: 'var(--fs-sm)' }}>
              {formatDayLong(dateKeyToTs(key))}
            </h2>
          </div>
          <div className="list" style={{ marginTop: 'var(--s2)' }}>
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
    </>
  )
}
