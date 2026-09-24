/**
 * Food entry.
 *
 * Explicitly not a nutrition tracker. There are no calories, no macros and no
 * portion sizes, because none of them help answer the only question this log
 * exists to answer: what went in, and when. Adding them would make the entry
 * slow enough that it stops happening, and an unlogged meal breaks every
 * correlation downstream.
 *
 * Water lives here too. It is the one drink that reliably changes stool, so it
 * earns a place in the log — but not a screen, not a target and not a streak.
 * Two buttons on the meal you were already logging.
 */
import { useMemo, useState } from 'react'
import { FOOD_TAGS, type FoodEntry, type FoodTag, type MealKind } from '../db/schema'
import { COMMON_FOODS, autoTagItems, splitItems } from '../lib/foodTags'
import { blankFood, useStore } from '../store'
import { fromLocalInput, relativeTime, toLocalInput } from '../lib/time'
import { goBack, navigate } from '../router'
import { AppBar, Card, Field, Segmented, Spinner } from '../components/ui'
import { IconClock, IconClose, IconDroplet, IconPlus, IconTrash } from '../components/icons'

const MEAL_KINDS: { id: MealKind; label: string }[] = [
  { id: 'meal', label: 'Meal' },
  { id: 'snack', label: 'Snack' },
  { id: 'drink', label: 'Drink' },
]

