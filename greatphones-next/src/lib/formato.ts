/**
 * Formateo y validación de campos de entrada del panel.
 *
 * Todas las funciones de "format*Input" son idempotentes y pensadas para usarse
 * en el `onChange` de un input controlado: reciben lo que el usuario tipeó
 * (con o sin formato previo) y devuelven el texto ya formateado. Las "parse*"
 * hacen el camino inverso para mandar al backend un número limpio.
 */

// ─────────────────────────────────────────────────────────────
//  Dinero en pesos (entero, sin centavos)
// ─────────────────────────────────────────────────────────────

/** "1200000" | "1.200.000" → "1.200.000" (solo dígitos, con separador de miles). */
export function formatMilesInput(raw: string): string {
  const d = String(raw ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (!d) return ''
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** "1.200.000" → 1200000. Devuelve 0 si no hay dígitos. */
export function parseMiles(s: string | number | null | undefined): number {
  if (typeof s === 'number') return Math.round(s) || 0
  const d = String(s ?? '').replace(/\D/g, '')
  return d ? parseInt(d, 10) : 0
}

/** 1200000 → "$ 1.200.000" para mostrar en resúmenes. */
export function money(n: number | null | undefined): string {
  return '$ ' + (Math.round(n || 0)).toLocaleString('es-AR')
}

// ─────────────────────────────────────────────────────────────
//  Dólares (admite centavos, coma decimal)
// ─────────────────────────────────────────────────────────────

/** "1234.5" | "1234,50" | "1.234,5" → "1.234,5" (miles con punto, decimales con coma, máx 2). */
export function formatUsdInput(raw: string): string {
  let s = String(raw ?? '').replace(/[^\d.,]/g, '')
  // el último separador (punto o coma) es el decimal; el resto son miles
  s = s.replace(/\.(?=.*[.,])/g, '').replace(/,(?=.*,)/g, '')
  const m = s.match(/^(\d*)(?:[.,](\d{0,2}))?/)
  if (!m) return ''
  const ent = (m[1] || '').replace(/^0+(?=\d)/, '')
  const dec = m[2]
  const entFmt = ent ? ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : (dec !== undefined ? '0' : '')
  if (dec === undefined) return entFmt || (raw && /[.,]$/.test(String(raw)) ? '0,' : '')
  return entFmt + ',' + dec
}

/** "1.234,56" → 1234.56 */
export function parseUsd(s: string | number | null | undefined): number {
  if (typeof s === 'number') return s || 0
  const clean = String(s ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')
  const n = parseFloat(clean)
  return Number.isFinite(n) ? n : 0
}

export function usd(n: number | null | undefined): string {
  return 'US$ ' + (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// ─────────────────────────────────────────────────────────────
//  Entero simple (cuotas, cantidad, batería)
// ─────────────────────────────────────────────────────────────

export function formatIntInput(raw: string, opts: { max?: number } = {}): string {
  let d = String(raw ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (!d) return ''
  if (opts.max != null && parseInt(d, 10) > opts.max) d = String(opts.max)
  return d
}

export function parseIntSafe(s: string | number | null | undefined): number {
  if (typeof s === 'number') return Math.trunc(s) || 0
  const d = String(s ?? '').replace(/\D/g, '')
  return d ? parseInt(d, 10) : 0
}

// ─────────────────────────────────────────────────────────────
//  CUIT / CUIL  →  20-42908945-0
// ─────────────────────────────────────────────────────────────

export function cuilDigits(s: string | null | undefined): string {
  return String(s ?? '').replace(/\D/g, '').slice(0, 11)
}

/** Va poniendo los guiones a medida que se tipea: 20 → 20-4290894 → 20-42908945-0 */
export function maskCuil(raw: string | null | undefined): string {
  const d = cuilDigits(raw)
  if (d.length <= 2) return d
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
}

/** Dígito verificador del CUIT/CUIL (mód 11). */
export function isCuilValid(s: string | null | undefined): boolean {
  const d = cuilDigits(s)
  if (d.length !== 11) return false
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(d[i]), 0)
  let ver = 11 - (suma % 11)
  if (ver === 11) ver = 0
  if (ver === 10) return false
  return ver === Number(d[10])
}

// ─────────────────────────────────────────────────────────────
//  IMEI  (15 dígitos, último es verificador Luhn)
// ─────────────────────────────────────────────────────────────

export function imeiDigits(s: string | null | undefined): string {
  return String(s ?? '').replace(/\D/g, '').slice(0, 15)
}

export function maskImei(raw: string | null | undefined): string {
  return imeiDigits(raw)
}

export function isImeiValid(s: string | null | undefined): boolean {
  const d = imeiDigits(s)
  if (d.length !== 15) return false
  // Luhn sobre los 15 dígitos
  let sum = 0
  for (let i = 0; i < 15; i++) {
    let n = Number(d[i])
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  return sum % 10 === 0
}

// ─────────────────────────────────────────────────────────────
//  Teléfono (Argentina, flexible)
// ─────────────────────────────────────────────────────────────

export function telDigits(s: string | null | undefined): string {
  return String(s ?? '').replace(/[^\d]/g, '').slice(0, 13)
}

/** Formatea de forma tolerante, agrupando desde la derecha:
 *  "1155667788" → "11 5566-7788", "4567788" → "456-7788". */
export function maskTelefono(raw: string | null | undefined): string {
  const d = telDigits(raw)
  if (d.length <= 4) return d
  const last4 = d.slice(-4)
  const rest = d.slice(0, -4)
  if (rest.length <= 4) return `${rest}-${last4}`
  const mid4 = rest.slice(-4)
  const head = rest.slice(0, -4)
  return `${head} ${mid4}-${last4}`
}

export function isTelefonoValid(s: string | null | undefined): boolean {
  const d = telDigits(s)
  return d.length >= 8 && d.length <= 13
}
