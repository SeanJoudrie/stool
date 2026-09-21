/**
 * Patterns.
 *
 * Opens with one sentence in plain words, because the overwhelming majority of
 * people who open this screen will only ever have logged bad events and will
 * never meet the bar for a food correlation. Telling them "not enough data" and
 * showing a table of thresholds is a way of saying they are using it wrong.
 *
 * So: the headline and the charts work from stool entries alone. Food
 * correlations appear when, and only when, they are actually supportable, and
 * the method is tucked behind a disclosure rather than lectured up front.
 */
import { useMemo } from 'react'
import { useStore } from '../store'
import { THRESHOLDS, analyse, headlineFor, type Correlation } from '../lib/analysis'
import { formatGap } from '../lib/time'
import { navigate } from '../router'
import { Alert, AppBar, Card } from '../components/ui'
import {
  BandLegend,
  BristolChart,
  ChartFrame,
  CorrelationBars,
  DailyBandChart,
  StatTile,
} from '../components/charts'
import { IconFood, IconReport } from '../components/icons'

const CONFIDENCE_COPY: Record<Correlation['confidence'], string> = {
  preliminary: 'Early — not many instances yet',
  emerging: 'Holding up so far',
  consistent: 'Seen across enough events to act on',
}

export function Insights() {
  const { stool, food, daily, settings } = useStore()
  const result = useMemo(
    () => analyse(stool, food, daily, settings.waterTargetOz),
    [stool, food, daily, settings.waterTargetOz],
  )
  const headline = useMemo(() => headlineFor(stool), [stool])

  const { summary } = result
  const bars = result.triggers.slice(0, 8).map((c) => ({
    key: c.key,
    label: c.label,
    rate: c.exposedRate,
    count: c.exposedCount,
  }))
  const baseline = summary.totalEvents > 0 ? summary.poorEvents / summary.totalEvents : 0
  const hasFood = food.length > 0

  return (
    <>
      <AppBar title="Patterns" />
      <main className="main">
        <div className="stack">
          <section className="card">
            <div className="card__body">
              <p className="headline">{headline.sentence}</p>
              {headline.detail && (
                <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
                  {headline.detail}
                </p>
              )}
            </div>
          </section>

          {summary.totalEvents > 0 && (
            <div className="kpi">
              <StatTile
                label="Good days"
                value={`${Math.round(summary.normalBandShare * 100)}%`}
                detail="Stools in the normal range"
                tone={summary.normalBandShare >= 0.6 ? 'good' : undefined}
              />
              <StatTile
                label="Woke you at night"
                value={String(summary.overnightEvents)}
                detail="Between midnight and 5 a.m."
                tone={summary.overnightEvents > 0 ? 'critical' : undefined}
              />
            </div>
          )}

          {result.days.length > 1 && (
            <ChartFrame
              title="Day by day"
              subtitle="Each day, stacked by how loose or hard things were. Gaps are days with nothing logged."
              legend={<BandLegend />}
              table={
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Day</th>
                      <th scope="col">Hard</th>
                      <th scope="col">Normal</th>
                      <th scope="col">Loose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...result.days].reverse().slice(0, 30).map((d) => (
                      <tr key={d.key}>
                        <td>{d.key}</td>
                        <td>{d.hard}</td>
                        <td>{d.normal}</td>
                        <td>{d.loose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <DailyBandChart days={result.days} />
            </ChartFrame>
          )}

          {summary.totalEvents > 0 && (
            <ChartFrame
              title="What yours usually look like"
              subtitle="Types 3 to 5 are the normal range."
              legend={<BandLegend />}
              table={
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Type</th>
                      <th scope="col">Times</th>
                      <th scope="col">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.bristol.map((b) => (
                      <tr key={b.type}>
                        <td>Type {b.type}</td>
                        <td>{b.count}</td>
                        <td>{Math.round(b.share * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <BristolChart data={result.bristol} />
            </ChartFrame>
          )}

          {result.ready && result.triggers.length > 0 && (
            <>
              <ChartFrame
                title="What tends to come first"
                subtitle={`How often a rough stool followed each of these, against your usual rate of ${Math.round(baseline * 100)}%.`}
                table={
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Before it</th>
                        <th scope="col">Within</th>
                        <th scope="col">Rough / total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.triggers.map((c) => (
                        <tr key={c.key}>
                          <td>{c.label}</td>
                          <td>{c.windowHours} h</td>
                          <td>
                            {c.exposedPoor} / {c.exposedCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              >
                <CorrelationBars bars={bars} baseline={baseline} />
              </ChartFrame>

              {result.triggers.slice(0, 5).map((c) => (
                <CorrelationCard key={c.key} correlation={c} />
              ))}

              <Alert tone="warning" title="This is a hint, not a verdict">
                These are patterns in your own log, not proof of cause. Several things are tested at
                once, so some will be coincidence. Worth testing on purpose, or mentioning to a
                doctor — not worth cutting foods out over on its own.
              </Alert>
            </>
          )}

          {/* The nudge, only where it is actually the missing piece. */}
          {!result.ready && summary.totalEvents > 0 && (
            <Card title={hasFood ? 'Still gathering' : 'Want to find food triggers?'}>
              <div className="stack stack--tight">
                {hasFood ? (
                  <p className="small">{result.reason}</p>
                ) : (
                  <>
                    <p className="small">
                      You are logging stools, which is the important half. If you also log roughly
                      what you eat and when, this screen can start looking for what tends to come
                      before a bad one.
                    </p>
                    <p className="small muted">
                      It needs about {THRESHOLDS.minEventsForAnalysis} stool entries across a week
                      or so, with meals logged alongside. No calories, no weighing — just what and
                      when.
                    </p>
                    <button
                      className="btn btn--secondary btn--block"
                      onClick={() => navigate({ name: 'log-food' })}
                    >
                      <IconFood />
                      Log a meal
                    </button>
                  </>
                )}
              </div>
            </Card>
          )}

          {result.ready && result.triggers.length === 0 && (
            <Alert tone="good" title="Nothing stands out">
              No single food or habit in your log lines up with your bad days often enough to be
              worth calling a pattern. That is a real answer, not a blank — it means the cause is
              not something obvious you are eating.
            </Alert>
          )}

          {summary.totalEvents > 0 && (
            <button className="wide-tile" onClick={() => navigate({ name: 'report' })}>
              <IconReport />
              <span className="wide-tile__text">
                <span className="tile__title">Make a doctor’s report</span>
                <span className="tile__hint">Everything above, printable</span>
              </span>
            </button>
          )}

          <details className="more">
            <summary>
              How this is worked out
              <span className="more__hint">the method</span>
            </summary>
            <div className="more__body">
              <div className="stack stack--tight">
                <p className="small">
                  For every stool entry, the log is checked backwards over 2, 6, 12, 24 and 48
                  hours to see what you had eaten. Each food is then compared against the times you
                  did not have it.
                </p>
                <p className="small">
                  Something is only shown if it appears before at least {THRESHOLDS.minExposed} bad
                  events and {THRESHOLDS.minUnexposed} without, and the difference is at least{' '}
                  {Math.round(THRESHOLDS.minLift * 100)} percentage points.
                </p>
                <p className="small">
                  Entries with no meals logged in the previous day are left out entirely. A meal you
                  did not log is unknown, not absent — counting it as absent is how a tracker
                  invents a pattern that was never there.
                </p>
                <p className="small">
                  Anything you ate on nearly every day is also dropped, because there are too few
                  days without it to compare against.
                </p>
              </div>
            </div>
          </details>
        </div>
      </main>
    </>
  )
}

function CorrelationCard({ correlation: c }: { correlation: Correlation }) {
  return (
    <Card title={c.label}>
      <div className="stack stack--tight">
        <p className="small">
          <strong>
            {c.exposedPoor} of {c.exposedCount} times
          </strong>{' '}
          you had {c.label.toLowerCase()}, a rough stool followed within {c.windowHours} hours —{' '}
          {Math.round(c.exposedRate * 100)}%, against {Math.round(c.unexposedRate * 100)}% the{' '}
          {c.unexposedCount} times you did not.
        </p>
        {c.medianGapHours !== null && (
          <p className="small">
            Usually about <strong>{formatGap(c.medianGapHours)}</strong> later.{' '}
            {c.medianGapHours <= 4
              ? 'That is fast — more like an intolerance than something that went off.'
              : c.medianGapHours >= 10
                ? 'That is slow — more like something that did not agree with you than a direct intolerance.'
                : null}
          </p>
        )}
        <p className="small muted">{c.note}</p>
        <p className="xsmall">
          <span className="badge badge--wrap">{CONFIDENCE_COPY[c.confidence]}</span>
        </p>
      </div>
    </Card>
  )
}
