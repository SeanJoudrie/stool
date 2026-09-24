/**
 * The Bristol Stool Form Scale, as a visual picker.
 *
 * Presented as diagrams rather than a numeric field for two reasons: almost
 * nobody recalls what "type 5" means, and matching a picture is far faster
 * than reading seven descriptions — which matters, because this is the field
 * that decides whether logging takes fifteen seconds or two minutes.
 *
 * The drawings are deliberately schematic, in the register of a clinical chart
 * rather than an illustration. Interior detail is cut with `fill-rule:
 * evenodd`, so the holes stay transparent on any background, selected or not.
 */
import { BRISTOL, type BristolType } from '../db/schema'

const DIAGRAM_PROPS = {
  viewBox: '0 0 64 40',
  fill: 'currentColor',
  'aria-hidden': true,
  focusable: false,
} as const

function Diagram({ type }: { type: BristolType }) {
  switch (type) {
    // 1 — separate hard lumps, like nuts.
    case 1:
      return (
        <svg {...DIAGRAM_PROPS} className="bristol__art">
          <circle cx="13" cy="20" r="5.4" />
          <circle cx="25.5" cy="19" r="5.8" />
          <circle cx="38" cy="21" r="5.2" />
          <circle cx="50.5" cy="19.5" r="5.6" />
        </svg>
      )
    // 2 — lumpy sausage: a fused row, so the lumps read as one mass.
    case 2:
      return (
        <svg {...DIAGRAM_PROPS} className="bristol__art">
          <circle cx="16" cy="20" r="8" />
          <circle cx="27" cy="19" r="8.4" />
          <circle cx="38" cy="21" r="8" />
          <circle cx="48.5" cy="19.5" r="7.6" />
        </svg>
      )
    // 3 — sausage with surface cracks.
    case 3:
      return (
        <svg {...DIAGRAM_PROPS} className="bristol__art">
          <path
            fillRule="evenodd"
            d="M16 12 H48 A8 8 0 0 1 48 28 H16 A8 8 0 0 1 16 12 Z
               M24.2 12.6 l2.3 0 l-2.1 14.8 l-2.3 0 Z
               M34.2 12.6 l2.3 0 l-2.1 14.8 l-2.3 0 Z
               M44.2 12.6 l2.3 0 l-2.1 14.8 l-2.3 0 Z"
          />
        </svg>
      )
    // 4 — smooth, soft, gently curved. The reference form.
    case 4:
      return (
        <svg {...DIAGRAM_PROPS} className="bristol__art">
          <path
            d="M11 25 C 22 13, 42 27, 53 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="15"
            strokeLinecap="round"
          />
        </svg>
      )
    // 5 — soft blobs with clear-cut edges.
    case 5:
      return (
        <svg {...DIAGRAM_PROPS} className="bristol__art">
          <ellipse cx="15" cy="21" rx="9" ry="7" />
          <ellipse cx="33" cy="18.5" rx="9.5" ry="7.4" />
          <ellipse cx="50.5" cy="21" rx="8.6" ry="6.8" />
        </svg>
      )
    // 6 — mushy, ragged edges: scattered rather than in a row.
    case 6:
      return (
        <svg {...DIAGRAM_PROPS} className="bristol__art">
          <circle cx="14" cy="18" r="6" />
          <circle cx="21" cy="24.5" r="6.6" />
          <circle cx="27.5" cy="15.5" r="5.4" />
          <circle cx="32" cy="21" r="7.4" />
          <circle cx="40" cy="25" r="6" />
          <circle cx="42.5" cy="17" r="6.6" />
          <circle cx="50" cy="21.5" r="6" />
        </svg>
      )
    // 7 — entirely liquid: a flat puddle with spatter.
    case 7:
      return (
        <svg {...DIAGRAM_PROPS} className="bristol__art">
          <path
            fillRule="evenodd"
            d="M9 25 C 9 20.5, 19 18, 32 18 C 45 18, 55 20.5, 55 25
               C 55 29.5, 45 32, 32 32 C 19 32, 9 29.5, 9 25 Z
               M19 24 C 23 22.6, 29 22.2, 34 23 L 33.4 25 C 28.6 24.2, 23 24.6, 19.4 25.8 Z"
          />
          <circle cx="16" cy="11.5" r="2.4" />
          <circle cx="30" cy="9" r="1.8" />
          <circle cx="44" cy="12" r="2.6" />
          <circle cx="53" cy="9.5" r="1.6" />
        </svg>
      )
  }
}

export function BristolPicker({
  value,
  onChange,
}: {
  value: BristolType | null
  onChange: (v: BristolType | null) => void
}) {
  const selected = value ? BRISTOL[value - 1] : null

  return (
    <fieldset className="field fieldset">
      <legend className="field__label">
        <span>Form</span>
        {value && <span className="field__value">Type {value}</span>}
      </legend>

      <div className="bristol">
        {BRISTOL.map((spec) => (
          <button
            key={spec.type}
            type="button"
            className="bristol__tile"
            data-band={spec.band}
            aria-pressed={value === spec.type}
            aria-label={`Type ${spec.type}: ${spec.name}. ${spec.description}`}
            onClick={() => onChange(value === spec.type ? null : spec.type)}
          >
            <Diagram type={spec.type} />
            <span className="bristol__num">{spec.type}</span>
          </button>
        ))}
      </div>

      <p className="field__hint" aria-live="polite">
        {selected ? (
          <>
            <strong style={{ color: 'var(--ink)' }}>
              Type {selected.type} · {selected.name}
            </strong>{' '}
            — {selected.description}
          </>
        ) : (
          'Tap the closest match. Types 3 to 5 are the normal range; 4 is the reference form.'
        )}
      </p>
    </fieldset>
  )
}
