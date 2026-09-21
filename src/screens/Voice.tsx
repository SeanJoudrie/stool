/**
 * Spoken entry.
 *
 * Say it in plain words — "had a really bad one this morning, basically water,
 * cramping like an eight" — and the parser fills the clinical fields.
 *
 * The confirmation step is not optional and not a formality. The parser is
 * rule-based and will sometimes be wrong, and a record a doctor will read must
 * never contain a value the patient did not actually state. So every parse is
 * shown back in plain words before anything is written, the raw transcript is
 * stored alongside the entry, and anything the parser missed is still in it.
 */
import { useMemo, useState } from 'react'
import { BRISTOL, COLORS, STOOL_FLAGS, type StoolEntry } from '../db/schema'
import { parseTranscript, type ParseResult } from '../lib/parse'
import { useSpeech } from '../lib/speech'
import { blankFood, blankStool, useStore } from '../store'
import { setFoodDraft, setStoolDraft } from '../lib/draft'
import { formatDateTime } from '../lib/time'
import { navigate } from '../router'
import { AppBar, Alert, Card } from '../components/ui'
import { IconCheck, IconEdit, IconFood, IconMic } from '../components/icons'

const EXAMPLES = [
  'Had a poop that was bad, basically all water, cramping like an 8',
  'Just pebbles this morning, had to strain, no blood',
  'Ate a pastrami sandwich with coleslaw at 1pm',
  'Went at 2:17, type 6, urgent, some mucus',
]

