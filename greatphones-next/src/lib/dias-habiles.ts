import { prisma } from '@/lib/prisma'
import { getConfig } from '@/lib/config'

/**
 * Días hábiles y plazo de entrega de preventas (ERP §6.14, reglas 115-117).
 *
 * Un día hábil excluye sábados, domingos y las fechas cargadas en la tabla
 * `Holiday` (equivale a CONFIG_FERIADOS del ERP). La ventana del plazo de
 * entrega (mín/máx días hábiles) es configurable desde el panel vía
 * AppConfig['PREVENTA_PLAZO'] = { minDias, maxDias }. Default 7 a 10.
 */

export interface PlazoConfig {
  minDias: number
  maxDias: number
}

const DEFAULT_PLAZO: PlazoConfig = { minDias: 7, maxDias: 10 }

export async function getPlazoConfig(): Promise<PlazoConfig> {
  const raw = await getConfig<Partial<PlazoConfig> | null>('PREVENTA_PLAZO', null)
  const minDias = Math.max(0, Math.round(Number(raw?.minDias)) || DEFAULT_PLAZO.minDias)
  const maxDias = Math.max(minDias, Math.round(Number(raw?.maxDias)) || DEFAULT_PLAZO.maxDias)
  return { minDias, maxDias }
}

// Caché de 60 s del set de feriados (mismo criterio que otros config del sistema).
let _holidayCache: { set: Set<string>; ts: number } | null = null

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function getHolidaySet(): Promise<Set<string>> {
  if (_holidayCache && Date.now() - _holidayCache.ts < 60_000) return _holidayCache.set
  const rows = await prisma.holiday.findMany({ select: { date: true } })
  const set = new Set(rows.map(r => isoDate(new Date(r.date))))
  _holidayCache = { set, ts: Date.now() }
  return set
}

/** Invalida la caché (llamar tras crear/borrar un feriado). */
export function invalidateHolidayCache() {
  _holidayCache = null
}

export function esFinDeSemana(d: Date): boolean {
  const g = d.getDay()
  return g === 0 || g === 6
}

export function esDiaHabil(d: Date, holidays: Set<string>): boolean {
  return !esFinDeSemana(d) && !holidays.has(isoDate(d))
}

/** Suma `n` días hábiles a `base` (sin contar `base`), salteando fines de semana y feriados. */
export function sumarDiasHabiles(base: Date, n: number, holidays: Set<string>): Date {
  const d = new Date(base)
  let contados = 0
  let guard = 0
  while (contados < n && guard < 1000) {
    d.setDate(d.getDate() + 1)
    if (esDiaHabil(d, holidays)) contados++
    guard++
  }
  return d
}

export interface RangoEntrega extends PlazoConfig {
  fechaDesde: string
  fechaHasta: string
}

/** Rango sugerido de entrega: `minDias` a `maxDias` días hábiles desde `base`. */
export async function calcularRangoEntrega(base: Date = new Date()): Promise<RangoEntrega> {
  const [{ minDias, maxDias }, holidays] = await Promise.all([getPlazoConfig(), getHolidaySet()])
  return {
    minDias,
    maxDias,
    fechaDesde: isoDate(sumarDiasHabiles(base, minDias, holidays)),
    fechaHasta: isoDate(sumarDiasHabiles(base, maxDias, holidays)),
  }
}

/**
 * Valida un rango de fechas de entrega ingresado a mano:
 *  - "Desde" no puede ser posterior a "Hasta" (regla 39).
 *  - "Hasta" no puede quedar en el pasado.
 *  - "Hasta" no puede caer antes del mínimo de días hábiles configurado
 *    (evita prometer una entrega imposible), pero SÍ se permite estirar el
 *    plazo hacia adelante (el negocio pidió flexibilidad).
 * Lanza Error con mensaje legible si algo no cumple.
 */
export async function validarRangoEntrega(
  fechaDesde: string | null | undefined,
  fechaHasta: string | null | undefined,
  base: Date = new Date(),
): Promise<void> {
  if (!fechaDesde && !fechaHasta) return
  if (!fechaDesde || !fechaHasta) throw new Error('Completá las dos fechas del plazo de entrega.')

  const d1 = new Date(fechaDesde + 'T12:00:00')
  const d2 = new Date(fechaHasta + 'T12:00:00')
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) throw new Error('Fechas de entrega inválidas.')
  if (d1 > d2) throw new Error('La fecha "Desde" no puede ser posterior a "Hasta".')

  const hoy = isoDate(base)
  if (fechaHasta < hoy) throw new Error('El plazo de entrega no puede quedar en el pasado.')

  const { fechaDesde: minSugerido, minDias } = await calcularRangoEntrega(base)
  if (fechaHasta < minSugerido) {
    throw new Error(
      `El plazo mínimo de entrega es de ${minDias} días hábiles (${minSugerido}). Ajustá la fecha "Hasta".`,
    )
  }
}
