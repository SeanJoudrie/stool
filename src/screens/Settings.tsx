/**
 * Settings, and everything to do with the data itself.
 *
 * The privacy position is not a toggle buried in here — it is the
 * architecture. There is no account, no server and no analytics. Export exists
 * so the record is portable and the user is never locked in; import exists so
 * a device can be replaced. Both move a file the user controls.
 */
import { useEffect, useState } from 'react'
import type { ThemePref } from '../db/schema'
import { useStore } from '../store'
import * as db from '../db/db'
import { buildSeedEpisode } from '../lib/seed'
import { formatBytes } from '../lib/image'
import { AppBar, Alert, Card, NumberField, Segmented, SwitchRow } from '../components/ui'
import { IconDownload, IconLock, IconTrash, IconUpload } from '../components/icons'

const THEMES: { id: ThemePref; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

export function Settings() {
  const { settings, saveSettings, stool, food, daily, reload, toast } = useStore()
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void db.estimateUsage().then(setUsage)
  }, [stool.length, food.length, daily.length])

  async function handleExport(includePhotos: boolean) {
    setBusy(true)
    try {
      const bundle = await db.exportAll(includePhotos)
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stool-journal-${new Date().toISOString().slice(0, 10)}${includePhotos ? '-with-photos' : ''}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      toast('Export downloaded')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport(file: File) {
    setBusy(true)
    try {
      const result = await db.importAll(JSON.parse(await file.text()))
      await reload()
      toast(`Imported ${result.stool} events, ${result.food} meals, ${result.daily} days`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That file could not be imported')
    } finally {
      setBusy(false)
    }
  }

  async function handleSeed() {
    const ok = window.confirm(
      'Add the 20–21 September episode?\n\nThis is reconstructed from notes written afterwards. The clock times are estimates — open each entry and correct them to what you actually remember.',
    )
    if (!ok) return
    setBusy(true)
    try {
      const seed = buildSeedEpisode()
      for (const e of seed.stool) await db.putStool(e)
      for (const e of seed.food) await db.putFood(e)
      for (const e of seed.daily) await db.putDaily(e)
      await reload()
      toast('Episode added — check the times')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add the episode')
    } finally {
      setBusy(false)
    }
  }

  async function handleWipe() {
    const ok = window.confirm(
      'Delete everything?\n\nEvery entry and every photograph will be permanently erased from this device. There is no copy anywhere else, so this cannot be undone. Export first if you want to keep it.',
    )
    if (!ok) return
    if (window.prompt('Type DELETE to confirm.') !== 'DELETE') {
      toast('Nothing was deleted')
      return
    }
    setBusy(true)
    try {
      await db.wipeAll()
      await reload()
      toast('All data deleted')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AppBar title="Settings" />
      <main className="main">
        <div className="stack">
          <Card title="You">
            <div className="stack">
              <NumberField
                label="Body weight"
                hint="Used to turn fluid loss into a replacement target. Fluid loss hits a smaller body proportionally harder."
                value={settings.bodyWeightLb}
                onChange={(v) => void saveSettings({ bodyWeightLb: v })}
                suffix="lb"
                step={1}
                placeholder="130"
              />
              <NumberField
                label="Daily water target"
                value={settings.waterTargetOz}
                onChange={(v) => void saveSettings({ waterTargetOz: v ?? 100 })}
                suffix="oz"
                step={8}
              />
              <SwitchRow
                label="Show service fields"
                hint="Adds drill weekend, field food and ruck/run to the daily check-in."
                checked={settings.guardFields}
                onChange={(v) => void saveSettings({ guardFields: v })}
              />
            </div>
          </Card>

          <Card title="Appearance">
            <Segmented
              options={THEMES}
              value={settings.theme}
              onChange={(v) => void saveSettings({ theme: v })}
            />
          </Card>

          <Card title="Privacy">
            <div className="stack">
              <SwitchRow
                label="Allow photographs"
                hint="Photographs are stored on this device only, blurred until tapped, and location data is stripped before saving."
                checked={settings.photosEnabled}
                onChange={(v) => void saveSettings({ photosEnabled: v })}
              />
              <SwitchRow
                label="Show red-flag notes"
                hint="Points out findings — blood, prolonged diarrhoea, unintended weight loss — that are worth a doctor's attention."
                checked={settings.redFlagAlerts}
                onChange={(v) => void saveSettings({ redFlagAlerts: v })}
              />
              <Alert tone="info" title="Where your data lives">
                Everything is stored in this browser on this device. There is no account, no server
                and nothing is uploaded — this app makes no network requests at all after it loads.
                That also means there is no backup but the one you export yourself, and clearing
                this browser's site data erases the journal.
              </Alert>
            </div>
          </Card>

          <Card
            title="Your data"
            subtitle={
              usage
                ? `${stool.length} events, ${food.length} meals, ${daily.length} check-ins — using ${formatBytes(usage.usage)}.`
                : `${stool.length} events, ${food.length} meals, ${daily.length} check-ins.`
            }
          >
            <div className="stack stack--tight">
              <button
                className="btn btn--secondary btn--block"
                onClick={() => handleExport(false)}
                disabled={busy}
              >
                <IconDownload />
                Export entries
              </button>
              <button
                className="btn btn--secondary btn--block"
                onClick={() => handleExport(true)}
                disabled={busy}
              >
                <IconDownload />
                Export entries and photographs
              </button>
              <p className="field__hint">
                <IconLock style={{ width: 12, height: 12, verticalAlign: '-1px' }} /> An export with
                photographs is a plain, unencrypted file. Once it leaves this app you are
                responsible for where it goes — do not email it to yourself or drop it in a shared
                folder.
              </p>

              <label className="btn btn--secondary btn--block" style={{ cursor: 'pointer' }}>
                <IconUpload />
                Import a previous export
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleImport(file)
                    e.target.value = ''
                  }}
                />
              </label>
              <p className="field__hint">
                Merges by entry, so importing the same file twice will not duplicate anything.
              </p>
            </div>
          </Card>

          <Card
            title="Starter data"
            subtitle="The 20–21 September 2026 episode, reconstructed from notes. An outlier teaches more than a baseline — but only once there is a baseline to compare it against."
          >
            <button className="btn btn--secondary btn--block" onClick={handleSeed} disabled={busy}>
              Add that episode to the journal
            </button>
          </Card>

          <Card title="Danger zone">
            <button className="btn btn--danger btn--block" onClick={handleWipe} disabled={busy}>
              <IconTrash />
              Delete everything on this device
            </button>
          </Card>

          <Card title="About">
            <div className="stack stack--tight">
              <p className="small">
                A stool and food journal for people managing GI symptoms. It records what happened
                and when, finds associations in your own data, and produces a record you can hand to
                a gastroenterologist.
              </p>
              <p className="small muted">
                It is not a medical device and cannot diagnose anything. If something in here worries
                you, that is a reason to see a doctor, not to read further into the app.
              </p>
            </div>
          </Card>
        </div>
      </main>
    </>
  )
}
