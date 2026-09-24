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
  preliminary: 'Only seen a few times so far',
  emerging: 'Held up over a few weeks',
  consistent: 'Seen enough times to be worth trying',
}

export function Insights() {
  const { stool, food } = useStore()
  const result = useMemo(() => analyse(stool, food), [stool, food])
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
                <div className="table-wrap"><table className="table">
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
                </table></div>
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
                <div className="table-wrap"><table className="table">
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
                </table></div>
              }
            >
              <BristolChart data={result.bristol} />
            </ChartFrame>
          )}

          {result.ready && result.triggers.length > 0 && (
            <>
              <ChartFrame
                title="What keeps showing up first"
                subtitle={`How often a bad one followed each of these. You average ${Math.round(baseline * 100)}%.`}
                table={
                  <div className="table-wrap"><table className="table">
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
                  </table></div>
                }
              >
                <CorrelationBars bars={bars} baseline={baseline} />
              </ChartFrame>

              {result.triggers.slice(0, 5).map((c) => (
                <CorrelationCard key={c.key} correlation={c} />
              ))}

              <Alert tone="warning" title="Do what you want with this">
                These are just patterns in your own log. Lots of things get compared at once, so
                some of this will be coincidence. If something here looks right, try cutting back
                for a couple of weeks and see whether the log changes. If it keeps happening, tell
                a doctor — I'm not one.
              </Alert>
            </>
          )}

          {/* The nudge, only where it is actually the missing piece. */}
          {!result.ready && summary.totalEvents > 0 && (
            <Card title={hasFood ? 'Not enough yet' : 'Want to know what sets it off?'}>
              <div className="stack stack--tight">
                {hasFood ? (
                  <p className="small">{result.reason}</p>
                ) : (
                  <>
                    <p className="small">
                      You are logging poops, which is the half that matters. Log roughly what you
                      eat too and this can start telling you what tends to come before a bad one.
                    </p>
                    <p className="small muted">
                      Needs about {THRESHOLDS.minEventsForAnalysis} entries over a week or so, with
                      meals alongside. No calories, no weighing, no portions — just what and
                      roughly when.
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
            <Alert tone="good" title="Nothing jumps out">
              Nothing you eat lines up with your bad ones often enough to point at. That is an
              actual answer, not a blank screen — it means it probably is not one obvious food.
            </Alert>
          )}

          {summary.totalEvents > 0 && (
            <button className="wide-tile" onClick={() => navigate({ name: 'report' })}>
              <IconReport />
              <span className="wide-tile__text">
                <span className="tile__title">Make a doctor’s report</span>
                <span className="tile__hint">Printable, if you are seeing someone about it</span>
              </span>
            </button>
          )}

          <details className="more">
            <summary>
              How this is worked out
              <span className="more__hint">if you care</span>
            </summary>
            <div className="more__body">
              <div className="stack stack--tight">
                <p className="small">
                  For every entry, the log gets checked backwards over 2, 6, 12, 24 and 48 hours to
                  see what you had eaten. Each food is compared against all the times you did not
                  have it.
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
  const food = c.label.toLowerCase()
  return (
    <Card title={c.label}>
      <div className="stack stack--tight">
        <p>
          <strong>
            {c.exposedPoor} of the {c.exposedCount} times
          </strong>{' '}
          you had {food}, a bad one followed within {c.windowHours} hours. The{' '}
          {c.unexposedCount} times you did not, it was {Math.round(c.unexposedRate * 100)}%.
        </p>
        <p className="small">
          Maybe try less {food} for a couple of weeks and see whether this screen changes. Maybe it
          is nothing. Up to you — I'm not a doctor.
        </p>
        {c.medianGapHours !== null && (
          <p className="small muted">
            Usually about {formatGap(c.medianGapHours)} later.{' '}
            {c.medianGapHours <= 4
              ? 'That is quick, which tends to mean your body just does not get on with it.'
              : c.medianGapHours >= 10
                ? 'That is slow, which is less like an intolerance and more like something that did not agree with you.'
                : null}
          </p>
        )}
        <p className="xsmall">
          <span className="badge badge--wrap">{CONFIDENCE_COPY[c.confidence]}</span>
        </p>
      </div>
    </Card>
  )
}
