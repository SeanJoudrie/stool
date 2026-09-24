# Design notes

## Register

The brief was explicit and correct: there is nothing funny about this. People
with real GI conditions are the users, and the output is meant to be handed to
a gastroenterologist. So the app reads as a record system — calm surfaces,
hairline rules, one restrained green accent, tabular figures, no illustration
and no joke anywhere, including in the icon. The word throughout the interface
is "stool": everybody knows it, and it is the tasteful one.

It has to work for someone elderly, mid-flare, one-handed, in a hurry. That
rules out density. Every screen is built on the assumption that the user wants
to leave it as fast as possible.

That register is also a usability decision. Someone showing this screen to a
doctor, or opening it on a bus, should not have to feel self-conscious about
what is on it.

## Type and layout

System sans throughout (`ui-sans-serif, system-ui, …`) — no display or serif
face. Mobile-first, 640px content column, 44px minimum touch target, safe-area
insets honoured for home-screen installs. Large standalone values use
proportional figures; `tabular-nums` is reserved for columns that must align
(table rows, axis ticks).

## Colour

UI accent and chart colours are **separate systems**. A series colour never
doubles as a button, and a status colour never doubles as a series.

### Interface

| Role | Light | Dark |
|---|---|---|
| Page plane | `#eef4ee` | `#0c1410` |
| Surface | `#ffffff` | `#14201a` |
| Primary ink | `#14261a` | `#e8f2ea` |
| Accent | `#2e7d4f` | `#5fc98a` |
| Accent edge | `#1f5c39` | `#7bd9a0` |
| Accent wash | `#dcefe1` | `#16341f` |

Secondary surfaces are a light green wash with a darker green edge; the one
primary action per screen is a solid green fill. White on `#2e7d4f` measures
5.05:1, and the dark-mode ink on `#5fc98a` measures 7.87:1.

Dark mode is a selected set, not an inverted one, and is declared under both
`prefers-color-scheme` and an explicit `[data-theme]` scope so a user's choice
beats the OS in both directions.

### Charts

The Bristol axis is a **diverging** scale, because the reader's question is
"how far from normal" and grey is the midpoint meaning *no deviation*:

| Band | Light | Dark |
|---|---|---|
| Hard (1–2) | `#eb6834` | `#d95926` |
| Normal (3–5) | `#898781` | `#93918a` |
| Loose (6–7) | `#2a78d6` | `#3987e5` |

Correlation bars are a **single hue** (`#4a3aa7` / `#9085e9`) — one series, and
magnitude is the whole story.

Status colours (`good #0ca30c`, `warning #fab219`, `serious #ec835a`,
`critical #d03b3b`) are reserved for red flags and always ship with an icon and
a worded label, never colour alone.

This palette was run through the computable checks against the real surfaces
(`#ffffff` and `#161d24`) rather than eyeballed. It passes the lightness band,
adjacent CVD separation, the normal-vision floor and contrast in both modes.
The one deliberate exception is the chroma floor, which the neutral midpoint
fails **by definition** — a diverging midpoint is supposed to read as grey.

An earlier attempt used a five-step scale with two steps per arm. It failed:
the two orange steps sat 12.1 ΔE apart under normal vision (floor is 15), and
in dark mode both extremes fell outside the lightness band, which is narrow
enough that two steps per arm do not fit. Collapsing to three clinical bands —
with the x-axis position carrying the exact type — passed every gate and reads
better besides.

## The rating scale

Ratings are shown as a coloured circle with **the number inside it**, at every
size, everywhere. That is not decoration. Red-to-green is the one scale
everybody reads instantly, and it is also the one that fails hardest for the
roughly one man in twelve with red-green colour blindness — so the digit
carries the value and the colour is a second channel that makes a bad month
visible from across the room.

Four reserved status steps rather than a generated ten-colour ramp:

| Rating | Meaning | Fill | Number |
|---|---|---|---|
| 1–3 | bad | `#d03b3b` | white |
| 4–5 | rough | `#ec835a` | `#3a1a0c` |
| 6–7 | okay | `#fab219` | `#3d2c00` |
| 8–10 | good | `#0ca30c` | `#05260b` |

