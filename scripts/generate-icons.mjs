/**
 * Generates the PWA icon set from geometry — no image libraries, no binary
 * assets checked in by hand. Run with `npm run icons` after changing the marks
 * below. Supersamples 4x and box-filters down, which is enough antialiasing for
 * a mark made of rounded rectangles.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const NAVY = [0x0f, 0x27, 0x33]
const WHITE = [0xff, 0xff, 0xff]
const TEAL = [0x4f, 0xc3, 0xcb]

const SS = 4 // supersample factor

/** Signed "is inside" test for a rounded rectangle. */
function inRoundRect(px, py, x, y, w, h, r) {
  if (px < x || py < y || px > x + w || py > y + h) return false
  const cx = Math.min(Math.max(px, x + r), x + w - r)
  const cy = Math.min(Math.max(py, y + r), y + h - r)
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= r * r
}

/**
 * The mark: three columns of rising height on a common baseline — the stool
 * distribution chart the app is built around. Deliberately clinical; there is
 * no joke in the icon.
 *
 * `inset` is the fraction of the canvas the mark is allowed to occupy, which is
 * what makes the maskable variant safe (Android crops to a circle).
 */
function drawIcon(size, { maskable = false } = {}) {
  const w = size * SS
  const rgb = new Uint8Array(w * w * 3)

  const bgRadius = maskable ? 0 : w * 0.2237 // iOS/Android squircle-ish
  const markScale = maskable ? 0.56 : 0.72
  const markW = w * markScale
  const markX = (w - markW) / 2
  const markH = w * markScale * 0.78
  const markY = (w - markH) / 2

  const gap = markW * 0.13
  const barW = (markW - gap * 2) / 3
  const barR = barW * 0.28
  const baseH = markH * 0.11
  const baseY = markY + markH - baseH
  const baseR = baseH / 2

  // Column heights read low → high: the eye resolves a rising chart even at 48px.
  const heights = [0.42, 1.0, 0.68]
  const colors = [WHITE, TEAL, WHITE]

  const bars = heights.map((f, i) => {
    const bodyH = (markH - baseH - markH * 0.08) * f
    return {
      x: markX + i * (barW + gap),
      y: baseY - markH * 0.08 - bodyH,
      w: barW,
      h: bodyH,
      color: colors[i],
    }
  })

  for (let py = 0; py < w; py++) {
    for (let px = 0; px < w; px++) {
      let color = null
      const cx = px + 0.5
      const cy = py + 0.5
      if (maskable || inRoundRect(cx, cy, 0, 0, w, w, bgRadius)) {
        color = NAVY
        for (const b of bars) {
          if (inRoundRect(cx, cy, b.x, b.y, b.w, b.h, barR)) color = b.color
        }
        if (inRoundRect(cx, cy, markX, baseY, markW, baseH, baseR)) color = WHITE
      }
      const o = (py * w + px) * 3
      if (color) {
        rgb[o] = color[0]
        rgb[o + 1] = color[1]
        rgb[o + 2] = color[2]
      }
    }
  }

  // Box-filter down to the target size, compositing onto transparency.
  const out = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const o = ((y * SS + sy) * w + (x * SS + sx)) * 3
          const isSet = rgb[o] || rgb[o + 1] || rgb[o + 2]
          if (isSet) {
            r += rgb[o]; g += rgb[o + 1]; b += rgb[o + 2]; a += 255
          }
        }
      }
      const n = SS * SS
      const o = (y * size + x) * 4
      const cov = a / n / 255
      // Premultiplied average of covered samples keeps edges from darkening.
      out[o] = cov > 0 ? Math.round(r / n / cov) : 0
      out[o + 1] = cov > 0 ? Math.round(g / n / cov) : 0
      out[o + 2] = cov > 0 ? Math.round(b / n / cov) : 0
      out[o + 3] = Math.round(a / n)
    }
  }
  return out
}

// -- minimal PNG encoder -------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // Filter type 0 per scanline; the mark is flat colour, so deflate does the work.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** ICO wrapping a single PNG — every browser that still reads .ico accepts this. */
function encodeIco(png, size) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry[0] = size >= 256 ? 0 : size
  entry[1] = size >= 256 ? 0 : size
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(22, 12)
  return Buffer.concat([header, entry, png])
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Stool">
  <rect width="512" height="512" rx="114.5" fill="#0f2733"/>
  <g>
    <rect x="71.7" y="252.4" width="98.3" height="111.6" rx="27.5" fill="#ffffff"/>
    <rect x="206.9" y="120.0" width="98.3" height="244.0" rx="27.5" fill="#4fc3cb"/>
    <rect x="342.1" y="197.5" width="98.3" height="166.5" rx="27.5" fill="#ffffff"/>
    <rect x="71.7" y="384.0" width="368.6" height="43.9" rx="21.9" fill="#ffffff"/>
  </g>
</svg>
`

mkdirSync(OUT, { recursive: true })
for (const [name, size, opts] of [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: true }],
]) {
  writeFileSync(join(OUT, name), encodePng(drawIcon(size, opts), size))
}
writeFileSync(join(OUT, 'favicon.ico'), encodeIco(encodePng(drawIcon(32), 32), 32))
writeFileSync(join(OUT, 'icon.svg'), SVG)
console.log('icons written to public/')