export function LogFood({ id, draft }: { id?: string; draft?: Partial<FoodEntry> }) {
  const { food, saveFood, removeFood, toast } = useStore()
  const existing = id ? food.find((e) => e.id === id) : undefined

  const [entry, setEntry] = useState<FoodEntry>(() => ({
    ...blankFood(),
    ...(existing ?? {}),
    ...(draft ?? {}),
  }))
  const [input, setInput] = useState('')
  const [tagsTouched, setTagsTouched] = useState(
    () => (existing?.tags.length ?? draft?.tags?.length ?? 0) > 0,
  )
  const [saving, setSaving] = useState(false)

  const patch = (p: Partial<FoodEntry>) => setEntry((e) => ({ ...e, ...p }))

  const hasExtras = Boolean(existing) || entry.notes.length > 0 || entry.mealKind !== 'meal'

  /** Items the user has logged before, most recent first — the fastest path. */
  const recent = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const f of food) {
      for (const item of f.items) {
        const key = item.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          out.push(item)
        }
      }
      if (out.length >= 12) break
    }
    for (const c of COMMON_FOODS) {
      if (out.length >= 14) break
      if (!seen.has(c.toLowerCase())) out.push(c)
    }
    return out.slice(0, 14)
  }, [food])

  function addItems(text: string) {
    const parsed = splitItems(text)
    if (parsed.length === 0) return
    const items = [...entry.items, ...parsed.filter((p) => !entry.items.includes(p))]
    patch({ items, ...(tagsTouched ? {} : { tags: autoTagItems(items) }) })
    setInput('')
  }

  function removeItem(item: string) {
    const items = entry.items.filter((i) => i !== item)
    patch({ items, ...(tagsTouched ? {} : { tags: autoTagItems(items) }) })
  }

  function toggleTag(tag: FoodTag) {
    setTagsTouched(true)
    patch({
      tags: entry.tags.includes(tag) ? entry.tags.filter((t) => t !== tag) : [...entry.tags, tag],
    })
  }

  async function handleSave() {
    const pending = input.trim()
    const items = pending ? [...entry.items, ...splitItems(pending)] : entry.items
    // Water on its own is a perfectly good entry.
    if (items.length === 0 && !entry.waterOz) {
      toast('Add something first')
      return
    }
    setSaving(true)
    try {
      await saveFood({
        ...entry,
        items,
        tags: tagsTouched ? entry.tags : autoTagItems(items),
      })
      toast('Meal logged')
      navigate({ name: 'today' })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save')
      setSaving(false)
    }
  }

  return (
    <>
      <AppBar
        title={existing ? 'Edit meal' : 'Food entry'}
        back
        action={
          <button className="appbar__action" onClick={handleSave} disabled={saving}>
            Save
          </button>
        }
      />
      <main className="main">
        <div className="stack">
          <Card title="What you ate">
            <div className="stack">
              <div className="input-row">
                <input
                  className="input"
                  placeholder="e.g. pastrami sandwich, coleslaw"
                  value={input}
                  enterKeyHint="done"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      addItems(input)
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => addItems(input)}
                  aria-label="Add item"
                >
                  <IconPlus />
                </button>
              </div>

              {entry.items.length > 0 && (
                <div className="chipgroup">
                  {entry.items.map((item) => (
                    <span key={item} className="chip" aria-pressed="true">
                      {item}
                      <button
                        type="button"
                        onClick={() => removeItem(item)}
                        aria-label={`Remove ${item}`}
                        style={{ border: 0, background: 'none', padding: 0, display: 'flex' }}
                      >
                        <IconClose style={{ width: 14, height: 14 }} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div>
                <p className="section-label" style={{ marginBottom: 'var(--s2)' }}>
                  Quick add
                </p>
                <div className="chipgroup">
                  {recent.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="chip"
                      aria-pressed={entry.items.includes(item)}
                      onClick={() =>
                        entry.items.includes(item) ? removeItem(item) : addItems(item)
                      }
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Water" subtitle="Optional. Only here because it changes things.">
            <div className="stack stack--tight">
              <div className="btn-row">
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
                  onClick={() => patch({ waterOz: (entry.waterOz ?? 0) + 16 })}
                >
                  <IconDroplet />+ 16 oz
                </button>
              </div>
              {entry.waterOz !== null && (
                <p className="small">
                  <strong>{entry.waterOz} oz</strong> with this one.{' '}
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ padding: 0, minHeight: 'auto' }}
                    onClick={() => patch({ waterOz: null })}
                  >
                    Clear
                  </button>
                </p>
              )}
            </div>
          </Card>

          <details className="more" open={hasExtras}>
            <summary>
              Add more detail
              <span className="more__hint">optional</span>
            </summary>
            <div className="more__body">
              <div className="stack">
                <Segmented
                  label="Type"
                  options={MEAL_KINDS}
                  value={entry.mealKind}
                  onChange={(v) => patch({ mealKind: v })}
                />

                <fieldset className="fieldset">
                  <legend className="field__label">
                    Exposure tags
                  </legend>
                  <p className="field__hint" style={{ margin: '0 0 var(--s2)' }}>
                    {tagsTouched
                      ? 'You have edited these, so they will not change again on their own.'
                      : 'Filled in from what you entered. The patterns screen runs on these, so correct anything wrong.'}
                  </p>
                  <div className="chipgroup">
                    {FOOD_TAGS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="chip"
                        aria-pressed={entry.tags.includes(t.id)}
                        title={t.note}
                        onClick={() => toggleTag(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <Field label="Notes">
                  <textarea
                    className="textarea"
                    placeholder="Where you ate, how it was prepared, anything that sat out."
                    value={entry.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                  />
                </Field>

              <Field
                label="Time"
                id="food-time"
                value={<span className="muted small">{relativeTime(entry.ts)}</span>}
                hint="This timestamp is what makes the correlations work — it is worth getting roughly right."
              >
                <div className="input-row">
                  <input
                    id="food-time"
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
              </div>
            </div>
          </details>

          <button className="btn btn--primary btn--lg btn--block" onClick={handleSave} disabled={saving}>
            {saving && <Spinner />}
            {saving ? 'Saving' : 'Save meal'}
          </button>

          {existing && (
            <button
              className="btn btn--danger btn--block"
              onClick={async () => {
                if (!window.confirm('Delete this meal?')) return
                await removeFood(existing.id)
                toast('Meal deleted')
                goBack()
              }}
            >
              <IconTrash />
              Delete this meal
            </button>
          )}
        </div>
      </main>
    </>
  )
}