The ink is picked per step, not globally: white clears 4.5:1 on the red but
measures only 2.64:1 on the amber and 3.35:1 on the green, so those two take
dark ink instead. A legend accompanies the scale wherever it is scanned in
bulk.

The brand green and the "good" green are deliberately different steps, so app
chrome never reads as a rating.

## Scope, and what got deleted

The first builds drifted. A daily check-in appeared with sleep, weight, stress,
fatigue, temperature, caffeine, travel, medications and a set of
service-specific fields, plus correlations built on all of them. Every piece
was individually defensible and the sum was a health dashboard.

It was cut back to one thing. A poop journal logs poops. Meals survive only
because they are the mechanism behind "dairy keeps showing up before your bad
ones". Water survives as ounces attached to a meal, because it is the one drink
that reliably moves stool and because that costs no screen, no target and no
streak.

The deletions had consequences and they were taken rather than worked around:
the fever, unintended-weight-loss and volume-depletion red flags went with the
data that fed them, and the sleep, stress, travel and drill-weekend
correlations went with theirs. What remains — blood, black or pale stool,
severe pain, prolonged and nocturnal diarrhoea, repeated bad episodes — all
comes from stool entries, which are the only thing the app can honestly claim
to know about.

The database went to v2 and drops the old `daily` store on upgrade. Existing
stool, food and photo records are untouched.

## Ordering, and what goes behind a disclosure

The first build put every field on one screen in clinical order. That is the
wrong order. Nobody takes their temperature on an ordinary day, and a
temperature field sitting above "what colour was it" is a field that costs
every user something and serves almost none of them.

So both entry forms now show only what most people will actually answer, and
everything else sits behind one **Add more detail** tap. The disclosure opens
automatically when an entry already has data in it, so editing never hides
what you previously wrote.

## Deliberate non-defaults

A pass was made specifically against the habits that make software look like it
was shipped in one sitting. Each of these was a real finding in this codebase,
not a hypothetical:

**No purple.** The correlation bars were `#4a3aa7`. Rather than swap in another
new hue, they now reuse the rating scale's red — those bars measure the share
of events that were *bad*, which is that scale's own meaning. Teal and a
neutral slate were both tried first and rejected: the slate failed the chroma
floor and collided with the grey "normal" band, and teal failed separation
against it (ΔE 12.5 light, 11.3 dark, against a floor of 15). Reusing red
removes a colour from the system instead of adding a sixth.

**Solid chrome.** The header and tab bar were translucent with a
`backdrop-filter` blur. They are now opaque. Blurred bars interact badly with
whatever scrolls under them and are one of the most recognisable tells there
is.

**Three radii and a pill.** There were five (6/10/14/20/999) plus a stray raw
`3px`. Now 8/12/16 on the same 4px rhythm as the spacing scale, plus the pill,
plus `50%` where something is actually a circle. A nested control derives its
inner radius from its track (`calc(var(--r-md) - 2px)`) so the curves stay
concentric rather than being guessed at.

**One font, one ramp, one shadow set.** A single `font-family` declaration in
the whole stylesheet. Elevation comes from three tokens and nothing else.

**One looping animation, and it is load-bearing.** The microphone ring is how
you know it is listening. It was an expanding glow; it is now a calm ring, and
the global reduced-motion rule stops it entirely.

**Real loading states.** One spinner, used everywhere. It takes the place of a
button's icon so the button holds its width instead of reflowing, and the first
paint shows the home screen's actual shape as a skeleton rather than a line of
text in the middle of an empty screen.

**A share card that is real type.** `public/og.png` is rendered from
`scripts/og-card.html` through headless Chromium, so the type is actual type
with actual kerning. The first attempt drew text with a hand-rolled 5x7 bitmap
font and looked exactly like the thing this section is about — pixelated,
overlapping, running off the card. It was thrown away.

**Spacing stays on the grid.** Every padding, margin and gap resolves to the
4px scale. The two exceptions are 1px hairlines and the 2px surface gap between
chart marks, both of which are specs rather than rhythm. A calendar cell that
was nudged by a magic `9px` now derives that offset from the dot size it has to
line up with.

