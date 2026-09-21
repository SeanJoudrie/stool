/**
 * Daily check-in.
 *
 * Context that a single event cannot carry: hydration, sleep, stress, travel,
 * and — for anyone logging around service — the drill-weekend stack, which is
 * the highest-signal day there is. Irregular eating, dehydration, stress, bad
 * food and physical load all land at once, so if any day is worth capturing
 * properly it is that one.
 *
 * Every field is optional. A half-filled day still contributes.
 */
import { useEffect, useState } from 'react'
import { SEVERITIES, type DailyEntry, type Severity } from '../db/schema'
import { blankDaily, useStore } from '../store'
import { dateKey, formatDayLong, dateKeyToTs } from '../lib/time'
import { navigate } from '../router'
import { AppBar, Card, Field, NumberField, Scale, Segmented, SwitchRow } from '../components/ui'
import { IconDroplet } from '../components/icons'

function SeverityRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: Severity | null
  onChange: (v: Severity) => void
}) {
  return <Segmented label={label} options={SEVERITIES} value={value} onChange={onChange} />
}

export function LogDaily({ date }: { date?: string }) {
  const { daily, settings, saveDaily, toast } = useStore()
  const key = date ?? dateKey(Date.now())

  const [entry, setEntry] = useState<DailyEntry>(
    () => daily.find((d) => d.id === key) ?? blankDaily(key),
  )
  const [saving, setSaving] = useState(false)

  // The store may still be loading when this screen mounts.
  useEffect(() => {
    const stored = daily.find((d) => d.id === key)
    if (stored) setEntry(stored)
  }, [daily, key])

  const patch = (p: Partial<DailyEntry>) => setEntry((e) => ({ ...e, ...p }))

  async function handleSave() {
    setSaving(true)
    try {
      await saveDaily(entry)
      toast('Check-in saved')
      navigate({ name: 'today' })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save')
      setSaving(false)
    }
  }

  const waterPct = entry.waterOz !== null ? Math.min(1, entry.waterOz / settings.waterTargetOz) : 0

  return (
    <>
      <AppBar
        title="Daily check-in"
        subtitle={formatDayLong(dateKeyToTs(key))}
        back
        action={
          <button className="appbar__action" onClick={handleSave} disabled={saving}>
            Save
          </button>
        }
      />
      <main className="main">
        <div className="stack">
          <Card title="Hydration">
            <div className="stack">
              <Field
                label="Water"
                value={
                  entry.waterOz !== null ? (
                    <span>
                      {entry.waterOz} oz · {Math.round(waterPct * 100)}% of target
                    </span>
                  ) : null
                }
              >
                <div className="meter" aria-hidden="true">
                  <div className="meter__fill" style={{ width: `${waterPct * 100}%` }} />
                </div>
                <div className="btn-row" style={{ marginTop: 'var(--s2)' }}>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => patch({ waterOz: (entry.waterOz ?? 0) + 8 })}
                  >
                    <IconDroplet />
                    + 8 oz
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => patch({ waterOz: (entry.waterOz ?? 0) + 24 })}
                  >
                    <IconDroplet />
                    + 24 oz
                  </button>
                </div>
              </Field>
              <NumberField
                label="Or enter a total"
                value={entry.waterOz}
                onChange={(v) => patch({ waterOz: v })}
                suffix="oz"
                step={4}
                placeholder="0"
              />
              <SwitchRow
                label="Dizzy standing up, or no urination for 8+ hours"
                hint="A volume-depletion sign. Worth same-day attention if it happens."
                checked={entry.dehydrationSigns}
                onChange={(v) => patch({ dehydrationSigns: v })}
              />
            </div>
          </Card>

          <Card title="How the day went">
            <div className="stack">
              <NumberField
                label="Sleep"
                value={entry.sleepHours}
                onChange={(v) => patch({ sleepHours: v })}
                suffix="hours"
                step={0.5}
                max={24}
                placeholder="7.5"
              />
              <Scale
                label="Stress"
                value={entry.stress}
                onChange={(v) => patch({ stress: v })}
                lowLabel="none"
                highLabel="severe"
              />
              <Scale
                label="Fatigue"
                value={entry.fatigue}
                onChange={(v) => patch({ fatigue: v })}
                lowLabel="none"
                highLabel="wiped out"
              />
            </div>
          </Card>

          <Card title="Symptoms">
            <div className="stack">
              <SeverityRow label="Bloating" value={entry.bloating} onChange={(v) => patch({ bloating: v })} />
              <SeverityRow label="Gas" value={entry.gas} onChange={(v) => patch({ gas: v })} />
              <SeverityRow label="Nausea" value={entry.nausea} onChange={(v) => patch({ nausea: v })} />
              <NumberField
                label="Temperature, if you took it"
                hint="Above 101.5°F alongside GI symptoms is worth being seen for."
                value={entry.feverF}
                onChange={(v) => patch({ feverF: v })}
                suffix="°F"
                step={0.1}
                min={90}
                max={110}
                placeholder="98.6"
              />
            </div>
          </Card>

          <Card title="Context">
            <div className="stack">
              <NumberField
                label="Weight"
                hint="Worth taking before and after a bad day: 1 lb lost is roughly 16 oz of fluid to replace."
                value={entry.weightLb}
                onChange={(v) => patch({ weightLb: v })}
                suffix="lb"
                step={0.1}
                placeholder="130"
              />
              <NumberField
                label="Caffeinated drinks"
                hint="Include energy drinks and pre-workout."
                value={entry.caffeineDrinks}
                onChange={(v) => patch({ caffeineDrinks: v })}
                step={1}
                max={20}
                placeholder="0"
              />
              <SwitchRow
                label="Travel day"
                hint="Hours of sitting, low fibre and low fluid is the classic constipation setup."
                checked={entry.travel}
                onChange={(v) => patch({ travel: v })}
              />
              <Field
                label="Medications and supplements"
                hint="Comma separated. Iron and bismuth both darken stool, which matters when reading colour."
              >
                <input
                  className="input"
                  placeholder="e.g. iron, ibuprofen, fibre supplement"
                  value={entry.meds.join(', ')}
                  onChange={(e) =>
                    patch({ meds: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
                  }
                />
              </Field>
            </div>
          </Card>

          {settings.guardFields && (
            <Card
              title="Service"
              subtitle="These days stack every risk factor at once, which makes them the most informative days in the whole log."
            >
              <div className="stack">
                <SwitchRow
                  label="Drill weekend"
                  checked={entry.drillWeekend}
                  onChange={(v) => patch({ drillWeekend: v })}
                />
                <SwitchRow
                  label="Field food or MRE"
                  hint="Near-zero fibre, and reliably constipating."
                  checked={entry.fieldFood}
                  onChange={(v) => patch({ fieldFood: v })}
                />
                <SwitchRow
                  label="Ruck or run"
                  hint="Exercise-induced GI distress is more likely with a fast baseline transit."
                  checked={entry.ruckOrRun}
                  onChange={(v) => patch({ ruckOrRun: v })}
                />
              </div>
            </Card>
          )}

          <Card title="Notes">
            <textarea
              className="textarea"
              placeholder="Anything else about today."
              value={entry.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </Card>

          <button className="btn btn--primary btn--lg btn--block" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save check-in'}
          </button>
        </div>
      </main>
    </>
  )
}
