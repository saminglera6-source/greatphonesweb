'use client'

import { useId } from 'react'
import {
  formatMilesInput,
  formatUsdInput,
  formatIntInput,
  maskCuil,
  isCuilValid,
  cuilDigits,
  maskImei,
  isImeiValid,
  imeiDigits,
  maskTelefono,
  isTelefonoValid,
} from '@/lib/formato'

/**
 * Inputs de captura con formato en vivo. Todos guardan un STRING ya formateado
 * en el estado del formulario; al enviar, el form parsea con las funciones de
 * `@/lib/formato` (parseMiles / parseUsd / parseIntSafe / cuilDigits / imeiDigits).
 */

type Base = {
  value: string
  onChange: (v: string) => void
  className?: string
  style?: React.CSSProperties
  id?: string
  placeholder?: string
  disabled?: boolean
  onBlur?: () => void
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

function baseInput(p: Base, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>>) {
  return {
    className: p.className,
    style: p.style,
    id: p.id,
    placeholder: p.placeholder,
    disabled: p.disabled,
    onBlur: p.onBlur,
    'aria-label': p['aria-label'],
    'aria-invalid': p['aria-invalid'],
    'aria-describedby': p['aria-describedby'],
    autoComplete: 'off',
    ...extra,
  }
}

/** Pesos enteros — separador de miles en vivo. */
export function MoneyInput(p: Base) {
  return (
    <input
      {...baseInput(p, {
        inputMode: 'numeric',
        value: p.value,
        onChange: e => p.onChange(formatMilesInput(e.target.value)),
      })}
    />
  )
}

/** Dólares — miles con punto, decimales con coma (máx 2). */
export function UsdInput(p: Base) {
  return (
    <input
      {...baseInput(p, {
        inputMode: 'decimal',
        value: p.value,
        onChange: e => p.onChange(formatUsdInput(e.target.value)),
      })}
    />
  )
}

/** Entero simple (cuotas, cantidad). */
export function IntInput(p: Base & { max?: number; min?: number }) {
  return (
    <input
      {...baseInput(p, {
        inputMode: 'numeric',
        value: p.value,
        onChange: e => p.onChange(formatIntInput(e.target.value, { max: p.max })),
      })}
    />
  )
}

/** Porcentaje 0–100. */
export function PctInput(p: Base) {
  return (
    <input
      {...baseInput(p, {
        inputMode: 'numeric',
        value: p.value,
        onChange: e => p.onChange(formatIntInput(e.target.value, { max: 100 })),
      })}
    />
  )
}

/** CUIT / CUIL — pone los guiones al tipear y valida el dígito verificador. */
export function CuilInput(p: Base & { showCheck?: boolean }) {
  const uid = useId()
  const d = cuilDigits(p.value)
  const estado = d.length === 0 ? 'vacio' : isCuilValid(d) ? 'ok' : d.length === 11 ? 'mal' : 'incompleto'
  return (
    <span style={{ position: 'relative', display: 'block' }}>
      <input
        {...baseInput(p, {
          inputMode: 'numeric',
          value: maskCuil(p.value),
          placeholder: p.placeholder ?? '20-42908945-0',
          onChange: e => p.onChange(maskCuil(e.target.value)),
          'aria-describedby': `${p.id || uid}-cuil-hint`,
          maxLength: 13,
        })}
      />
      {p.showCheck !== false && estado !== 'vacio' && (
        <span
          id={`${p.id || uid}-cuil-hint`}
          aria-live="polite"
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 12,
            fontWeight: 700,
            pointerEvents: 'none',
            color: estado === 'ok' ? '#0F9D58' : estado === 'mal' ? '#DC2626' : '#94A3B8',
          }}
        >
          {estado === 'ok' ? '✓' : estado === 'mal' ? 'dígito ✗' : `${d.length}/11`}
        </span>
      )}
    </span>
  )
}

/** IMEI — 15 dígitos, contador y validación Luhn. */
export function ImeiInput(p: Base & { showCheck?: boolean }) {
  const uid = useId()
  const d = imeiDigits(p.value)
  const estado = d.length === 0 ? 'vacio' : isImeiValid(d) ? 'ok' : d.length === 15 ? 'mal' : 'incompleto'
  return (
    <span style={{ position: 'relative', display: 'block' }}>
      <input
        {...baseInput(p, {
          inputMode: 'numeric',
          value: maskImei(p.value),
          placeholder: p.placeholder ?? '15 dígitos',
          onChange: e => p.onChange(maskImei(e.target.value)),
          'aria-describedby': `${p.id || uid}-imei-hint`,
          maxLength: 15,
        })}
      />
      {p.showCheck !== false && estado !== 'vacio' && (
        <span
          id={`${p.id || uid}-imei-hint`}
          aria-live="polite"
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 12,
            fontWeight: 700,
            pointerEvents: 'none',
            color: estado === 'ok' ? '#0F9D58' : estado === 'mal' ? '#DC2626' : '#94A3B8',
          }}
        >
          {estado === 'ok' ? '✓' : estado === 'mal' ? 'check ✗' : `${d.length}/15`}
        </span>
      )}
    </span>
  )
}

/** Teléfono — agrupa dígitos de forma tolerante. */
export function TelInput(p: Base) {
  return (
    <input
      {...baseInput(p, {
        inputMode: 'tel',
        value: maskTelefono(p.value),
        placeholder: p.placeholder ?? '11 5566-7788',
        onChange: e => p.onChange(maskTelefono(e.target.value)),
      })}
    />
  )
}

export { isCuilValid, isImeiValid, isTelefonoValid }
