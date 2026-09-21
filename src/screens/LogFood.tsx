/**
 * Food entry.
 *
 * Explicitly not a nutrition tracker. There are no calories, no macros and no
 * portion sizes, because none of them help answer the only question this log
 * exists to answer: what went in, and when. Adding them would make the entry
 * slow enough that it stops happening, and an unlogged meal breaks every
 * correlation downstream.
 */
import { useMemo, useState } from 'react'
import { FOOD_TAGS, type FoodEntry, type FoodTag, type MealKind } from '../db/schema'
import { COMMON_FOODS, autoTagItems, splitItems } from '../lib/foodTags'
import { blankFood, useStore } from '../store'
import { fromLocalInput, relativeTime, toLocalInput } from '../lib/time'
import { goBack, navigate } from '../router'
import { AppBar, Card, Field, Segmented } from '../components/ui'
import { IconClock, IconClose, IconPlus, IconTrash } from '../components/icons'

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
    if (items.length === 0) {
      toast('Add at least one item first')
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
          <Card>
            <div className="stack">
              <Field
                label="Time"
                id="food-time"
                value={<span className="muted small">{relativeTime(entry.ts)}</span>}
                hint="This timestamp is what makes the correlations work — it is worth getting roughly right."
              >
                <div style={{ display: 'flex', gap: 'var(--s2)' }}>
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

              <Segmented
                label="Type"
                options={MEAL_KINDS}
                value={entry.mealKind}
                onChange={(v) => patch({ mealKind: v })}
              />
            </div>
          </Card>

          <Card title="What you ate">
            <div className="stack">
              <div style={{ display: 'flex', gap: 'var(--s2)' }}>
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

          <Card
            title="Exposure tags"
            subtitle={
              tagsTouched
                ? 'You have edited these, so they will not change again on their own.'
                : 'Filled in from what you entered. Correlations run on these, so correct anything wrong.'
            }
          >
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
          </Card>

          <Card title="Notes">
            <textarea
              className="textarea"
              placeholder="Where you ate, how it was prepared, anything that sat out."
              value={entry.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </Card>

          <button className="btn btn--primary btn--lg btn--block" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save meal'}
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
