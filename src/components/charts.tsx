/**
 * Charts.
 *
 * Hand-rolled SVG rather than a charting library: there are three chart forms
 * in the whole app, and owning the marks is what keeps them consistent with
 * the clinical register of everything else.
 *
 * Colour follows a validated scheme. The Bristol axis is a *diverging* scale —
 * warm pole for hard, neutral grey for the normal band, cool pole for loose —
 * because the reader's question is "how far from normal", and grey is the
 * midpoint that means "no deviation". Correlation bars are a single hue, since
 * there is one series and the magnitude is the whole story. No status colour
 * ever doubles as a series colour.
 *
 * Every chart carries a legend where more than one colour class is in play, a
 * hover/focus tooltip, and a table view — the tooltip enhances, it never gates
 * a value.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { BRISTOL_BAND_LABEL, bristolBand, type BristolBand } from '../db/schema'
import { IconAlert, IconCheckCircle } from './icons'
import { formatDay } from '../lib/time'

function bandColor(band: BristolBand): string {
  return band === 'hard' ? 'var(--viz-hard)' : band === 'loose' ? 'var(--viz-loose)' : 'var(--viz-normal)'
}

/** Width of the rendered container, so the SVG can be laid out in real pixels. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return [ref, width]
}

interface TooltipState {
  x: number
  y: number
  content: ReactNode
}

function Tooltip({ state }: { state: TooltipState | null }) {
  if (!state) return null
  return (
    <div className="viz__tip" style={{ left: state.x, top: state.y }} role="status">
      {state.content}
    </div>
  )
}

export function ChartFrame({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string
  subtitle?: string
  legend?: ReactNode
  table?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="card viz">
      <div className="card__head">
        <h2 className="card__title">{title}</h2>
      </div>
      {subtitle && <p className="card__sub">{subtitle}</p>}
      <div className="card__body">
        {legend}
        {children}
      </div>
      {table && (
        <details className="disclosure">
          <summary>Show the numbers</summary>
          <div style={{ padding: '0 var(--s4) var(--s4)' }}>{table}</div>
        </details>
      )}
    </section>
  )
}

export function BandLegend() {
  const bands: BristolBand[] = ['hard', 'normal', 'loose']
  return (
    <ul className="viz__legend">
      {bands.map((b) => (
        <li key={b}>
          <span className="swatch" style={{ background: bandColor(b) }} />
          {BRISTOL_BAND_LABEL[b]}
        </li>
      ))}
    </ul>
  )
}

// ------------------------------------------------- Bristol distribution ---

export function BristolChart({ data }: { data: { type: number; count: number }[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)

  const H = 190
  const PAD = { top: 16, right: 8, bottom: 34, left: 30 }
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = H - PAD.top - PAD.bottom

  const max = Math.max(1, ...data.map((d) => d.count))
  const ticks = niceTicks(max, 4)
  const scaleMax = ticks[ticks.length - 1] ?? 1
  const band = plotW / data.length
  // Cap the bar and let the leftover band be air, per the mark spec. The 2px
  // surface gap between neighbours falls out of the cap.
  const barW = Math.min(24, Math.max(8, band - 10))
  const tallest = data.reduce((a, b) => (b.count > a.count ? b : a), data[0] ?? { type: 0, count: 0 })

  return (
    <div className="viz__plot" ref={ref}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label="Distribution of stool events by Bristol type">
          {ticks.map((t) => {
            const y = PAD.top + plotH - (t / scaleMax) * plotH
            return (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke="var(--viz-grid)" strokeWidth="1" />
                <text x={PAD.left - 7} y={y + 4} textAnchor="end" className="viz__tick">
                  {t}
                </text>
              </g>
            )
          })}

          {data.map((d, i) => {
            const h = (d.count / scaleMax) * plotH
            const x = PAD.left + i * band + (band - barW) / 2
            const y = PAD.top + plotH - h
            const color = bandColor(bristolBand(d.type as 1))
            return (
              <g key={d.type}>
                {/* Hit area is the whole band, so the target clears 24px even
                    when the bar itself is short. */}
                <rect
                  x={PAD.left + i * band}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`Type ${d.type}: ${d.count} events`}
                  onMouseEnter={() =>
                    setTip({
                      x: PAD.left + i * band + band / 2,
                      y: Math.max(8, y - 8),
                      content: (
                        <>
                          <strong>Type {d.type}</strong>
                          <br />
                          {d.count} {d.count === 1 ? 'event' : 'events'}
                        </>
                      ),
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                  onFocus={() =>
                    setTip({
                      x: PAD.left + i * band + band / 2,
                      y: Math.max(8, y - 8),
                      content: (
                        <>
                          <strong>Type {d.type}</strong>
                          <br />
                          {d.count} {d.count === 1 ? 'event' : 'events'}
                        </>
                      ),
                    })
                  }
                  onBlur={() => setTip(null)}
                />
                {d.count > 0 && (
                  <path d={roundedTopBar(x, y, barW, h, 4)} fill={color} />
                )}
                <text x={PAD.left + i * band + band / 2} y={H - 14} textAnchor="middle" className="viz__tick">
                  {d.type}
                </text>
              </g>
            )
          })}

          {/* Direct-label only the extreme; the axis and the table carry the rest. */}
          {tallest.count > 0 && (
            <text
              x={PAD.left + data.findIndex((d) => d.type === tallest.type) * band + band / 2}
              y={PAD.top + plotH - (tallest.count / scaleMax) * plotH - 6}
              textAnchor="middle"
              className="viz__label"
            >
              {tallest.count}
            </text>
          )}

          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={PAD.top + plotH}
            y2={PAD.top + plotH}
            stroke="var(--viz-axis)"
            strokeWidth="1"
          />
          <text x={width / 2} y={H - 1} textAnchor="middle" className="viz__axis-title">
            Bristol type
          </text>
        </svg>
      )}
      <Tooltip state={tip} />
    </div>
  )
}

