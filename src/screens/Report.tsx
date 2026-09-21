/**
 * Clinician report.
 *
 * The point of the whole app. A gastroenterology appointment is short, and
 * recall under questioning is poor — "a few times a week, sometimes bad" is
 * not something a doctor can act on, whereas a dated log with form, timing,
 * pain and photographs is. This screen produces the latter, in the order a
 * clinician reads: presenting picture, red flags, pattern, then raw data.
 *
 * It prints. The print stylesheet drops the app chrome, so "Print → Save as
 * PDF" gives a document that can be emailed or handed over.
 */
import { useMemo, useState } from 'react'
import { BRISTOL, COLORS, STOOL_FLAGS } from '../db/schema'
import { useStore } from '../store'
import { analyse, effectiveRating } from '../lib/analysis'
import { allFlags, SEVERITY_HEADING, type FlagSeverity } from '../lib/redflags'
import { DAY, formatDay, formatDayLong, formatTime } from '../lib/time'
import { AppBar, Card, Segmented } from '../components/ui'
import { IconPrint } from '../components/icons'

const RANGES = [
  { id: '14', label: '14 days' },
  { id: '30', label: '30 days' },
  { id: '90', label: '90 days' },
  { id: 'all', label: 'All' },
] as const

type RangeId = (typeof RANGES)[number]['id']

