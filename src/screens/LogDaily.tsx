/**
 * Daily check-in.
 *
 * Reordered on the same principle as the stool form: water, sleep and the
 * three symptoms everyone can answer are visible; temperature, weight,
 * medications and the service fields are behind one tap. Almost nobody takes
 * their temperature on an ordinary day, so it should not sit between the user
 * and the things they will actually fill in.
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

  useEffect(() => {
    const stored = daily.find((d) => d.id === key)
    if (stored) setEntry(stored)
  }, [daily, key])

  const patch = (p: Partial<DailyEntry>) => setEntry((e) => ({ ...e, ...p }))

  const hasExtras =
    entry.stress !== null ||
    entry.fatigue !== null ||
    entry.weightLb !== null ||
    entry.feverF !== null ||
    entry.caffeineDrinks !== null ||
    entry.travel ||
    entry.dehydrationSigns ||
    entry.meds.length > 0 ||
    entry.drillWeekend ||
    entry.fieldFood ||
    entry.ruckOrRun ||
    entry.notes.length > 0

  async function handleSave() {
    setSaving(true)
    try {
      await saveDaily(entry)
      toast('Saved')
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
        title="Today’s check-in"
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
          <Card title="Water">
            <div className="stack">
              <Field
                label="Today so far"
                value={
                  entry.waterOz !== null ? <span>{entry.waterOz} oz</span> : <span>—</span>
                }
              >
                <div className="meter" aria-hidden="true">
                  <div className="meter__fill" style={{ width: `${waterPct * 100}%` }} />
                </div>
                <div className="btn-row" style={{ marginTop: 'var(--s3)' }}>
                  <button
                    type="button"
                    className="btn btn--secondary btn--lg"
                    onClick={() => patch({ waterOz: (entry.waterOz ?? 0) + 8 })}
                  >
                    <IconDroplet />+ 8 oz
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--lg"
                    onClick={() => patch({ waterOz: (entry.waterOz ?? 0) + 24 })}
                  >
                    <IconDroplet />+ 24 oz
                  </button>
                </div>
                {entry.waterOz !== null && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ paddingLeft: 0, marginTop: 'var(--s1)' }}
                    onClick={() => patch({ waterOz: null })}
                  >
                    Reset
                  </button>
                )}
              </Field>
            </div>
          </Card>

          <Card title="How do you feel?">
            <div className="stack">
              <SeverityRow label="Bloating" value={entry.bloating} onChange={(v) => patch({ bloating: v })} />
              <SeverityRow label="Gas" value={entry.gas} onChange={(v) => patch({ gas: v })} />
              <SeverityRow label="Nausea" value={entry.nausea} onChange={(v) => patch({ nausea: v })} />
              <NumberField
                label="Sleep"
                value={entry.sleepHours}
                onChange={(v) => patch({ sleepHours: v })}
                suffix="hours"
                step={0.5}
                max={24}
                placeholder="7.5"
              />
            </div>
          </Card>

          <details className="more" open={hasExtras}>
            <summary>
              Add more detail
              <span className="more__hint">optional</span>
            </summary>
            <div className="more__body">
              <div className="stack">
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
                  label="Temperature, if you took it"
                  hint="Above 101.5°F alongside gut symptoms is worth being seen for."
                  value={entry.feverF}
                  onChange={(v) => patch({ feverF: v })}
                  suffix="°F"
                  step={0.1}
                  min={90}
                  max={110}
                  placeholder="98.6"
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
                <SwitchRow
                  label="Dizzy standing up, or no urination for 8+ hours"
                  hint="A sign you are properly low on fluid. Worth same-day attention."
                  checked={entry.dehydrationSigns}
                  onChange={(v) => patch({ dehydrationSigns: v })}
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

                {settings.guardFields && (
                  <>
                    <SwitchRow
                      label="Drill weekend"
                      hint="These days stack irregular eating, dehydration, stress and load all at once."
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
                      checked={entry.ruckOrRun}
                      onChange={(v) => patch({ ruckOrRun: v })}
                    />
                  </>
                )}

                <Field label="Notes">
                  <textarea
                    className="textarea"
                    placeholder="Anything else about today."
                    value={entry.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          </details>

          <button className="btn btn--primary btn--lg btn--block" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </main>
    </>
  )
}
