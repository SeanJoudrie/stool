/**
 * Renders scripts/og-card.html to public/og.png at 1200x630.
 *
 * Needs a Chromium to render with. It is not a dependency of the app, so this
 * script finds one rather than dragging a browser into the install: set
 * CHROMIUM to a binary, or have a system Chrome present.
 *
 * Headless Chromium exits non-zero even when it has written a perfectly good
 * screenshot, so success is judged by inspecting the PNG it produced — the
 * header has to say 1200x630 — rather than by the exit code.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'og.png')
const WIDTH = 1200
const HEIGHT = 630

const chrome = [
  process.env.CHROMIUM,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]
  .filter(Boolean)
  .find((c) => existsSync(c))

if (!chrome) {
  console.error(
    'No Chromium found. Set CHROMIUM=/path/to/chrome and re-run.\n' +
      'The committed public/og.png stays valid until the card changes.',
  )
  process.exit(1)
}

const before = existsSync(out) ? statSync(out).mtimeMs : 0

try {
  execFileSync(
    chrome,
    [
      '--headless',
      '--disable-gpu',
      // Required when running as root in a container.
      '--no-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${WIDTH},${HEIGHT}`,
      `--screenshot=${out}`,
      join(root, 'scripts', 'og-card.html'),
    ],
    { stdio: 'ignore' },
  )
} catch {
  // Judged on the artifact below, not on this.
}

if (!existsSync(out) || statSync(out).mtimeMs <= before) {
  console.error('Chromium did not write public/og.png.')
  process.exit(1)
}

const png = readFileSync(out)
const isPng = png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
const w = png.readUInt32BE(16)
const h = png.readUInt32BE(20)

if (!isPng || w !== WIDTH || h !== HEIGHT) {
  console.error(`public/og.png is wrong: png=${isPng} ${w}x${h}, expected ${WIDTH}x${HEIGHT}.`)
  process.exit(1)
}

console.log(`public/og.png rendered — ${w}x${h}, ${(png.length / 1024).toFixed(0)} KB`)
