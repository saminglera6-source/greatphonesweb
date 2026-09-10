import { prisma } from '@/lib/prisma'

/** Catálogo de trabajos de reparación (mismas claves que Toma de Equipos + las nuevas). */
export const REPARACIONES_ITEMS = [
  { key: 'bateria', label: 'Batería' },
  { key: 'pantalla', label: 'Pantalla' },
  { key: 'camara', label: 'Cámara' },
  { key: 'microfono', label: 'Micrófono' },
  { key: 'parlante', label: 'Parlante' },
  { key: 'tapa', label: 'Tapa trasera' },
  { key: 'marco', label: 'Marco' },
  { key: 'pin', label: 'Pin de carga' },
  { key: 'flex', label: 'Flex de carga' },
  { key: 'botones', label: 'Botones laterales' },
  { key: 'chasis', label: 'Chasis' },
] as const

export type ReparacionKey = (typeof REPARACIONES_ITEMS)[number]['key']

export interface TrabajoResult {
  nombre: string
  precio: number | null
  sinConfigurar?: boolean
  motivo?: string
  descuentoToma?: number
  multiplicador?: number
  fuente?: 'icare' | 'propio'
}

export interface PresupuestoResult {
  trabajos: TrabajoResult[]
  precioTotal: number
  horasEstimadas: number
  estado: 'COTIZADO' | 'DIAGNOSTICO'
}

/** Normaliza un modelo para el match del tarifario Icare (minúsculas, sin
 *  almacenamiento). Regla 114 del ERP. */
export function normalizarModelo(modelo: string): string {
  return (modelo || '')
    .toLowerCase()
    .replace(/\b\d+\s*(gb|tb)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Precio Público = Precio Guía × 1.20 redondeado al peso (regla 111). */
export function precioPublicoIcare(precioGuia: number): number {
  return Math.round((Number(precioGuia) || 0) * 1.2)
}

/**
 * Precio de un trabajo según el tarifario Icare, si lo cubre.
 * Regla 110: varias variantes del mismo modelo+categoría → la más cara.
 * Regla 114: match exacto → normalizado (sin fuzzy).
 */
async function precioIcare(
  modelo: string,
  categoria: string,
  cache: Map<string, number | null>,
): Promise<number | null> {
  const norm = normalizarModelo(modelo)
  const key = `${norm}|${categoria}`
  if (cache.has(key)) return cache.get(key)!
  const filas = await prisma.icareTariff.findMany({
    where: { categoria, OR: [{ modelo }, { modeloNorm: norm }] },
    select: { precioPublico: true },
    orderBy: { precioPublico: 'desc' },
  })
  const val = filas.length ? filas[0].precioPublico : null
  cache.set(key, val)
  return val
}

/**
 * Calcula el presupuesto de una reparación.
 * Cascada por trabajo (ERP §6.5 regla 56): tarifario Icare → método propio
 * (descuento de Toma × multiplicador) → "sin configurar".
 * Si `esDiagnostico` es true, devuelve estado DIAGNOSTICO sin calcular.
 */
export async function calcularPresupuesto(
  modelo: string,
  trabajosMarcados: Partial<Record<ReparacionKey, boolean>>,
  esDiagnostico = false,
): Promise<PresupuestoResult> {
  if (esDiagnostico) {
    return { trabajos: [], precioTotal: 0, horasEstimadas: 48, estado: 'DIAGNOSTICO' }
  }

  const equipo = await prisma.priceTradeIn.findFirst({ where: { modelo, active: true } })
  const configs = await prisma.repairConfig.findMany({ where: { activo: true } })
  const config = new Map(configs.map(c => [c.key, c]))
  const icareCache = new Map<string, number | null>()

  const trabajos: TrabajoResult[] = []
  let precioTotal = 0
  let horasEstimadas = 0

  for (const it of REPARACIONES_ITEMS) {
    if (!trabajosMarcados[it.key]) continue
    const cfg = config.get(it.key)
    const horas = cfg?.horas ?? 48

    // 1) Icare
    const pIcare = await precioIcare(modelo, it.key, icareCache)
    if (pIcare != null && pIcare > 0) {
      trabajos.push({ nombre: it.label, precio: pIcare, fuente: 'icare' })
      precioTotal += pIcare
      if (horas > horasEstimadas) horasEstimadas = horas
      continue
    }

    // 2) Método propio: descuento de Toma × multiplicador (regla 57: activo)
    if (!cfg) {
      trabajos.push({ nombre: it.label, precio: null, sinConfigurar: true, motivo: 'Categoría sin configurar' })
      continue
    }
    const descuentoToma = equipo ? Number((equipo as any)[it.key]) || 0 : 0
    if (descuentoToma > 0) {
      const precio = Math.round(descuentoToma * cfg.multiplicador)
      trabajos.push({ nombre: it.label, precio, descuentoToma, multiplicador: cfg.multiplicador, fuente: 'propio' })
      precioTotal += precio
      if (cfg.horas > horasEstimadas) horasEstimadas = cfg.horas
      continue
    }

    // 3) Sin configurar
    trabajos.push({
      nombre: it.label,
      precio: null,
      sinConfigurar: true,
      motivo: equipo ? 'Sin precio de Icare ni de Toma para este modelo' : `Modelo "${modelo}" sin Toma ni tarifario Icare`,
    })
  }

  return { trabajos, precioTotal, horasEstimadas, estado: 'COTIZADO' }
}

/** Arma el tarifario completo: para cada modelo de Toma de Equipos, sus trabajos con precio. */
export async function obtenerTarifario() {
  const equipos = await prisma.priceTradeIn.findMany({ where: { active: true }, orderBy: { orden: 'asc' } })
  const configs = await prisma.repairConfig.findMany({ where: { activo: true } })
  const config = new Map(configs.map(c => [c.key, c]))
  const icareCache = new Map<string, number | null>()

  return Promise.all(
    equipos.map(async equipo => {
      const trabajos: TrabajoResult[] = []
      for (const it of REPARACIONES_ITEMS) {
        const pIcare = await precioIcare(equipo.modelo, it.key, icareCache)
        if (pIcare != null && pIcare > 0) {
          trabajos.push({ nombre: it.label, precio: pIcare, fuente: 'icare' })
          continue
        }
        const cfg = config.get(it.key)
        const descuentoToma = Number((equipo as any)[it.key]) || 0
        if (cfg && descuentoToma > 0) {
          trabajos.push({ nombre: it.label, precio: Math.round(descuentoToma * cfg.multiplicador), fuente: 'propio' })
        } else {
          trabajos.push({ nombre: it.label, precio: null, sinConfigurar: true, motivo: cfg ? 'Sin descuento en Toma' : 'Categoría sin configurar' })
        }
      }
      return { modelo: equipo.modelo, trabajos }
    }),
  )
}