## Responsiveness

Checked at 320, 390, 430 and 768px, on every screen, by measuring rather than
looking: any element extending past the viewport, any tap target under 24px,
any horizontal document scroll. Three real bugs came out of it.

The report's five-column tables forced the whole page to scroll sideways — up
to 218px at 320px wide. Wide tables now scroll inside their own container,
which is the fix; the page never does.

The "Now" button beside the timestamp field hung off the right edge at 320px,
because the input's `width: 100%` basis refuses to shrink in a flex row.
`.input-row` gives it `flex: 1; min-width: 0`.

The ten buttons of a 1–10 scale came out 23px wide at 320px, just under the
minimum target. Tightening the gutter below 360px buys back the 16px.

## Charts

Hand-rolled SVG. There are three chart forms in the whole app, and owning the
marks is what keeps them in the same register as everything else.

Marks follow a fixed spec: bars capped at 24px with a 4px rounded data end and
a square baseline, a 2px surface gap between stacked segments, hairline solid
gridlines (never dashed), hit targets that clear 24px even when the mark is
small, and values in ink tokens rather than the series colour. Every chart has
a legend where more than one colour class is in play, a hover/focus tooltip,
and a **table view** — the tooltip enhances, it never gates a value.

### The timeline, twice

The obvious form for "stool form over time" is a dot plot of Bristol type
against date. It was built, rendered, and was unreadable: at two events a day
over six weeks the dots overlap into a smear.

It was replaced with a column per day, stacked by band, hard at the bottom
through loose at the top so the stack mirrors the scale. It answers the
question people actually bring to that chart — "how have the last few weeks
gone" — and stays legible at any density the app can realistically produce.
Days with nothing logged render as gaps rather than being closed up.

### The chart hit surface

The day-by-day chart originally gave every column its own `<rect>` hit target.
At six weeks on a phone those were 8px wide — below any reasonable minimum —
and they also put thirty tab stops in the middle of the page, which is its own
kind of hostile.

It is now one focusable surface over the whole plot: the pointer picks the
nearest column, and the arrow keys walk it, with Home, End and Escape. The
chart also shows only as many days as can carry a 12px column, and both ends of
the axis are labelled so the shorter window is self-describing. The table view
underneath still holds every day.

Charts with a handful of genuinely discrete categories — the Bristol
distribution, the correlation bars — keep per-item targets, because seven or
eight stops for seven or eight things is correct. The distinction is by form,
not by accident.

### Two more bugs worth recording

The calendar cell was `aspect-ratio: 1` holding a day number, a 26px rating dot
and an `×N` count. The count overflowed the cell and collided with the day
number in the row beneath. Square cells were the assumption; the content needed
58px.

Separately, `.list__title` and `.list__meta` were sibling `<span>`s inside a
non-flex parent, so every row in every list rendered as
"Type 6 · MushyMushy, ragged edgespain 5/10" — the title running straight into
its own detail text. Both were invisible in code review and obvious in a
screenshot.

### A bug worth recording

The axis-tick helper could return a top tick *below* the data maximum (max 21
against a step of 6 stops at 18). Every bar was then drawn taller than the plot
and the tallest column's direct label was pushed off the top of the SVG. It is
the kind of fault that only appears at certain data values, which is exactly
why the charts were rendered and looked at rather than reasoned about.

## The entry form

The Bristol scale is a visual picker, not a numeric field. Almost nobody
recalls what "type 5" means, and matching a picture is far faster than reading
seven descriptions — which decides whether logging takes fifteen seconds or two
minutes. The drawings are schematic, in the register of a clinical chart;
interior detail is cut with `fill-rule: evenodd` so holes stay transparent on
any background, selected or not. A hairline band marker under each tile carries
the hard/normal/loose grouping, so the grouping never depends on the diagram
alone.

1–10 values are ten buttons, not a slider. A slider cannot be hit accurately
one-handed, and these are numbers a clinician will read.

## Photographs

Blurred by default behind a veil, revealed only by a deliberate tap, never
persisted as revealed, stripped of EXIF on the way in, and excluded from the
printed report. The design assumption is that the app will be opened in a room
with other people in it.