export function Voice() {
  const { saveStool, saveFood, toast } = useStore()
  const speech = useSpeech()
  const [reviewing, setReviewing] = useState(false)
  const [saving, setSaving] = useState(false)

  const text = `${speech.transcript} ${speech.interim}`.trim()
  const parsed: ParseResult | null = useMemo(
    () => (reviewing && text ? parseTranscript(text) : null),
    [reviewing, text],
  )

  function review() {
    if (speech.listening) speech.stop()
    if (!text.trim()) {
      toast('Nothing to read yet')
      return
    }
    setReviewing(true)
  }

  async function saveAll() {
    if (!parsed) return
    setSaving(true)
    try {
      if (parsed.stool) {
        const entry: StoolEntry = {
          ...blankStool(parsed.stool.ts),
          bristol: parsed.stool.bristol,
          color: parsed.stool.color,
          urgency: parsed.stool.urgency,
          pain: parsed.stool.pain,
          painPhase: parsed.stool.painPhase,
          rating: parsed.stool.rating,
          flags: parsed.stool.flags,
          source: 'voice',
          transcript: parsed.transcript,
        }
        await saveStool(entry)
      }
      if (parsed.food) {
        await saveFood({
          ...blankFood(parsed.food.ts),
          items: parsed.food.items,
          tags: parsed.food.tags,
          mealKind: parsed.food.mealKind,
          source: 'voice',
          transcript: parsed.transcript,
        })
      }
      toast(parsed.intent === 'both' ? 'Both entries saved' : 'Entry saved')
      navigate({ name: 'today' })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save')
      setSaving(false)
    }
  }

  function editStool() {
    if (!parsed?.stool) return
    setStoolDraft({
      ts: parsed.stool.ts,
      bristol: parsed.stool.bristol,
      color: parsed.stool.color,
      urgency: parsed.stool.urgency,
      pain: parsed.stool.pain,
      painPhase: parsed.stool.painPhase,
      rating: parsed.stool.rating,
      flags: parsed.stool.flags,
      source: 'voice',
      transcript: parsed.transcript,
    })
    navigate({ name: 'log-stool' })
  }

  function editFood() {
    if (!parsed?.food) return
    setFoodDraft({
      ts: parsed.food.ts,
      items: parsed.food.items,
      tags: parsed.food.tags,
      mealKind: parsed.food.mealKind,
      source: 'voice',
      transcript: parsed.transcript,
    })
    navigate({ name: 'log-food' })
  }

  return (
    <>
      <AppBar title="Speak an entry" back />
      <main className="main">
        <div className="stack">
          {!reviewing && (
            <>
              <Card>
                <div className="stack" style={{ alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`mic${speech.listening ? ' mic--live' : ''}`}
                    onClick={() => (speech.listening ? speech.stop() : speech.start())}
                    aria-label={speech.listening ? 'Stop listening' : 'Start listening'}
                    disabled={!speech.supported}
                  >
                    <IconMic />
                  </button>
                  <p className="small muted" style={{ textAlign: 'center' }} aria-live="polite">
                    {!speech.supported
                      ? 'This browser cannot listen directly — type below, or use your keyboard’s dictation key. It works exactly the same.'
                      : speech.listening
                        ? 'Listening. Say it however you would say it out loud.'
                        : 'Tap and describe it in your own words.'}
                  </p>
                </div>
              </Card>

              <Card title="What you said">
                <textarea
                  className="textarea"
                  style={{ minHeight: 120 }}
                  placeholder="Tap the microphone, or type here."
                  value={text}
                  onChange={(e) => speech.setTranscript(e.target.value)}
                />
                {speech.error && (
                  <p className="field__hint" style={{ marginTop: 'var(--s2)' }}>
                    {speech.error}
                  </p>
                )}
              </Card>

              <Card title="Phrasing it understands">
                <ul className="examples">
                  {EXAMPLES.map((e) => (
                    <li key={e}>
                      <button type="button" onClick={() => speech.setTranscript(e)}>
                        “{e}”
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>

              <button
                className="btn btn--primary btn--lg btn--block"
                onClick={review}
                disabled={!text.trim()}
              >
                Read it back
              </button>
            </>
          )}

          {reviewing && parsed && (
            <>
              <Card title="What you said">
                <p style={{ fontStyle: 'italic' }}>“{parsed.transcript}”</p>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ paddingLeft: 0 }}
                  onClick={() => setReviewing(false)}
                >
                  Change it
                </button>
              </Card>

              {parsed.intent === 'unknown' && (
                <Alert tone="warning" title="Could not pick anything out of that">
                  Nothing in it matched a stool or food description. You can still open a blank form
                  and fill it in — your words are kept either way.
                </Alert>
              )}

              {parsed.stool && (
                <Card
                  title="Stool entry"
                  subtitle={formatDateTime(parsed.stool.ts)}
                  action={
                    <button type="button" className="appbar__action" onClick={editStool}>
                      <IconEdit style={{ width: 16, height: 16, verticalAlign: '-3px' }} /> Edit
                    </button>
                  }
                >
                  <dl className="readback">
                    <Row
                      label="Form"
                      value={
                        parsed.stool.bristol
                          ? `Type ${parsed.stool.bristol} — ${BRISTOL[parsed.stool.bristol - 1]!.name}`
                          : null
                      }
                    />
                    <Row
                      label="Colour"
                      value={COLORS.find((c) => c.id === parsed.stool!.color)?.label ?? null}
                    />
                    <Row label="Overall" value={parsed.stool.rating ? `${parsed.stool.rating}/10` : null} />
                    <Row label="Urgency" value={parsed.stool.urgency ? `${parsed.stool.urgency}/10` : null} />
                    <Row label="Pain" value={parsed.stool.pain ? `${parsed.stool.pain}/10` : null} />
                    <Row
                      label="Observations"
                      value={
                        parsed.stool.flags.length > 0
                          ? parsed.stool.flags
                              .map((f) => STOOL_FLAGS.find((s) => s.id === f)?.label ?? f)
                              .join(', ')
                          : null
                      }
                    />
                  </dl>
                  {!parsed.stool.tsExplicit && (
                    <p className="field__hint" style={{ marginTop: 'var(--s3)' }}>
                      You did not say a time, so this is logged as now. Tap Edit to change it.
                    </p>
                  )}
                </Card>
              )}

              {parsed.food && (
                <Card
                  title="Food entry"
                  subtitle={formatDateTime(parsed.food.ts)}
                  action={
                    <button type="button" className="appbar__action" onClick={editFood}>
                      <IconEdit style={{ width: 16, height: 16, verticalAlign: '-3px' }} /> Edit
                    </button>
                  }
                >
                  <dl className="readback">
                    <Row label="Items" value={parsed.food.items.join(', ')} />
                    <Row label="Tags" value={parsed.food.tags.join(', ') || null} />
                  </dl>
                </Card>
              )}

              <Alert tone="info" title="Check this before saving">
                Your exact words are stored with the entry, so anything missed here is not lost. Open
                the full form if you want to add a photograph, notes, or a field it did not catch.
              </Alert>

              <div className="stack stack--tight">
                {parsed.intent !== 'unknown' && (
                  <button
                    className="btn btn--primary btn--lg btn--block"
                    onClick={saveAll}
                    disabled={saving}
                  >
                    <IconCheck />
                    {saving ? 'Saving…' : parsed.intent === 'both' ? 'Save both entries' : 'Save entry'}
                  </button>
                )}
                {!parsed.stool && (
                  <button className="btn btn--secondary btn--block" onClick={() => navigate({ name: 'log-stool' })}>
                    Open a blank stool form
                  </button>
                )}
                {!parsed.food && (
                  <button className="btn btn--secondary btn--block" onClick={() => navigate({ name: 'log-food' })}>
                    <IconFood />
                    Open a blank food form
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={value ? '' : 'muted'}>{value ?? 'not mentioned'}</dd>
    </>
  )
}
