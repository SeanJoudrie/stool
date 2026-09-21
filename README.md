# Stool — a GI journal

A stool and food journal for people managing digestive symptoms. It records
what happened and when, finds associations in your own data, and produces a
record you can hand to a gastroenterologist.

It is built around one observation: a GI appointment is short, and recall under
questioning is poor. "A few times a week, sometimes bad" is not something a
doctor can act on. A dated log with form, timing, pain and dietary exposure is.

**All data stays on the device.** There is no account, no server, and the app
makes no network requests at all after it loads.

---

## Running it

```bash
npm install
npm run dev        # development server
npm run build      # production bundle in dist/
npm run preview    # serve the production bundle
npm test           # unit tests
npm run typecheck  # tsc, no emit
npm run icons      # regenerate the PWA icon set from geometry
```

It is a PWA, so it installs to a phone home screen from the browser's share
sheet and then runs offline. That is the intended way to use it — see
[Why a PWA](#why-a-pwa).

## What it does

**Logging, in under twenty seconds.** The entry form is the whole ballgame: if
logging an event in a bathroom takes longer than that, it stops happening and
the record is worthless. So the timestamp is automatic, the Bristol scale is a
visual picker rather than a number field, every clinical value is one tap, the
overall rating pre-fills from what you entered, and nothing is required. A
partial entry saves fine and beats no entry.

**Or just say it.** "Had a really bad one this morning, basically water,
cramping like an eight" parses into Bristol type 7, pain 8/10, timed to 8 a.m.
It uses the Web Speech API where available and falls back to a text field that
the keyboard's own dictation key fills — same transcript, same parser, and on
iOS usually the more reliable path. The parse is always shown back in plain
words before anything is written, and the raw transcript is stored with the
entry so nothing is lost to a missed keyword.

**Food as exposure, not nutrition.** No calories, no macros, no portions. The
only question this log answers is what went in and when, because
*hours-since-eating* is what separates a two-hour intolerance response from a
twelve-to-twenty-four hour foodborne or inflammatory one. Items are auto-tagged
(dairy, high-fat, cured-meat, alcohol…) and the tags are editable.

**Correlation, with the brakes on.** See [the analysis](#the-analysis) below.

**Red flags.** Blood, black or tarry stool, prolonged diarrhoea, nocturnal
diarrhoea, fever above 101.5°F, volume-depletion signs and unintended weight
loss each raise a note explaining what that class of finding warrants. The app
states what it observed; it never names a condition, and it never tells anyone
they are fine.

**Fluid replacement.** Loose events are converted to an estimated loss and a
replacement target in ounces, scaled by body weight — because the same litre
costs a 130 lb person twice what it costs a 260 lb one, and impairment starts
around 2% of body weight. That is why an afternoon can vanish after a bad
morning.

**A report that prints.** Summary, flagged findings, form distribution, dietary
associations with raw counts, notable events, and the complete log — in the
order a clinician reads. "Print → Save as PDF" produces something you can email
or hand over. Photographs are never included.

## Privacy

This journal holds symptom records and photographs of them. The safest place
for that is the one place it cannot leak from, so:

- Everything lives in IndexedDB on the device. No account, no sync, no
  analytics, no telemetry, no third-party requests.
- Photographs are **blurred by default** and require a deliberate tap to
  reveal. The realistic place someone opens this app is a shared room, and
  nobody else in it consented to see this. Reveal state is never persisted.
- Images are re-encoded through a canvas before storage, which drops the EXIF
  block — where GPS coordinates and the capture device live.
- Export is a file you move yourself. An export *with* photographs is plain and
  unencrypted, and the UI says so at the point of use.

The trade is real and stated in the app: there is no backup but the one you
make, and clearing the browser's site data erases the journal.

## The analysis

For every stool event the log is scanned backwards over 2, 6, 12, 24 and 48
hour windows, recording which exposures were present. Each exposure is then
compared against the events where it was absent.

With a few weeks of data, twenty-odd candidate tags and five windows, noise
will happily manufacture a "correlation" for anything. So the engine:

- **ignores any event with no food logged in the preceding 24 hours** — an
  unlogged meal is *unknown* exposure, not absent exposure, and treating it as
  absent is precisely how a log invents a correlation;
- requires at least 6 events with the exposure and 6 without (8 for an
  individual item, since there are far more of them);
- **drops any exposure present in more than 80% of events** — "caffeine: 11/44
  poor versus 0/6" is not evidence about caffeine, it is six atypical days;
- requires a rate difference of at least 25 percentage points;
- reports the raw counts on both sides, always, so thin evidence looks thin;
- reports the window that best explains the association, which is itself the
  clinically interesting part;
- says "nothing stands out yet" as a real result rather than an empty state.

It is association, not causation, and the app says so on the screen. Nothing
here is adjusted for multiple comparisons. Treat any finding as a hypothesis to
test deliberately, or to hand to a doctor.

## Architecture

```
src/
  db/schema.ts      the record shape — every field earns its place
  db/db.ts          IndexedDB, export/import/wipe
  lib/parse.ts      speech → structured entry (rule-based, offline)
  lib/foodTags.ts   keyword dictionary for exposure tagging
  lib/analysis.ts   the correlation engine and its evidence gates
  lib/redflags.ts   findings that change what happens next
  lib/hydration.ts  fluid loss and replacement
  lib/image.ts      downscale + EXIF-stripping re-encode
  components/       UI primitives, Bristol picker, hand-rolled SVG charts
  screens/          Today, Voice, entry forms, Insights, Report, Settings
  store.tsx         whole journal in memory, mirrored to IndexedDB on write
```

The journal is held in memory and written through to IndexedDB. At this scale —
a few years of diligent logging is a few thousand small records — that is
defensible, and it makes the analysis pass, which needs every event at once,
trivial rather than a query-planning exercise.

Dependencies are React, Vite and `vite-plugin-pwa`. Routing, charts, state and
the icon set are all in-repo; see [docs/DESIGN.md](docs/DESIGN.md) for why the
charts are hand-rolled and how the palette was validated.

### Why a PWA

You log in a bathroom, so this wants to be on a phone. A PWA installs to the
home screen, runs offline, and keeps the data on-device with no store review
and no build pipeline per platform. If it ever needs true native (background
reminders, HealthKit), the whole UI wraps in Capacitor without a rewrite,
because nothing here assumes a browser beyond the storage layer.

## Testing

`npm test` covers the parser, the analysis gates, the red-flag rules and the
hydration maths — 37 tests, including planted-signal cases that assert the
engine both finds a real association and refuses a manufactured one.

The interactive flows (manual entry, speech parse → confirm → save, food
auto-tagging, photo blur-by-default, export shape, and the no-outbound-requests
guarantee) were verified by driving the built app in a real browser.

## Not a medical device

This is a self-tracking tool. It cannot diagnose anything and does not try to.
If something in it worries you, that is a reason to see a doctor.
