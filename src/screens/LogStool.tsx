/**
 * Stool entry.
 *
 * Designed against one constraint: if this takes more than about twenty
 * seconds standing in a bathroom, the app stops getting used and the whole
 * record is worthless. So the timestamp is captured automatically, every
 * clinical field is a single tap, the rating is pre-filled from what was
 * entered, and nothing is required — a partial entry saves fine and is far
 * better than no entry.
 */
import { useEffect, useMemo, useState } from 'react'
import { COLORS, STOOL_FLAGS, type BristolType, type PainPhase, type StoolColor, type StoolEntry, type StoolFlag } from '../db/schema'
import { blankStool, useStore } from '../store'
import { deriveRating } from '../lib/analysis'
import { flagsForEntry } from '../lib/redflags'
import { toLocalInput, fromLocalInput, relativeTime } from '../lib/time'
import { navigate, goBack } from '../router'
import { AppBar, Alert, ChipGroup, Card, Field, Scale } from '../components/ui'
import { BristolPicker } from '../components/BristolPicker'
import { PhotoField } from '../components/PhotoField'
import { IconClock, IconTrash } from '../components/icons'

const PAIN_PHASES: { id: PainPhase; label: string }[] = [
  { id: 'before', label: 'Before' },
  { id: 'during', label: 'During' },
  { id: 'after', label: 'After' },
]

