# Design notes

## Register

The brief was explicit and correct: there is nothing funny about this. People
with real GI conditions are the users, and the output is meant to be handed to
a gastroenterologist. So the app reads as a clinical record system — cool
neutral surfaces, hairline rules, one restrained teal accent, tabular figures,
no illustration and no joke anywhere, including in the icon. The word
throughout the interface is "stool".

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
| Page plane | `#eef2f5` | `#0b1016` |
| Surface | `#ffffff` | `#161d24` |
| Primary ink | `#0f1f2a` | `#eef4f8` |
| Accent | `#0e7c86` | `#3fb5bd` |

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
