/**
 * Analysis.
 *
 * Every number on this screen is reported with the count it came from, because
 * "75% of events after dairy were poor" means something very different at four
 * events than at forty. The engine refuses to show anything below its evidence
 * threshold, and "nothing stands out yet" is presented as a real result rather
 * than an empty state to apologise for.
 *
 * Nothing here names a condition or tells anyone what to do medically. It
 * reports what is in the log and, where a pattern is strong enough, suggests
 * what would be worth asking a doctor about.
 */
import { useMemo } from 'react'
import { useStore } from '../store'
import { LOOKBACK_WINDOWS, THRESHOLDS, analyse, type Correlation } from '../lib/analysis'
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
import { IconStethoscope } from '../components/icons'

const CONFIDENCE_COPY: Record<Correlation['confidence'], string> = {
  preliminary: 'Preliminary — too few instances to lean on',
  emerging: 'Emerging — holding up so far',
  consistent: 'Consistent across enough events',
}

export function Insights() {
  const { stool, food, daily, settings } = useStore()
  const result = useMemo(
    () => analyse(stool, food, daily, settings.waterTargetOz),
    [stool, food, daily, settings.waterTargetOz],
  )

  const { summary, coverage } = result

  const bars = result.triggers.slice(0, 8).map((c) => ({
    key: c.key,
    label: c.label,
    rate: c.exposedRate,
    count: c.exposedCount,
  }))
  const baseline = summary.totalEvents > 0 ? summary.poorEvents / summary.totalEvents : 0

  return (
    <>
      <AppBar title="Insights" />
      <main className="main">
        <div className="stack">
          <div className="kpi">
            <StatTile
              label="Events logged"
              value={String(summary.totalEvents)}
              detail={`${summary.eventsPerDay.toFixed(1)} per day over ${summary.daysLogged} ${summary.daysLogged === 1 ? 'day' : 'days'}`}
            />
            <StatTile
              label="In the normal range"
              value={`${Math.round(summary.normalBandShare * 100)}%`}
              detail="Bristol types 3 to 5"
              tone={summary.normalBandShare >= 0.6 ? 'good' : undefined}
            />
            <StatTile
              label="Median rating"
              value={summary.medianRating !== null ? `${summary.medianRating}/10` : '—'}
              detail="10 is healthy, quick, clean"
            />
            <StatTile
              label="Woke you overnight"
              value={String(summary.overnightEvents)}
              detail="Midnight to 5 a.m."
              tone={summary.overnightEvents > 0 ? 'critical' : undefined}
            />
          </div>

          {summary.totalEvents > 0 && (
            <ChartFrame
              title="Distribution of form"
              subtitle="Where your events sit on the Bristol scale. Types 3 to 5 are the normal range."
              legend={<BandLegend />}
              table={
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Bristol type</th>
                      <th scope="col">Events</th>
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

          {result.days.length > 1 && (
            <ChartFrame
              title="Day by day"
              subtitle="Events per day, stacked by band. A day with nothing logged shows as a gap."
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
                    {[...result.days]
                      .reverse()
                      .slice(0, 30)
                      .map((d) => (
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

          {!result.ready && (
            <Card title="Not enough to analyse yet">
              <div className="stack stack--tight">
                <p className="small">{result.reason}</p>
                <table className="table">
                  <tbody>
                    <tr>
                      <td>Stool events</td>
                      <td>
                        {coverage.eventsTotal} / {THRESHOLDS.minEventsForAnalysis}
                      </td>
                    </tr>
                    <tr>
                      <td>Days logged</td>
                      <td>
                        {coverage.daysLogged} / {THRESHOLDS.minDaysForAnalysis}
                      </td>
                    </tr>
                    <tr>
                      <td>Meals logged</td>
                      <td>{coverage.foodEntries}</td>
                    </tr>
                    <tr>
                      <td>Events with food logged in the previous 24 h</td>
                      <td>{coverage.eventsAnalysed}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="xsmall muted">
                  An outlier teaches more than a baseline, but only against one. Two ordinary weeks
                  is what makes a bad day legible.
                </p>
              </div>
            </Card>
          )}

          {result.ready && result.triggers.length > 0 && (
            <>
              <ChartFrame
                title="What precedes a poor event"
                subtitle={`Share of stool events rated 4/10 or worse that followed each exposure, highest first, against your overall rate of ${Math.round(baseline * 100)}%.`}
                table={
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Exposure</th>
                        <th scope="col">Window</th>
                        <th scope="col">Poor / total</th>
                        <th scope="col">Rate</th>
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
                          <td>{Math.round(c.exposedRate * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              >
                <CorrelationBars bars={bars} baseline={baseline} />
              </ChartFrame>

              {result.triggers.slice(0, 6).map((c) => (
                <CorrelationCard key={c.key} correlation={c} />
              ))}
            </>
          )}

          {result.ready && result.protective.length > 0 && (
            <Card title="Associated with better events">
              <div className="stack stack--tight">
                {result.protective.slice(0, 3).map((c) => (
                  <p key={c.key} className="small">
                    <strong>{c.label}.</strong> {Math.round(c.exposedRate * 100)}% of the{' '}
                    {c.exposedCount} events within {c.windowHours} h were poor, against{' '}
                    {Math.round(c.unexposedRate * 100)}% otherwise. {c.note}
                  </p>
                ))}
              </div>
            </Card>
          )}

          {result.ready && result.reason && (
            <Alert tone="good" title="No single trigger stands out yet">
              {result.reason}
            </Alert>
          )}

          <Card title="How this is calculated">
            <div className="stack stack--tight">
              <p className="small">
                For every stool event, the log is scanned backwards over{' '}
                {LOOKBACK_WINDOWS.join(', ')} hour windows, and the exposures present in each are
                recorded. An exposure is compared against events where it was absent.
              </p>
              <p className="small">
                A pattern is only shown when it appears in at least {THRESHOLDS.minExposed} events
                with it and {THRESHOLDS.minUnexposed} without, and the difference in rate is at least{' '}
                {Math.round(THRESHOLDS.minLift * 100)} percentage points.
              </p>
              <p className="small">
                Events with no food logged in the preceding 24 hours are excluded entirely — an
                unlogged meal is unknown exposure, not absent exposure, and treating it as absent is
                how a log invents a correlation.
              </p>
              <Alert tone="warning" title="This is an association, not a cause">
                Several windows are tested against many candidate exposures, so some apparent
                patterns will be coincidence. Treat anything here as a hypothesis to test
                deliberately — or to hand to a doctor — not as a conclusion. This app cannot
                diagnose anything, and does not try to.
              </Alert>
            </div>
          </Card>

          <button className="btn btn--secondary btn--block" onClick={() => navigate({ name: 'report' })}>
            <IconStethoscope />
            Build a report for an appointment
          </button>
        </div>
      </main>
    </>
  )
}

function CorrelationCard({ correlation: c }: { correlation: Correlation }) {
  const delta = Math.round(c.lift * 100)
  return (
    <Card title={c.label}>
      <div className="stack stack--tight">
        <p className="small">
          <strong>
            {c.exposedPoor} of {c.exposedCount} events
          </strong>{' '}
          within {c.windowHours} hours of {c.label.toLowerCase()} were poor —{' '}
          {Math.round(c.exposedRate * 100)}%, against {Math.round(c.unexposedRate * 100)}% across the{' '}
          {c.unexposedCount} events without it. That is {delta} percentage points higher.
        </p>
        {c.medianGapHours !== null && (
          <p className="small">
            Typical gap from exposure to event: <strong>{formatGap(c.medianGapHours)}</strong>.{' '}
            {c.medianGapHours <= 4
              ? 'A response this fast looks more like an intolerance than an infection.'
              : c.medianGapHours >= 10
                ? 'A gap this long is more consistent with a foodborne or inflammatory response than a direct intolerance.'
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
