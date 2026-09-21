/**
 * Home.
 *
 * Leads with the action, not the data. The single most common reason to open
 * this app is to log an event that just happened, often one-handed and in a
 * hurry, so "Log a stool entry" is the largest target on the screen and
 * nothing is between it and the top.
 */
import { useMemo } from 'react'
import { BRISTOL, bristolBand, type FoodEntry, type StoolEntry } from '../db/schema'
import { useStore } from '../store'
import { allFlags, SEVERITY_HEADING } from '../lib/redflags'
import { hydrationPlan, ORS_RECIPE } from '../lib/hydration'
import { effectiveRating } from '../lib/analysis'
import { dateKey, formatDayLong, formatTime, startOfDay } from '../lib/time'
import { navigate } from '../router'
import { Alert, AppBar, Card, EmptyState } from '../components/ui'
import { IconDroplet, IconFood, IconMic, IconPlus, IconStethoscope } from '../components/icons'

type TimelineItem =
  | { kind: 'stool'; entry: StoolEntry }
  | { kind: 'food'; entry: FoodEntry }

export function Today() {
  const { stool, food, daily, settings } = useStore()
  const now = Date.now()
  const todayKey = dateKey(now)
  const dayStart = startOfDay(now)

  const flags = useMemo(() => allFlags(stool, daily, now), [stool, daily, now])
  const hydration = useMemo(
    () => hydrationPlan(stool, settings.bodyWeightLb, now),
    [stool, settings.bodyWeightLb, now],
  )

  const items = useMemo<TimelineItem[]>(() => {
    const s = stool.filter((e) => e.ts >= dayStart).map<TimelineItem>((entry) => ({ kind: 'stool', entry }))
    const f = food.filter((e) => e.ts >= dayStart).map<TimelineItem>((entry) => ({ kind: 'food', entry }))
    return [...s, ...f].sort((a, b) => b.entry.ts - a.entry.ts)
  }, [stool, food, dayStart])

  const todayCheckIn = daily.find((d) => d.id === todayKey)
  const urgent = flags.filter((f) => f.severity === 'urgent')

  return (
    <>
      <AppBar title="Today" subtitle={formatDayLong(now)} />
      <main className="main">
        <div className="stack">
          {urgent.length > 0 && (
            <Alert tone="critical" title={SEVERITY_HEADING.urgent}>
              {urgent.map((f) => (
                <p key={f.id} style={{ marginBottom: 'var(--s2)' }}>
                  <strong>{f.title}.</strong> {f.detail}
                </p>
              ))}
            </Alert>
          )}

          <div className="stack stack--tight">
            <button
              className="btn btn--primary btn--record btn--block"
              onClick={() => navigate({ name: 'log-stool' })}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
                <IconPlus /> Log a stool entry
              </span>
              <span className="btn__hint">Form, colour, urgency, pain — about fifteen seconds</span>
            </button>

            <div className="btn-row">
              <button className="btn btn--secondary btn--lg" onClick={() => navigate({ name: 'voice' })}>
                <IconMic />
                Speak it
              </button>
              <button className="btn btn--secondary btn--lg" onClick={() => navigate({ name: 'log-food' })}>
                <IconFood />
                Log food
              </button>
            </div>
          </div>

          {hydration.severity !== 'none' && (
            <Card title="Fluid replacement">
              <div className="stack stack--tight">
                <p className="small">
                  {hydration.looseEvents} loose {hydration.looseEvents === 1 ? 'event' : 'events'} in
                  the last 24 hours — roughly{' '}
                  <strong>{hydration.estimatedLossOz} oz</strong> of fluid
                  {hydration.percentBodyWeight !== null && (
                    <>
                      , about <strong>{hydration.percentBodyWeight.toFixed(1)}%</strong> of your body
                      weight
                    </>
                  )}
                  .
                </p>
                <p className="small">
                  Aim for about <strong>{hydration.totalTargetOz} oz</strong> today — your normal{' '}
                  {hydration.maintenanceOz} oz plus {hydration.replacementOz} oz to replace what was
                  lost.
                </p>
                {hydration.percentBodyWeight !== null && hydration.percentBodyWeight >= 2 && (
                  <p className="small muted">
                    Losses past about 2% of body weight produce measurable physical and cognitive
                    impairment. If today has felt like being hit by a truck, that is the reason.
                  </p>
                )}
                {hydration.needsElectrolytes && (
                  <Alert tone="info" title={ORS_RECIPE.title}>
                    {ORS_RECIPE.body} {ORS_RECIPE.note}
                  </Alert>
                )}
                <button
                  className="btn btn--secondary btn--block"
                  onClick={() => navigate({ name: 'log-daily' })}
                >
                  <IconDroplet />
                  Log what you have drunk
                </button>
              </div>
            </Card>
          )}

          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Today</h2>
              <button className="appbar__action" onClick={() => navigate({ name: 'history' })}>
                All entries
              </button>
            </div>
            {items.length === 0 ? (
              <EmptyState>
                Nothing logged yet today. Two ordinary weeks of baseline is what makes a bad day
                readable later.
              </EmptyState>
            ) : (
              <div className="list" style={{ marginTop: 'var(--s3)' }}>
                {items.map((item) =>
                  item.kind === 'stool' ? (
                    <StoolRow key={item.entry.id} entry={item.entry} />
                  ) : (
                    <FoodRow key={item.entry.id} entry={item.entry} />
                  ),
                )}
              </div>
            )}
          </section>

          <Card
            title="Daily check-in"
            subtitle={
              todayCheckIn
                ? 'Saved for today. Tap to update it.'
                : 'Water, sleep, stress and weight. The context a single event cannot carry.'
            }
          >
            <button
              className="btn btn--secondary btn--block"
              onClick={() => navigate({ name: 'log-daily' })}
            >
              {todayCheckIn ? 'Update today’s check-in' : 'Start today’s check-in'}
            </button>
          </Card>

          {flags.filter((f) => f.severity !== 'urgent').length > 0 && (
            <Card title="Worth raising with a doctor">
              <div className="stack stack--tight">
                {flags
                  .filter((f) => f.severity !== 'urgent')
                  .map((f) => (
                    <div key={f.id}>
                      <p className="small">
                        <strong>{f.title}.</strong> {f.detail}
                      </p>
                      <p className="xsmall muted">{f.evidence}</p>
                    </div>
                  ))}
                <button className="btn btn--secondary btn--block" onClick={() => navigate({ name: 'report' })}>
                  <IconStethoscope />
                  Build a report to take with you
                </button>
              </div>
            </Card>
          )}
        </div>
      </main>
    </>
  )
}

function StoolRow({ entry }: { entry: StoolEntry }) {
  const rating = effectiveRating(entry)
  const band = entry.bristol ? bristolBand(entry.bristol) : null
  const rule =
    band === 'hard' ? 'var(--viz-hard)' : band === 'loose' ? 'var(--viz-loose)' : 'var(--viz-normal)'

  const detail = [
    entry.bristol ? `Type ${entry.bristol} · ${BRISTOL[entry.bristol - 1]!.name}` : null,
    entry.pain !== null && entry.pain > 1 ? `pain ${entry.pain}/10` : null,
    entry.urgency !== null && entry.urgency >= 7 ? `urgent` : null,
    entry.flags.includes('blood') ? 'blood' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button className="list__item" onClick={() => navigate({ name: 'log-stool', id: entry.id })}>
      <span className="list__time">{formatTime(entry.ts)}</span>
      <span className="list__rule" style={{ background: rule }} />
      <span className="list__body">
        <span className="list__title">
          Stool entry{rating !== null && <span className="muted"> · {rating}/10</span>}
        </span>
        <span className="list__meta">{detail || 'No details recorded'}</span>
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
        <span className="list__meta">{entry.items.join(', ') || 'No items'}</span>
      </span>
    </button>
  )
}
