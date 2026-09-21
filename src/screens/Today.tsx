/**
 * Home.
 *
 * Four things, in order of how often they get used. The overwhelming majority
 * of people open this app to log one bad event and close it again, so "Log a
 * stool" is a single large target at the top with nothing above it, and
 * everything else gets quieter as it goes down the page.
 *
 * The rest of the app is deliberately not advertised here. Someone who only
 * ever logs bad days should never feel they are using it wrong.
 */
import { useMemo } from 'react'
import { BRISTOL, bristolBand, type FoodEntry, type StoolEntry } from '../db/schema'
import { useStore } from '../store'
import { allFlags } from '../lib/redflags'
import { hydrationPlan, ORS_RECIPE } from '../lib/hydration'
import { effectiveRating } from '../lib/analysis'
import { formatDayLong, formatTime, startOfDay } from '../lib/time'
import { navigate } from '../router'
import { Alert, AppBar, Card } from '../components/ui'
import { RatingDot } from '../components/RatingDot'
import { IconChevron, IconFood, IconInsights, IconPlus, IconToday } from '../components/icons'

type TimelineItem =
  | { kind: 'stool'; entry: StoolEntry }
  | { kind: 'food'; entry: FoodEntry }

export function Today() {
  const { stool, food, settings } = useStore()
  const now = Date.now()
  const dayStart = startOfDay(now)

  const flags = useMemo(() => allFlags(stool, now), [stool, now])
  const hydration = useMemo(
    () => hydrationPlan(stool, settings.bodyWeightLb, now),
    [stool, settings.bodyWeightLb, now],
  )

  const items = useMemo<TimelineItem[]>(() => {
    const s = stool.filter((e) => e.ts >= dayStart).map<TimelineItem>((entry) => ({ kind: 'stool', entry }))
    const f = food.filter((e) => e.ts >= dayStart).map<TimelineItem>((entry) => ({ kind: 'food', entry }))
    return [...s, ...f].sort((a, b) => b.entry.ts - a.entry.ts)
  }, [stool, food, dayStart])

  const urgent = flags.filter((f) => f.severity === 'urgent')

  return (
    <>
      <AppBar title="Stool" subtitle={formatDayLong(now)} />
      <main className="main">
        <div className="stack">
          {urgent.length > 0 && (
            <Alert tone="critical" title={urgent[0]!.title}>
              {urgent[0]!.detail}
            </Alert>
          )}

          {/* The whole point of the screen. */}
          <button className="hero" onClick={() => navigate({ name: 'log-stool' })}>
            <span className="hero__icon">
              <IconPlus />
            </span>
            <span className="hero__text">
              <span className="hero__title">Log a stool</span>
              <span className="hero__hint">Describe it out loud, or tap a few buttons</span>
            </span>
          </button>

          <div className="home-pair">
            <button className="tile" onClick={() => navigate({ name: 'log-food' })}>
              <IconFood />
              <span className="tile__title">Log a meal</span>
              <span className="tile__hint">Optional</span>
            </button>
            <button className="tile" onClick={() => navigate({ name: 'history' })}>
              <IconToday />
              <span className="tile__title">View history</span>
              <span className="tile__hint">Your calendar</span>
            </button>
          </div>

          <button className="wide-tile" onClick={() => navigate({ name: 'insights' })}>
            <IconInsights />
            <span className="wide-tile__text">
              <span className="tile__title">Analyse for patterns</span>
              <span className="tile__hint">What tends to come before a bad day</span>
            </span>
            <IconChevron className="wide-tile__chevron" />
          </button>

          {hydration.severity !== 'none' && (
            <Card title="Drink more than usual today">
              <div className="stack stack--tight">
                <p className="small">
                  {hydration.looseEvents} loose {hydration.looseEvents === 1 ? 'event' : 'events'} in
                  the last day is roughly <strong>{hydration.estimatedLossOz} oz</strong> of fluid
                  {hydration.percentBodyWeight !== null && (
                    <> — about <strong>{hydration.percentBodyWeight.toFixed(1)}%</strong> of your body weight</>
                  )}
                  . Aim for around <strong>{hydration.totalTargetOz} oz</strong>.
                </p>
                {hydration.percentBodyWeight !== null && hydration.percentBodyWeight >= 2 && (
                  <p className="small muted">
                    Past about 2% of body weight you get measurably slower and foggier. If today has
                    felt awful, that is the reason — it is not you being weak.
                  </p>
                )}
                {hydration.needsElectrolytes && (
                  <Alert tone="info" title={ORS_RECIPE.title}>
                    {ORS_RECIPE.body} {ORS_RECIPE.note}
                  </Alert>
                )}
              </div>
            </Card>
          )}

          {items.length > 0 && (
            <section className="card">
              <div className="card__head">
                <h2 className="card__title">Today</h2>
              </div>
              <div className="list" style={{ marginTop: 'var(--s3)' }}>
                {items.map((item) =>
                  item.kind === 'stool' ? (
                    <StoolRow key={item.entry.id} entry={item.entry} />
                  ) : (
                    <FoodRow key={item.entry.id} entry={item.entry} />
                  ),
                )}
              </div>
            </section>
          )}

          {flags.filter((f) => f.severity !== 'urgent').length > 0 && (
            <Card title="Worth mentioning to a doctor">
              <div className="stack stack--tight">
                {flags
                  .filter((f) => f.severity !== 'urgent')
                  .slice(0, 2)
                  .map((f) => (
                    <p key={f.id} className="small">
                      <strong>{f.title}.</strong> {f.detail}
                    </p>
                  ))}
                <button className="btn btn--secondary btn--block" onClick={() => navigate({ name: 'report' })}>
                  Make a report to take with you
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
  const detail = [
    entry.bristol ? BRISTOL[entry.bristol - 1]!.name : null,
    entry.pain !== null && entry.pain > 1 ? `pain ${entry.pain}/10` : null,
    entry.flags.includes('blood') ? 'blood' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button className="list__item" onClick={() => navigate({ name: 'log-stool', id: entry.id })}>
      <span className="list__time">{formatTime(entry.ts)}</span>
      <RatingDot rating={rating} size="sm" />
      <span className="list__body">
        <span className="list__title">
          {entry.bristol ? `Type ${entry.bristol}` : 'Stool'}
          {entry.bristol && <span className="muted"> · {bristolBandLabel(entry.bristol)}</span>}
        </span>
        <span className="list__meta">{detail || 'No details recorded'}</span>
      </span>
    </button>
  )
}

function bristolBandLabel(type: number): string {
  const band = bristolBand(type as 1)
  return band === 'hard' ? 'hard' : band === 'loose' ? 'loose' : 'normal'
}

function FoodRow({ entry }: { entry: FoodEntry }) {
  // A water-only entry should read as water, not as an empty meal.
  const waterOnly = entry.items.length === 0 && entry.waterOz !== null
  const water = entry.waterOz !== null ? `${entry.waterOz} oz water` : null
  const detail = [entry.items.join(', ') || null, waterOnly ? null : water]
    .filter(Boolean)
    .join(' · ')

  return (
    <button className="list__item" onClick={() => navigate({ name: 'log-food', id: entry.id })}>
      <span className="list__time">{formatTime(entry.ts)}</span>
      <span className="list__rule" style={{ background: 'var(--line-strong)' }} />
      <span className="list__body">
        <span className="list__title" style={{ textTransform: 'capitalize' }}>
          {waterOnly ? 'Water' : entry.mealKind}
        </span>
        <span className="list__meta">{waterOnly ? water : detail || 'No items'}</span>
      </span>
    </button>
  )
}
