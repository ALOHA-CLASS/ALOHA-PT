import { useState, type ReactNode } from 'react'
import { Ban } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b px-3 py-3 last:border-b-0">
      <div className="mb-2 flex h-6 items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-7 items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
    </div>
  )
}

const fieldClass =
  'flex h-7 min-w-0 flex-1 items-center rounded-md border border-input bg-background px-1.5 text-xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30'

interface NumberFieldProps {
  value: number
  onChange(value: number): void
  ariaLabel: string
  prefix?: string
  suffix?: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}

/** 숫자 입력. 유효한 값이 입력되는 즉시 반영하고, 포커스를 잃으면 실제 값으로 표시를 되돌립니다. */
export function NumberField({ value, onChange, ariaLabel, prefix, suffix, min, max, step = 1, disabled }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? String(Math.round(value * 100) / 100)

  return (
    <label className={cn(fieldClass, disabled && 'opacity-50')}>
      {prefix && <span className="mr-1 text-muted-foreground select-none">{prefix}</span>}
      <input
        type="number"
        aria-label={ariaLabel}
        className="number-field w-full min-w-0 bg-transparent tabular-nums outline-none"
        value={display}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const text = event.target.value
          setDraft(text)
          const parsed = Number(text)
          if (text.trim() === '' || !Number.isFinite(parsed)) return
          onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed)))
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      {suffix && <span className="ml-1 text-muted-foreground select-none">{suffix}</span>}
    </label>
  )
}

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

function toFullHex(value: string | undefined): string | null {
  if (!value || !HEX_PATTERN.test(value)) return null
  if (value.length === 7) return value.toLowerCase()
  const [, r, g, b] = value
  return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
}

interface ColorFieldProps {
  /** undefined 또는 'transparent'는 색 없음으로 표시합니다. */
  value: string | undefined
  onChange(value: string): void
  ariaLabel: string
  /** 지정하면 "색 없음" 버튼을 보여 줍니다. */
  onClear?(): void
}

export function ColorField({ value, onChange, ariaLabel, onClear }: ColorFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const empty = value === undefined || value === 'transparent' || value === 'none'
  const hex = toFullHex(value)

  return (
    <>
      <label
        className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-input"
        style={{
          background: empty
            ? 'repeating-conic-gradient(#E5E7EB 0% 25%, #FFFFFF 0% 50%) 50% / 10px 10px'
            : value,
        }}
      >
        <input
          type="color"
          aria-label={ariaLabel}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          value={hex ?? '#ffffff'}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
      </label>
      <label className={fieldClass}>
        <input
          aria-label={`${ariaLabel} 값`}
          className="w-full min-w-0 bg-transparent font-mono uppercase outline-none placeholder:normal-case"
          value={draft ?? (empty ? '' : value)}
          placeholder="없음"
          spellCheck={false}
          onChange={(event) => {
            const text = event.target.value.trim()
            setDraft(event.target.value)
            if (HEX_PATTERN.test(text)) onChange(text.toUpperCase())
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </label>
      {onClear && (
        <IconToggle label="색 없음" pressed={empty} onClick={onClear}>
          <Ban />
        </IconToggle>
      )}
    </>
  )
}

interface SelectFieldProps<T extends string> {
  value: T
  options: readonly { value: T; label: string }[]
  onChange(value: T): void
  ariaLabel: string
}

export function SelectField<T extends string>({ value, options, onChange, ariaLabel }: SelectFieldProps<T>) {
  return (
    <select
      aria-label={ariaLabel}
      className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

interface IconToggleProps {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick(): void
  children: ReactNode
}

/** 아이콘만 있는 작은 버튼. pressed를 주면 토글 상태를 표시합니다. */
export function IconToggle({ label, pressed, disabled, onClick, children }: IconToggleProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-md border border-transparent text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5',
        pressed && 'border-input bg-muted',
      )}
    >
      {children}
    </button>
  )
}

export function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange(checked: boolean): void }) {
  return (
    <label className="flex min-h-7 cursor-pointer items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="checkbox"
        className="size-3.5 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}
