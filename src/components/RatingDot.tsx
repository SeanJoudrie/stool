/**
 * A rating, as a coloured circle with the number inside it.
 *
 * The number is always drawn, at every size. Red-green colour blindness is
 * common enough — roughly one man in twelve — that a red-to-green scale cannot
 * be the only channel, and this scale is going to be scanned down a calendar
 * by people who may also be elderly. Colour makes a bad week visible at a
 * glance; the digit is what actually carries the value.
 *
 * Ink is chosen per step rather than globally, because white clears 4.5:1 on
 * the red but not on the amber or the green.
 */
export type RatingTier = 'bad' | 'poor' | 'ok' | 'good' | 'none'

export function ratingTier(rating: number | null): RatingTier {
  if (rating === null) return 'none'
  if (rating <= 3) return 'bad'
  if (rating <= 5) return 'poor'
  if (rating <= 7) return 'ok'
  return 'good'
}

export const TIER_LABEL: Record<RatingTier, string> = {
  bad: 'Bad',
  poor: 'Rough',
  ok: 'Okay',
  good: 'Good',
  none: 'Not rated',
}

export function RatingDot({
  rating,
  size = 'md',
}: {
  rating: number | null
  size?: 'sm' | 'md' | 'lg'
}) {
  const tier = ratingTier(rating)
  return (
    <span
      className={`rating-dot rating-dot--${size}`}
      data-tier={tier}
      aria-label={rating === null ? 'Not rated' : `Rated ${rating} out of 10, ${TIER_LABEL[tier].toLowerCase()}`}
    >
      {rating ?? '·'}
    </span>
  )
}

/** The legend that has to accompany the scale wherever it is scanned in bulk. */
export function RatingLegend() {
  const tiers: { tier: RatingTier; label: string }[] = [
    { tier: 'bad', label: '1–3 bad' },
    { tier: 'poor', label: '4–5 rough' },
    { tier: 'ok', label: '6–7 okay' },
    { tier: 'good', label: '8–10 good' },
  ]
  return (
    <ul className="viz__legend">
      {tiers.map(({ tier, label }) => (
        <li key={tier}>
          <span className="swatch" data-tier={tier} style={{ background: `var(--rate-${tier})` }} />
          {label}
        </li>
      ))}
    </ul>
  )
}
