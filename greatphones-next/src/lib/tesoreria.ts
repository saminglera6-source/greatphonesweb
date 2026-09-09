import { prisma } from '@/lib/prisma'
import { registerEntry, getCashBalances } from '@/lib/accounting'
import { dolarActual } from '@/lib/dolar-server'

/**
 * Tesorería (ERP §4.11-4.12, reglas 62-70).
 *
 * Cambio de Moneda y Ajuste de Caja como operaciones formales, con el mismo
 * rigor que el ERP:
 *  - Cambio de moneda genera SIEMPRE dos asientos simultáneos (egreso en la
 *    caja de origen, ingreso en la de destino) bajo el mismo N° de operación,
 *    con el monto en pesos calculado en el servidor (regla 66, 67).
 *  - Ajuste de caja exige motivo; "Sobrante" genera ingreso, "Faltante" egreso
 *    (reglas 69, 70).
 */

export class TesoreriaError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'TesoreriaError'
    this.status = status
  }
}

async function nextOpNumber(prefix: string, source: string): Promise<string> {
  const n = await prisma.accountingEntry.count({ where: { source } })
  return `${prefix}-${String(1000 + n + 1).slice(1)}`
}

// ══════════════════════════════════════════════════════════════════════════
//  CAMBIO DE MONEDA
// ══════════════════════════════════════════════════════════════════════════
export interface CambioMonedaInput {
  /** Cantidad de dólares que se mueve. */
  usd: number
  /** Caja en pesos involucrada. */
  cajaPesos: 'EFECTIVO' | 'TRANSFERENCIA'
  /** 'COMPRA_USD' = el negocio compra dólares (salen pesos, entran USD).
   *  'VENTA_USD'  = el negocio vende dólares (entran pesos, salen USD). */
  direccion: 'COMPRA_USD' | 'VENTA_USD'
  /** Cotización usada (puede diferir de la oficial). Si no se pasa, se toma la vigente. */
  cotizacion?: number
  obs?: string
  operator?: string | null
  createdById?: string | null
}

export async function cambioMoneda(input: CambioMonedaInput) {
  if (!(input.usd > 0)) throw new TesoreriaError('La cantidad de dólares debe ser mayor a 0.')

  const cot = input.cotizacion && input.cotizacion > 0
    ? input.cotizacion
    : (await dolarActual()).venta || 0
  if (!(cot > 0)) throw new TesoreriaError('No hay una cotización válida para el cambio.')

  // El monto en pesos SIEMPRE se calcula acá (regla 66).
  const pesos = Math.round(input.usd * cot)
  const op = await nextOpNumber('CAM', 'CAMBIO')

  const compraUsd = input.direccion === 'COMPRA_USD'
  const desc =
    `Cambio de moneda ${op} — ${compraUsd ? 'compra' : 'venta'} de USD ${input.usd} a $${cot}` +
    (input.obs ? ` · ${input.obs}` : '')

  // Dos asientos bajo el mismo operationId (regla 67).
  // COMPRA_USD: EGRESO pesos (caja pesos)  +  INGRESO USD (caja USD)
  // VENTA_USD:  INGRESO pesos (caja pesos)  +  EGRESO USD (caja USD)
  await registerEntry({
    source: 'CAMBIO',
    operationId: op,
    description: desc + ' · lado pesos',
    category: compraUsd ? 'COMPRA_USD' : 'VENTA_USD',
    type: compraUsd ? 'EGRESO' : 'INGRESO',
    means: input.cajaPesos,
    amount: pesos,
    operator: input.operator || null,
    createdById: input.createdById || null,
    metadata: { cambio: true, usd: input.usd, cotizacion: cot, lado: 'pesos' },
  })
  await registerEntry({
    source: 'CAMBIO',
    operationId: op,
    description: desc + ' · lado USD',
    category: compraUsd ? 'COMPRA_USD' : 'VENTA_USD',
    type: compraUsd ? 'INGRESO' : 'EGRESO',
    means: 'USD',
    amount: 0,
    amountUsd: input.usd,
    operator: input.operator || null,
    createdById: input.createdById || null,
    metadata: { cambio: true, usd: input.usd, cotizacion: cot, lado: 'usd' },
  })

  return { operacion: op, usd: input.usd, pesos, cotizacion: cot, direccion: input.direccion }
}

// ══════════════════════════════════════════════════════════════════════════
//  AJUSTE DE CAJA (arqueo)
// ══════════════════════════════════════════════════════════════════════════
export interface AjusteCajaInput {
  means: 'EFECTIVO' | 'TRANSFERENCIA' | 'USD'
  /** Diferencia detectada: 'SOBRANTE' (hay más plata de la que dice el sistema)
   *  o 'FALTANTE' (hay menos). */
  tipo: 'SOBRANTE' | 'FALTANTE'
  /** Monto de la diferencia (en pesos, o cantidad de USD si means === 'USD'). */
  monto: number
  motivo: string
  obs?: string
  operator?: string | null
  createdById?: string | null
}

export async function ajusteCaja(input: AjusteCajaInput) {
  if (!input.motivo?.trim()) throw new TesoreriaError('El motivo del ajuste es obligatorio.')
  if (!(input.monto > 0)) throw new TesoreriaError('El monto del ajuste debe ser mayor a 0.')

  const op = await nextOpNumber('AJC', 'AJUSTE')
  const esUsd = input.means === 'USD'

  await registerEntry({
    source: 'AJUSTE',
    operationId: op,
    description: `Ajuste de caja ${op} — ${input.tipo === 'SOBRANTE' ? 'sobrante' : 'faltante'}: ${input.motivo}`,
    category: input.tipo === 'SOBRANTE' ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO',
    type: input.tipo === 'SOBRANTE' ? 'INGRESO' : 'EGRESO',
    means: input.means,
    amount: esUsd ? 0 : Math.round(input.monto),
    amountUsd: esUsd ? input.monto : null,
    operator: input.operator || null,
    createdById: input.createdById || null,
    metadata: { ajuste: true, tipo: input.tipo, motivo: input.motivo, obs: input.obs || null },
  })

  return { operacion: op, tipo: input.tipo, means: input.means, monto: input.monto }
}

/**
 * Arqueo: compara un conteo físico por medio contra el saldo del sistema y
 * devuelve la diferencia. No modifica nada — es solo lectura. El ajuste, si
 * corresponde, se genera aparte con `ajusteCaja`.
 */
export async function arqueo(conteo: { EFECTIVO?: number; TRANSFERENCIA?: number; USD?: number }) {
  const balances = await getCashBalances()
  const byMeans = new Map(balances.map(b => [b.means, b]))
  const medios: Array<'EFECTIVO' | 'TRANSFERENCIA' | 'USD'> = ['EFECTIVO', 'TRANSFERENCIA', 'USD']
  return medios.map(m => {
    const b = byMeans.get(m)
    const sistema = m === 'USD' ? b?.balanceUsd || 0 : b?.balance || 0
    const fisico = conteo[m]
    const diferencia = fisico == null ? null : Math.round((fisico - sistema) * 100) / 100
    return {
      means: m,
      sistema,
      fisico: fisico ?? null,
      diferencia,
      tipo: diferencia == null ? null : diferencia > 0 ? 'SOBRANTE' : diferencia < 0 ? 'FALTANTE' : 'OK',
    }
  })
}