export function LogStool({ id, draft }: { id?: string; draft?: Partial<StoolEntry> }) {
  const { stool, settings, saveStool, removeStool, addPhoto, removePhoto, toast } = useStore()
  const existing = id ? stool.find((e) => e.id === id) : undefined

  const [entry, setEntry] = useState<StoolEntry>(() => ({
    ...blankStool(),
    ...(existing ?? {}),
    ...(draft ?? {}),
  }))
  const [ratingTouched, setRatingTouched] = useState(
    () => (existing?.rating ?? draft?.rating ?? null) !== null,
  )
  const [photoBusy, setPhotoBusy] = useState(false)
  const [saving, setSaving] = useState(false)

  const patch = (p: Partial<StoolEntry>) => setEntry((e) => ({ ...e, ...p }))

  const suggested = useMemo(() => deriveRating(entry), [entry])

  // Keep the rating in step with the clinical fields until the user sets it
  // themselves, at which point their number wins and stops moving.
  useEffect(() => {
    if (!ratingTouched) setEntry((e) => ({ ...e, rating: suggested }))
  }, [suggested, ratingTouched])

  const toggleFlag = (flag: StoolFlag) =>
    patch({
      flags: entry.flags.includes(flag)
        ? entry.flags.filter((f) => f !== flag)
        : [...entry.flags, flag],
    })

  const togglePhase = (phase: PainPhase) =>
    patch({
      painPhase: entry.painPhase.includes(phase)
        ? entry.painPhase.filter((p) => p !== phase)
        : [...entry.painPhase, phase],
    })

  const liveFlags = useMemo(() => flagsForEntry(entry), [entry])
  const concerningFlagIds = STOOL_FLAGS.filter((f) => f.concerning).map((f) => f.id)

  async function handleSave() {
    setSaving(true)
    try {
      await saveStool(entry)
      const raised = settings.redFlagAlerts ? flagsForEntry(entry) : []
      toast(raised.length > 0 ? 'Entry saved — see the note on your timeline' : 'Entry saved')
      navigate({ name: 'today' })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save the entry')
      setSaving(false)
    }
  }

  async function handlePhoto(file: File) {
    setPhotoBusy(true)
    try {
      const photoId = await addPhoto(file)
      patch({ photoId })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not attach that photograph')
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <>
      <AppBar
        title={existing ? 'Edit stool entry' : 'Stool entry'}
        back
        action={
          <button className="appbar__action" onClick={handleSave} disabled={saving}>
            Save
          </button>
        }
      />
      <main className="main">
        <div className="stack">
          <Card>
            <div className="stack">
              <Field
                label="Time"
                id="stool-time"
                value={<span className="muted small">{relativeTime(entry.ts)}</span>}
              >
                <div style={{ display: 'flex', gap: 'var(--s2)' }}>
                  <input
                    id="stool-time"
                    className="input"
                    type="datetime-local"
                    value={toLocalInput(entry.ts)}
                    onChange={(e) => patch({ ts: fromLocalInput(e.target.value) })}
                  />
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => patch({ ts: Date.now() })}
                    aria-label="Set to now"
                  >
                    <IconClock />
                    Now
                  </button>
                </div>
              </Field>

              <BristolPicker
                value={entry.bristol}
                onChange={(v) => patch({ bristol: v as BristolType | null })}
              />
            </div>
          </Card>

          <Card title="Colour">
            <div className="colorgrid">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="colorgrid__tile"
                  aria-pressed={entry.color === c.id}
                  onClick={() => patch({ color: entry.color === c.id ? null : (c.id as StoolColor) })}
                >
                  <span className="colorgrid__dot" style={{ background: c.swatch }} />
                  {c.label}
                </button>
              ))}
            </div>
            {entry.color && (
              <p className="field__hint" style={{ marginTop: 'var(--s3)' }}>
                {COLORS.find((c) => c.id === entry.color)?.note}
              </p>
            )}
          </Card>

          <Card title="How it went">
            <div className="stack">
              <Scale
                label="Overall"
                value={entry.rating}
                onChange={(v) => {
                  setRatingTouched(v !== null)
                  patch({ rating: v })
                }}
                lowLabel="worst"
                highLabel="healthy, quick, clean"
                hint={
                  !ratingTouched && entry.rating !== null
                    ? 'Suggested from what you entered. Tap any number to set it yourself.'
                    : undefined
                }
              />
              <Scale
                label="Urgency"
                value={entry.urgency}
                onChange={(v) => patch({ urgency: v })}
                lowLabel="could easily wait"
                highLabel="barely made it"
                hint="Could you have waited ten minutes?"
              />
              <Scale
                label="Pain"
                value={entry.pain}
                onChange={(v) => patch({ pain: v })}
                lowLabel="none"
                highLabel="worst"
              />
              {entry.pain !== null && entry.pain > 1 && (
                <ChipGroup
                  label="When did it hurt?"
                  options={PAIN_PHASES}
                  selected={entry.painPhase}
                  onToggle={togglePhase}
                />
              )}
            </div>
          </Card>

          <Card title="Anything else">
            <ChipGroup
              label="Observations"
              options={STOOL_FLAGS}
              selected={entry.flags}
              onToggle={toggleFlag}
              alertIds={concerningFlagIds}
              hint="Tap anything that applies. Leave blank if nothing stood out."
            />
          </Card>

          {liveFlags.length > 0 && settings.redFlagAlerts && (
            <Alert tone={liveFlags[0]!.severity === 'urgent' ? 'critical' : 'warning'} title={liveFlags[0]!.title}>
              {liveFlags[0]!.detail}
            </Alert>
          )}

          {settings.photosEnabled && (
            <Card>
              <PhotoField
                photoId={entry.photoId}
                busy={photoBusy}
                onAdd={handlePhoto}
                onRemove={() => {
                  if (entry.photoId) void removePhoto(entry.photoId)
                  patch({ photoId: null })
                }}
              />
            </Card>
          )}

          <Card title="Notes">
            <textarea
              className="textarea"
              placeholder="Anything a doctor would want to know — where the pain was, what you'd eaten, how you felt afterwards."
              value={entry.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
            {entry.transcript && (
              <p className="field__hint" style={{ marginTop: 'var(--s3)' }}>
                <strong>What you said:</strong> “{entry.transcript}”
              </p>
            )}
          </Card>

          <button className="btn btn--primary btn--lg btn--block" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save entry'}
          </button>

          {existing && (
            <button
              className="btn btn--danger btn--block"
              onClick={async () => {
                if (!window.confirm('Delete this entry? This cannot be undone.')) return
                await removeStool(existing.id)
                toast('Entry deleted')
                goBack()
              }}
            >
              <IconTrash />
              Delete this entry
            </button>
          )}
        </div>
      </main>
    </>
  )
}