export function Report() {
  const { stool, food, daily, settings } = useStore()
  const [range, setRange] = useState<RangeId>('30')
  const now = Date.now()

  const from = range === 'all' ? 0 : now - Number(range) * DAY

  const scoped = useMemo(
    () => ({
      stool: stool.filter((e) => e.ts >= from).sort((a, b) => b.ts - a.ts),
      food: food.filter((e) => e.ts >= from),
      daily: daily.filter((d) => new Date(d.id).getTime() >= from - DAY),
    }),
    [stool, food, daily, from],
  )

  const result = useMemo(
    () => analyse(scoped.stool, scoped.food, scoped.daily, settings.waterTargetOz),
    [scoped, settings.waterTargetOz],
  )
  const flags = useMemo(() => allFlags(scoped.stool, scoped.daily, now), [scoped, now])
  const { summary } = result

  const meds = useMemo(() => {
    const set = new Set<string>()
    for (const d of scoped.daily) for (const m of d.meds) set.add(m)
    return [...set]
  }, [scoped.daily])

  const notable = scoped.stool
    .filter((e) => {
      const r = effectiveRating(e)
      return (r !== null && r <= 4) || e.flags.includes('blood') || (e.pain ?? 0) >= 7
    })
    .slice(0, 20)

  const firstTs = scoped.stool.length > 0 ? scoped.stool[scoped.stool.length - 1]!.ts : now

  return (
    <>
      <AppBar
        title="Report"
        action={
          <button className="appbar__action" onClick={() => window.print()}>
            <IconPrint style={{ width: 20, height: 20 }} />
          </button>
        }
      />
      <main className="main">
        <div className="stack">
          <div className="no-print">
            <Card title="Period">
              <Segmented options={RANGES} value={range} onChange={setRange} />
              <button
                className="btn btn--primary btn--block"
                style={{ marginTop: 'var(--s3)' }}
                onClick={() => window.print()}
              >
                <IconPrint />
                Print, or save as PDF
              </button>
              <p className="field__hint" style={{ marginTop: 'var(--s2)' }}>
                Photographs are never included in the printed report. Show them from the app if you
                choose to.
              </p>
            </Card>
          </div>

          <article className="report">
            <header className="report__head">
              <h2>Stool and dietary record</h2>
              <p className="small muted">
                Patient-recorded, {range === 'all' ? 'all available data' : `last ${range} days`} —{' '}
                {formatDay(firstTs)} to {formatDay(now)}. Generated {formatDayLong(now)}.
              </p>
            </header>

            <Section title="Summary">
              <table className="table">
                <tbody>
                  <tr>
                    <td>Stool events recorded</td>
                    <td>{summary.totalEvents}</td>
                  </tr>
                  <tr>
                    <td>Average per day</td>
                    <td>{summary.eventsPerDay.toFixed(1)}</td>
                  </tr>
                  <tr>
                    <td>Within Bristol 3–5</td>
                    <td>{Math.round(summary.normalBandShare * 100)}%</td>
                  </tr>
                  <tr>
                    <td>Median self-rating (10 = normal)</td>
                    <td>{summary.medianRating ?? '—'}</td>
                  </tr>
                  <tr>
                    <td>Median pain when recorded</td>
                    <td>{summary.medianPain !== null ? `${summary.medianPain}/10` : '—'}</td>
                  </tr>
                  <tr>
                    <td>Nocturnal events (00:00–05:00)</td>
                    <td>{summary.overnightEvents}</td>
                  </tr>
                  <tr>
                    <td>Events with blood, red or black stool</td>
                    <td>{summary.bloodEvents}</td>
                  </tr>
                  <tr>
                    <td>Longest interval between events</td>
                    <td>
                      {summary.longestGapDays !== null ? `${summary.longestGapDays.toFixed(1)} days` : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td>Mean recorded water intake</td>
                    <td>{summary.avgWaterOz !== null ? `${Math.round(summary.avgWaterOz)} oz/day` : '—'}</td>
                  </tr>
                  <tr>
                    <td>Mean recorded sleep</td>
                    <td>{summary.avgSleepHours !== null ? `${summary.avgSleepHours.toFixed(1)} h` : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {flags.length > 0 && (
              <Section title="Findings flagged by this record">
                {(['urgent', 'soon', 'discuss'] as FlagSeverity[]).map((sev) => {
                  const group = flags.filter((f) => f.severity === sev)
                  if (group.length === 0) return null
                  return (
                    <div key={sev} style={{ marginBottom: 'var(--s3)' }}>
                      <p className="section-label">{SEVERITY_HEADING[sev]}</p>
                      <ul className="report__list">
                        {group.map((f) => (
                          <li key={f.id}>
                            <strong>{f.title}.</strong> {f.evidence}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </Section>
            )}

            <Section title="Distribution of stool form">
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
                      <td>
                        {b.type} — {BRISTOL[b.type - 1]!.name}
                      </td>
                      <td>{b.count}</td>
                      <td>{Math.round(b.share * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {result.ready && result.triggers.length > 0 && (
              <Section title="Dietary associations observed">
                <p className="small muted" style={{ marginBottom: 'var(--s2)' }}>
                  Patient-recorded associations only. Windows tested: 2, 6, 12, 24 and 48 hours. Not
                  adjusted for multiple comparisons.
                </p>
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Exposure</th>
                      <th scope="col">Window</th>
                      <th scope="col">Poor/total with</th>
                      <th scope="col">Poor/total without</th>
                      <th scope="col">Median gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.triggers.map((c) => (
                      <tr key={c.key}>
                        <td>{c.label}</td>
                        <td>{c.windowHours} h</td>
                        <td>
                          {c.exposedPoor}/{c.exposedCount}
                        </td>
                        <td>
                          {c.unexposedPoor}/{c.unexposedCount}
                        </td>
                        <td>{c.medianGapHours !== null ? `${c.medianGapHours.toFixed(1)} h` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {meds.length > 0 && (
              <Section title="Medications and supplements recorded">
                <p className="small">{meds.join(', ')}</p>
              </Section>
            )}

            {notable.length > 0 && (
              <Section title="Notable events">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Type</th>
                      <th scope="col">Colour</th>
                      <th scope="col">Pain</th>
                      <th scope="col">Observations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notable.map((e) => (
                      <tr key={e.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {formatDay(e.ts)} {formatTime(e.ts)}
                        </td>
                        <td>{e.bristol ?? '—'}</td>
                        <td>{COLORS.find((c) => c.id === e.color)?.label ?? '—'}</td>
                        <td>{e.pain !== null ? `${e.pain}/10` : '—'}</td>
                        <td style={{ textAlign: 'left' }}>
                          {e.flags.map((f) => STOOL_FLAGS.find((s) => s.id === f)?.label ?? f).join(', ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            <Section title="Complete event log">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Type</th>
                    <th scope="col">Rating</th>
                    <th scope="col">Urgency</th>
                    <th scope="col">Pain</th>
                  </tr>
                </thead>
                <tbody>
                  {scoped.stool.map((e) => (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {formatDay(e.ts)} {formatTime(e.ts)}
                      </td>
                      <td>{e.bristol ?? '—'}</td>
                      <td>{effectiveRating(e) ?? '—'}</td>
                      <td>{e.urgency ?? '—'}</td>
                      <td>{e.pain ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <footer className="report__foot">
              <p className="xsmall muted">
                This is a patient-maintained record produced by a self-tracking application. It is
                not a diagnostic instrument and contains no clinical interpretation. Associations
                shown are observational and drawn from the patient's own entries.
              </p>
            </footer>
          </article>
        </div>
      </main>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="report__section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}
