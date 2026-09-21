/**
 * Stool entry.
 *
 * Ordered by what people actually fill in, not by what is clinically tidy.
 * Speaking it is the first option, then the rating, then form, colour and
 * pain — the four things anyone can answer without thinking. Everything else
 * is real and worth having, but it is behind one tap, because a form that
 * asks twelve questions is a form that gets abandoned in a bathroom.
 *
 * Nothing is required. A rating on its own is a complete, useful entry.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  COLORS,
  STOOL_FLAGS,
  type BristolType,
  type PainPhase,
  type StoolColor,
  type StoolEntry,
  type StoolFlag,
} from '../db/schema'
import { blankStool, useStore } from '../store'
import { deriveRating } from '../lib/analysis'
import { flagsForEntry } from '../lib/redflags'
import { toLocalInput, fromLocalInput, relativeTime } from '../lib/time'
import { navigate, goBack } from '../router'
import { AppBar, Alert, ChipGroup, Card, Field, Scale } from '../components/ui'
import { BristolPicker } from '../components/BristolPicker'
import { PhotoField } from '../components/PhotoField'
import { RatingDot, TIER_LABEL, ratingTier } from '../components/RatingDot'
import { IconClock, IconMic, IconTrash } from '../components/icons'

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

  // The rating tracks the other fields until it is set by hand, then it stops.
  useEffect(() => {
    if (!ratingTouched) setEntry((e) => ({ ...e, rating: suggested }))
  }, [suggested, ratingTouched])

  const toggleFlag = (flag: StoolFlag) =>
    patch({
      flags: entry.flags.includes(flag) ? entry.flags.filter((f) => f !== flag) : [...entry.flags, flag],
    })

  const togglePhase = (phase: PainPhase) =>
    patch({
      painPhase: entry.painPhase.includes(phase)
        ? entry.painPhase.filter((p) => p !== phase)
        : [...entry.painPhase, phase],
    })

  const liveFlags = useMemo(() => flagsForEntry(entry), [entry])
  const concerningFlagIds = STOOL_FLAGS.filter((f) => f.concerning).map((f) => f.id)
  const hasExtras =
    entry.urgency !== null ||
    entry.painPhase.length > 0 ||
    entry.flags.length > 0 ||
    entry.photoId !== null ||
    entry.notes.length > 0

  async function handleSave() {
    setSaving(true)
    try {
      await saveStool(entry)
      toast('Saved')
      navigate({ name: 'today' })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save')
      setSaving(false)
    }
  }

  async function handlePhoto(file: File) {
    setPhotoBusy(true)
    try {
      patch({ photoId: await addPhoto(file) })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not attach that photograph')
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <>
      <AppBar
        title={existing ? 'Edit entry' : 'Log a stool'}
        back
        action={
          <button className="appbar__action" onClick={handleSave} disabled={saving}>
            Save
          </button>
        }
      />
      <main className="main">
        <div className="stack">
          {/* First option, as asked: say it and let the app fill it in. */}
          {!existing && (
            <button className="voice-strip" onClick={() => navigate({ name: 'voice' })}>
              <IconMic />
              <span className="voice-strip__text">
                <span className="voice-strip__title">Describe it out loud</span>
                <span className="voice-strip__hint">
                  “Really bad one, basically water, cramping like an 8”
                </span>
              </span>
            </button>
          )}

          <Card>
            <div className="stack">
              <Scale
                label="How was it?"
                value={entry.rating}
                onChange={(v) => {
                  setRatingTouched(v !== null)
                  patch({ rating: v })
                }}
                lowLabel="awful"
                highLabel="perfectly normal"
                colourByRating
                hint={
                  entry.rating !== null && !ratingTouched
                    ? 'Filled in from what you entered below — tap any number to change it.'
                    : 'This is the number your calendar shows.'
                }
              />
              {entry.rating !== null && (
                <div className="rating-preview">
                  <RatingDot rating={entry.rating} size="lg" />
                  <span className="small muted">
                    Shows as {TIER_LABEL[ratingTier(entry.rating)].toLowerCase()} in your history
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card title="What did it look like?">
            <BristolPicker
              value={entry.bristol}
              onChange={(v) => patch({ bristol: v as BristolType | null })}
            />
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

          <Card title="Did it hurt?">
            <Scale
              label="Pain"
              value={entry.pain}
              onChange={(v) => patch({ pain: v })}
              lowLabel="none"
              highLabel="worst"
            />
          </Card>

          {liveFlags.length > 0 && settings.redFlagAlerts && (
            <Alert
              tone={liveFlags[0]!.severity === 'urgent' ? 'critical' : 'warning'}
              title={liveFlags[0]!.title}
            >
              {liveFlags[0]!.detail}
            </Alert>
          )}

          {/* Everything below here is optional and stays out of the way. */}
          <details className="more" open={hasExtras}>
            <summary>
              Add more detail
              <span className="more__hint">optional</span>
            </summary>
            <div className="more__body">
              <div className="stack">
                <Scale
                  label="How urgent was it?"
                  value={entry.urgency}
                  onChange={(v) => patch({ urgency: v })}
                  lowLabel="could easily wait"
                  highLabel="barely made it"
                />

                {entry.pain !== null && entry.pain > 1 && (
                  <ChipGroup
                    label="When did it hurt?"
                    options={PAIN_PHASES}
                    selected={entry.painPhase}
                    onToggle={togglePhase}
                  />
                )}

                <ChipGroup
                  label="Anything you noticed"
                  options={STOOL_FLAGS}
                  selected={entry.flags}
                  onToggle={toggleFlag}
                  alertIds={concerningFlagIds}
                  hint="Leave blank if nothing stood out."
                />

                {settings.photosEnabled && (
                  <PhotoField
                    photoId={entry.photoId}
                    busy={photoBusy}
                    onAdd={handlePhoto}
                    onRemove={() => {
                      if (entry.photoId) void removePhoto(entry.photoId)
                      patch({ photoId: null })
                    }}
                  />
                )}

                <Field label="Notes">
                  <textarea
                    className="textarea"
                    placeholder="Anything else worth remembering."
                    value={entry.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                  />
                </Field>

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
                    >
                      <IconClock />
                      Now
                    </button>
                  </div>
                </Field>

                {entry.transcript && (
                  <p className="field__hint">
                    <strong>What you said:</strong> “{entry.transcript}”
                  </p>
                )}
              </div>
            </div>
          </details>

          <button className="btn btn--primary btn--lg btn--block" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>

          {existing && (
            <button
              className="btn btn--danger btn--block"
              onClick={async () => {
                if (!window.confirm('Delete this entry? This cannot be undone.')) return
                await removeStool(existing.id)
                toast('Deleted')
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