// ------------------------------------------------------------- timeline ---

export interface DayColumn {
  key: string
  ts: number
  hard: number
  normal: number
  loose: number
  total: number
}

/**
 * Events per day, stacked by band.
 *
 * This started as a dot plot of Bristol type against time, which is the
 * obvious form and was unreadable in practice: at two events a day over six
 * weeks the dots overlap into a smear and nothing can be read off them. A
 * column per day answers the question people actually bring to this chart —
 * "how have the last few weeks gone" — and stays legible at any density the
 * app can realistically produce.
 *
 * Stacked in Bristol order, hard at the bottom through loose at the top, so
 * the stack mirrors the scale itself.
 */
export function DailyBandChart({ days }: { days: DayColumn[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const H = 170
  const PAD = { top: 14, right: 6, bottom: 30, left: 24 }
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = H - PAD.top - PAD.bottom

  if (days.length === 0) return <p className="empty">No events with a recorded form yet.</p>

  /*
   * Only show as many days as can carry a usable column. Six weeks crammed into
   * a 320px phone gave 8px columns, which are not really hittable. Both ends of
   * the axis are labelled so a shorter window is self-describing, and the table
   * view below still holds every day.
   */
  const maxCols = Math.max(7, Math.floor(plotW / 12))
  const shown = days.length > maxCols ? days.slice(-maxCols) : days

  const max = Math.max(1, ...shown.map((d) => d.total))
  const ticks = niceTicks(max, 3)
  const scaleMax = ticks[ticks.length - 1] ?? 1
  const band = plotW / shown.length
  const barW = Math.max(3, Math.min(24, band - 2))
  const GAP = 2 // surface gap between stacked segments

  const summarise = (d: DayColumn) =>
    d.total === 0
      ? 'nothing logged'
      : [d.hard ? `${d.hard} hard` : null, d.normal ? `${d.normal} normal` : null, d.loose ? `${d.loose} loose` : null]
          .filter(Boolean)
          .join(' · ')

  /*
   * One hit surface across the whole plot rather than a rect per column.
   *
   * Per-column targets were 12px wide, below the minimum, and they also put
   * thirty tab stops in the middle of the page — nobody wants to press Tab
   * thirty times to cross a chart. This is the full plot as a single focusable
   * region: the pointer picks the nearest column, and the arrow keys walk it.
   */
  const indexAt = (clientX: number, rect: DOMRect) => {
    const local = clientX - rect.left - PAD.left
    return Math.max(0, Math.min(shown.length - 1, Math.floor(local / band)))
  }

  const step = (delta: number) =>
    setActive((prev) => {
      const next = (prev ?? shown.length - 1) + delta
      return Math.max(0, Math.min(shown.length - 1, next))
    })

  const activeDay = active !== null ? shown[active] : undefined

  return (
    <div className="viz__plot" ref={ref}>
      {width > 0 && (
        <svg width={width} height={H} aria-hidden="true">
          {ticks.map((t) => {
            const y = PAD.top + plotH - (t / scaleMax) * plotH
            return (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke="var(--viz-grid)" strokeWidth="1" />
                <text x={PAD.left - 6} y={y + 4} textAnchor="end" className="viz__tick">
                  {t}
                </text>
              </g>
            )
          })}

          {shown.map((d, i) => {
            const x = PAD.left + i * band + (band - barW) / 2
            const segments: { band: BristolBand; count: number }[] = [
              { band: 'hard', count: d.hard },
              { band: 'normal', count: d.normal },
              { band: 'loose', count: d.loose },
            ]
            let cursor = PAD.top + plotH
            return (
              <g key={d.key}>
                {i === active && (
                  <rect
                    x={PAD.left + i * band}
                    y={PAD.top}
                    width={band}
                    height={plotH}
                    fill="var(--viz-normal)"
                    opacity="0.14"
                  />
                )}
                {segments.map((seg) => {
                  if (seg.count === 0) return null
                  const h = (seg.count / scaleMax) * plotH
                  const y = cursor - h
                  cursor = y - GAP
                  return (
                    <rect
                      key={seg.band}
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(1, h - GAP)}
                      rx={Math.min(2, barW / 2)}
                      fill={bandColor(seg.band)}
                    />
                  )
                })}
              </g>
            )
          })}

          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={PAD.top + plotH}
            y2={PAD.top + plotH}
            stroke="var(--viz-axis)"
            strokeWidth="1"
          />
          <text x={PAD.left} y={H - 10} className="viz__tick">
            {formatDay(shown[0]!.ts)}
          </text>
          <text x={width - PAD.right} y={H - 10} textAnchor="end" className="viz__tick">
            {formatDay(shown[shown.length - 1]!.ts)}
          </text>
        </svg>
      )}

      {width > 0 && (
        <div
          className="viz__surface"
          role="group"
          tabIndex={0}
          aria-label={`Events per day for the last ${shown.length} days. Use the arrow keys to step through days.`}
          onMouseMove={(e) => setActive(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onMouseLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
            else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
            else if (e.key === 'End') { e.preventDefault(); setActive(shown.length - 1) }
            else if (e.key === 'Escape') setActive(null)
          }}
        />
      )}

      {activeDay && (
        <div
          className="viz__tip"
          style={{ left: PAD.left + (active ?? 0) * band + band / 2, top: PAD.top - 2 }}
          role="status"
        >
          <strong>{formatDay(activeDay.ts)}</strong>
          <br />
          {summarise(activeDay)}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------- correlation bars ---

export interface CorrelationBar {
  key: string
  label: string
  rate: number
  count: number
}

export function CorrelationBars({
  bars,
  baseline,
}: {
  bars: CorrelationBar[]
  baseline: number
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<TooltipState | null>(null)

  const ROW = 34
  const PAD = { top: 8, right: 44, bottom: 26, left: 0 }
  const LABEL_W = Math.min(148, Math.max(96, Math.round(width * 0.38)))
  const plotW = Math.max(0, width - LABEL_W - PAD.right)
  const H = PAD.top + bars.length * ROW + PAD.bottom
  const barH = 16

  const xFor = (rate: number) => LABEL_W + rate * plotW

  return (
    <div className="viz__plot" ref={ref}>
      {width > 0 && bars.length > 0 && (
        <svg width={width} height={H} role="img" aria-label="Share of poor stool events following each exposure">
          {/* Every bar is labelled at its tip, so intermediate gridlines would
              only add ink. Direct labels before gridlines. */}
          <line
            x1={xFor(0)}
            x2={xFor(0)}
            y1={PAD.top}
            y2={PAD.top + bars.length * ROW}
            stroke="var(--viz-axis)"
            strokeWidth="1"
          />

          {bars.map((b, i) => {
            const y = PAD.top + i * ROW + (ROW - barH) / 2
            const w = Math.max(2, b.rate * plotW)
            const content = (
              <>
                <strong>{b.label}</strong>
                <br />
                {Math.round(b.rate * 100)}% of {b.count} events were poor
              </>
            )
            return (
              <g key={b.key}>
                <rect
                  x={0}
                  y={PAD.top + i * ROW}
                  width={width}
                  height={ROW}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${b.label}: ${Math.round(b.rate * 100)} percent of ${b.count} events were poor`}
                  onMouseEnter={() => setTip({ x: Math.min(width - 40, xFor(b.rate)), y: y - 6, content })}
                  onMouseLeave={() => setTip(null)}
                  onFocus={() => setTip({ x: Math.min(width - 40, xFor(b.rate)), y: y - 6, content })}
                  onBlur={() => setTip(null)}
                />
                <text x={0} y={PAD.top + i * ROW + ROW / 2 + 4} className="viz__row-label">
                  {truncate(b.label, Math.floor(LABEL_W / 7))}
                </text>
                <path d={roundedEndBar(LABEL_W, y, w, barH, 4)} fill="var(--viz-single)" />
                <text x={LABEL_W + w + 7} y={y + barH - 3} className="viz__label">
                  {Math.round(b.rate * 100)}%
                </text>
              </g>
            )
          })}

          {/* Baseline rule — what the rate is compared against. */}
          <line
            x1={xFor(baseline)}
            x2={xFor(baseline)}
            y1={PAD.top - 4}
            y2={PAD.top + bars.length * ROW + 4}
            stroke="var(--ink-2)"
            strokeWidth="1.5"
          />
          <text x={xFor(baseline)} y={H - 10} textAnchor="middle" className="viz__tick">
            your baseline {Math.round(baseline * 100)}%
          </text>
        </svg>
      )}
      <Tooltip state={tip} />
    </div>
  )
}

// ----------------------------------------------------------- stat tiles ---

/**
 * A status colour never carries meaning alone, so a toned tile always renders
 * an icon beside its value as well as its worded label.
 */
export function StatTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail?: string
  tone?: 'good' | 'critical'
}) {
  const Icon = tone === 'good' ? IconCheckCircle : tone === 'critical' ? IconAlert : null
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value" data-tone={tone}>
        {Icon && <Icon className="stat__icon" />}
        {value}
      </span>
      {detail && <span className="stat__detail">{detail}</span>}
    </div>
  )
}

// --------------------------------------------------------------- helpers ---

/** Bar grown from a baseline: rounded at the data end, square at the baseline. */
function roundedTopBar(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, h, w / 2)
  return `M${x} ${y + h} L${x} ${y + radius} Q${x} ${y} ${x + radius} ${y} L${x + w - radius} ${y} Q${x + w} ${y} ${x + w} ${y + radius} L${x + w} ${y + h} Z`
}

function roundedEndBar(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, w, h / 2)
  return `M${x} ${y} L${x + w - radius} ${y} Q${x + w} ${y} ${x + w} ${y + radius} L${x + w} ${y + h - radius} Q${x + w} ${y + h} ${x + w - radius} ${y + h} L${x} ${y + h} Z`
}

/** Clean axis numbers — 0 / 2 / 4, never 0 / 1.7 / 3.4. */
function niceTicks(max: number, count: number): number[] {
  const raw = max / count
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))))
  const step = Math.max(1, Math.ceil(raw / mag) * mag)
  const ticks: number[] = []
  for (let t = 0; t <= max; t += step) ticks.push(Math.round(t))
  // The top tick has to sit at or above the maximum. When it does not — max 21
  // against a step of 6 stops the loop at 18 — the scale is short of the data
  // and every bar is drawn taller than the plot, pushing the tallest one's
  // label off the top of the SVG.
  const last = ticks[ticks.length - 1] ?? 0
  if (last < max) ticks.push(last + step)
  if (ticks.length < 2) ticks.push(step)
  return ticks
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1))}…`
}

/** Keeps the tooltip from lingering after the pointer leaves the card. */
export function useDismissTooltip(onDismiss: () => void) {
  useEffect(() => {
    window.addEventListener('scroll', onDismiss, { passive: true })
    return () => window.removeEventListener('scroll', onDismiss)
  }, [onDismiss])
}
