import type { ReactNode } from 'react'
import { IconAlert, IconBack, IconCheck, IconCheckCircle, IconInfo } from './icons'
import { goBack } from '../router'

// ------------------------------------------------------------------ shell ---

export function AppBar({
  title,
  subtitle,
  back,
  action,
}: {
  title: string
  subtitle?: string
  back?: boolean
  action?: ReactNode
}) {
  return (
    <header className="appbar">
      {back && (
        <button className="appbar__action" onClick={() => goBack()} aria-label="Back">
          <IconBack style={{ width: 22, height: 22 }} />
        </button>
      )}
      <h1 className="appbar__title">
        {subtitle && <span className="appbar__sub">{subtitle}</span>}
        {title}
      </h1>
      {action}
    </header>
  )
}

export function Card({
  title,
  subtitle,
  action,
  children,
  footer,
}: {
  title?: string
  subtitle?: string
  action?: ReactNode
  children?: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="card">
      {title && (
        <div className="card__head">
          <h2 className="card__title">{title}</h2>
          {action}
        </div>
      )}
      {subtitle && <p className="card__sub">{subtitle}</p>}
      {children && <div className="card__body">{children}</div>}
      {footer && <div className="card__foot">{footer}</div>}
    </section>
  )
}

// ----------------------------------------------------------------- alerts ---

export type AlertTone = 'info' | 'good' | 'warning' | 'serious' | 'critical'

/**
 * Status colour never carries meaning alone here — every alert ships with an
 * icon and a worded title, which is also what makes the sub-3:1 warning and
 * serious steps legitimate on the light surface.
 */
export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: AlertTone
  title?: string
  children: ReactNode
}) {
  const Icon = tone === 'good' ? IconCheckCircle : tone === 'info' ? IconInfo : IconAlert
  return (
    <div className={`alert alert--${tone}`} role={tone === 'critical' ? 'alert' : undefined}>
      <Icon style={{ color: `var(--status-${tone === 'info' ? 'good' : tone === 'good' ? 'good' : tone})` }} />
      <div>
        {title && <strong className="alert__title">{title}</strong>}
        {children}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ input ---

export function Field({
  label,
  hint,
  value,
  children,
  id,
}: {
  label: string
  hint?: string
  value?: ReactNode
  children: ReactNode
  id?: string
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        <span>{label}</span>
        {value !== undefined && value !== null && <span className="field__value">{value}</span>}
      </label>
      {children}
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  )
}

/**
 * A 1–10 scale as ten buttons rather than a slider. A slider cannot be hit
 * accurately one-handed, and these are values a clinician will read.
 */
export function Scale({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
  hint,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  lowLabel: string
  highLabel: string
  hint?: string
}) {
  return (
    <fieldset className="field" style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className="field__label" style={{ width: '100%', padding: 0 }}>
        <span>{label}</span>
        {value !== null && <span className="field__value">{value}/10</span>}
      </legend>
      <div className="scale">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className="scale__step"
            aria-pressed={value === n}
            aria-label={`${label}: ${n} out of 10`}
            onClick={() => onChange(value === n ? null : n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="scale__ends">
        <span>1 · {lowLabel}</span>
        <span>10 · {highLabel}</span>
      </div>
      {hint && <p className="field__hint">{hint}</p>}
    </fieldset>
  )
}

export function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
  hint,
  alertIds,
}: {
  label: string
  options: readonly { id: T; label: string; note?: string }[]
  selected: readonly T[]
  onToggle: (id: T) => void
  hint?: string
  alertIds?: readonly T[]
}) {
  return (
    <fieldset className="field" style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className="field__label" style={{ width: '100%', padding: 0 }}>
        {label}
      </legend>
      <div className="chipgroup">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`chip${alertIds?.includes(o.id) ? ' chip--alert' : ''}`}
            aria-pressed={selected.includes(o.id)}
            title={o.note}
            onClick={() => onToggle(o.id)}
          >
            <IconCheck className="chip__check" />
            {o.label}
          </button>
        ))}
      </div>
      {hint && <p className="field__hint">{hint}</p>}
    </fieldset>
  )
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string
  options: readonly { id: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <div className="field">
      {label && <span className="field__label">{label}</span>}
      <div className="segmented" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className="segmented__item"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="switchrow">
      <span className="switchrow__text">
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{label}</span>
        {hint && <span className="field__hint" style={{ display: 'block' }}>{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        className="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      />
    </div>
  )
}

export function NumberField({
  label,
  hint,
  value,
  onChange,
  suffix,
  step = 1,
  min = 0,
  max,
  placeholder,
}: {
  label: string
  hint?: string
  value: number | null
  onChange: (v: number | null) => void
  suffix?: string
  step?: number
  min?: number
  max?: number
  placeholder?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
        {suffix && <span className="muted small" style={{ flex: 'none' }}>{suffix}</span>}
      </div>
    </Field>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}
