import { prisma } from '@/lib/prisma'
import { registerEntry } from '@/lib/accounting'
import { dolarActual } from '@/lib/dolar-server'
import { auditar } from '@/lib/audit'
import { calcularRangoEntrega, validarRangoEntrega } from '@/lib/dias-habiles'
import { nextCorrelativo } from '@/lib/correlativo'

/**
 * Ciclo de preventa (Fase 1 — paridad con el ERP §4.3 y §4.4).
 *
 * Servicio único de registro y entrega de preventas. Todas las pantallas
 * (`ops/preventas`, `preorders`, `ops/entregar-preventa`) delegan acá para que
 * las reglas de negocio sean las mismas sin importar por dónde se cargue:
 *
 *  - Se guarda cuánto se cobró (seña + entregas parciales) en `PreOrder`.
 *  - La entrega cobra SOLO el saldo pendiente + accesorios, nunca el precio
 *    total (ERP §1.5, regla 44).
 *  - Si al entregar la preventa todavía no tiene equipo, se crea la compra
 *    "Reservado Preventa" con su asiento EGRESO (regla 47).
 *  - Entregas parciales sucesivas actualizan la MISMA Venta (regla 46).
 *  - Se puede entregar con deuda, con confirmación explícita (regla 45).
 */

// ── Estados canónicos ──────────────────────────────────────────────────────
export const PRE = {
  ESPERANDO_COMPRA: 'ESPERANDO_COMPRA',
  COMPRADO: 'COMPRADO',
  ENTREGADO_SALDO: 'ENTREGADO_SALDO',
  ENTREGADO: 'ENTREGADO',
  CANCELADO: 'CANCELADO',
} as const

const LEGACY_STATUS: Record<string, string> = {
  PENDING: PRE.ESPERANDO_COMPRA,
  PAID: PRE.COMPRADO,
  CONFIRMED: PRE.COMPRADO,
  PROCESSING: PRE.COMPRADO,
  DELIVERED: PRE.ENTREGADO,
  CANCELLED: PRE.CANCELADO,
}

/** Normaliza un estado histórico (PENDING/PAID/...) al vocabulario canónico. */
export function normalizeStatus(s: string | null | undefined): string {
  if (!s) return PRE.ESPERANDO_COMPRA
  return LEGACY_STATUS[s] || s
}

/** Estados que el calendario / listados consideran "pendiente de entrega". */
export const PENDIENTE_ENTREGA: string[] = [PRE.ESPERANDO_COMPRA, PRE.COMPRADO, PRE.ENTREGADO_SALDO]

/**
 * Traduce un valor de filtro de estado (que puede venir con vocabulario legacy
 * desde el frontend vanilla-JS) a los valores canónicos que hay que buscar en BD.
 * Devuelve null si no hay filtro (mostrar todos).
 */
export function statusFilterValues(raw: string | null | undefined): string[] | null {
  if (!raw || raw === 'all' || raw === 'TODOS') return null
  const canon = normalizeStatus(raw)
  const values = new Set<string>([raw, canon])
  // Al filtrar por un canónico, incluir también sus alias legacy por si quedan
  // filas sin normalizar.
  for (const [legacy, c] of Object.entries(LEGACY_STATUS)) if (c === canon) values.add(legacy)
  return [...values]
}

// ── Cálculo de saldo ───────────────────────────────────────────────────────
interface CobroPreOrder {
  price: number
  collectedArs: number
  collectedUsd: number
}

/** Saldo pendiente en pesos = precio − cobrado ARS − (cobrado USD × cotización). Piso 0. */
export function saldoPendiente(pre: CobroPreOrder, usdRate: number): number {
  const cobrado = (pre.collectedArs || 0) + Math.round((pre.collectedUsd || 0) * usdRate)
  return Math.max(0, (pre.price || 0) - cobrado)
}

// ── Helpers de medios de pago ──────────────────────────────────────────────
interface Cobro {
  efectivo?: number
  transferencia?: number
  cuotas?: number
  /** cantidad de dólares reales */
  usd?: number
}

type Medio = { pm: 'EFECTIVO' | 'TRANSFERENCIA' | 'CUOTAS' | 'USD'; ars: number; usd: number }

function mediosDeCobro(c: Cobro, usdRate: number): Medio[] {
  const out: Medio[] = []
  const ef = Math.round(c.efectivo || 0)
  const tr = Math.round(c.transferencia || 0)
  const cu = Math.round(c.cuotas || 0)
  const us = Number(c.usd || 0)
  if (ef > 0) out.push({ pm: 'EFECTIVO', ars: ef, usd: 0 })
  if (tr > 0) out.push({ pm: 'TRANSFERENCIA', ars: tr, usd: 0 })
  if (cu > 0) out.push({ pm: 'CUOTAS', ars: cu, usd: 0 })
  if (us > 0) out.push({ pm: 'USD', ars: Math.round(us * usdRate), usd: us })
  return out
}

function totalCobroPesos(c: Cobro, usdRate: number): number {
  return Math.round(c.efectivo || 0) + Math.round(c.transferencia || 0) + Math.round(c.cuotas || 0) +
    Math.round(Number(c.usd || 0) * usdRate)
}

// ── Numeración ─────────────────────────────────────────────────────────────
// Correlativo por prefijo (ERP regla 9) vía nextCorrelativo: cuenta las filas
// del modelo con ese prefijo bajo un advisory lock transaccional. Debe correr
// dentro de una prisma.$transaction.
const nextPreCode = (tx: any) => nextCorrelativo(tx, 'PRE', tx.preOrder)
const nextInvCode = (tx: any) => nextCorrelativo(tx, 'CMP', tx.inventoryItem)
// La entrega de una preventa genera una Venta normal: mismo correlativo VTA
// que las ventas de mostrador (ERP §4.2, una sola hoja de Ventas).
const nextSaleCode = (tx: any) => nextCorrelativo(tx, 'VTA', tx.sale)

// ══════════════════════════════════════════════════════════════════════════
//  REGISTRAR PREVENTA
// ══════════════════════════════════════════════════════════════════════════
export interface RegistrarPreventaInput {
  cliente: string
  cuil?: string | null
  tel?: string | null
  email?: string | null
  modelo: string
  storage?: string | null
  color?: string | null
  condition?: string | null
  precioVenta: number
  cobro: Cobro
  vendedor?: string | null
  operador?: string | null
  createdById?: string | null
  fechaDesde?: string | null
  fechaHasta?: string | null
  obs?: string | null
  /** 'local' (default) | 'online' */
  source?: string
  productId?: string | null
}

export async function registrarPreventa(input: RegistrarPreventaInput) {
  if (!input.cliente?.trim()) throw new PreventaError('Ingresá el nombre del cliente')
  if (!input.modelo?.trim()) throw new PreventaError('Ingresá el modelo solicitado')
  if (!(input.precioVenta > 0)) throw new PreventaError('El precio pactado debe ser mayor a 0')

  const usdRate = (await dolarActual()).compra || 1000
  const cobradoPesos = totalCobroPesos(input.cobro, usdRate)
  if (cobradoPesos <= 0) throw new PreventaError('Debe registrarse al menos un cobro')
  if (cobradoPesos > input.precioVenta + 1) {
    throw new PreventaError(
      `El cobro (${fmt(cobradoPesos)}) no puede superar el precio pactado (${fmt(input.precioVenta)}).`,
    )
  }

  // Plazo de entrega: si no lo mandan, se autocalcula por días hábiles
  // (regla 39/116). Si lo mandan a mano, se valida (regla 117).
  let fechaDesde = input.fechaDesde
  let fechaHasta = input.fechaHasta
  if (!fechaDesde || !fechaHasta) {
    const rango = await calcularRangoEntrega()
    fechaDesde = rango.fechaDesde
    fechaHasta = rango.fechaHasta
  } else {
    try {
      await validarRangoEntrega(fechaDesde, fechaHasta)
    } catch (e) {
      throw new PreventaError((e as Error).message)
    }
  }

  const medios = mediosDeCobro(input.cobro, usdRate)
  const collectedUsd = medios.reduce((s, m) => s + m.usd, 0)
  const collectedArs = medios.filter(m => m.pm !== 'USD').reduce((s, m) => s + m.ars, 0)

  const pre = await prisma.$transaction(async tx => {
    const code = await nextPreCode(tx)
    const created = await tx.preOrder.create({
      data: {
        code,
        clientName: input.cliente.trim(),
        clientDni: input.cuil || null,
        clientPhone: input.tel || null,
        clientEmail: input.email || null,
        productId: input.productId || null,
        productModelName: input.modelo,
        productStorage: input.storage || null,
        productColor: input.color || null,
        productCondition: input.condition || null,
        price: input.precioVenta,
        collectedArs,
        collectedUsd,
        sellerName: input.vendedor || null,
        status: PRE.ESPERANDO_COMPRA,
        source: input.source || 'local',
        notes: input.obs || null,
        expectedDeliveryStart: fechaDesde ? new Date(fechaDesde) : null,
        expectedDeliveryEnd: fechaHasta ? new Date(fechaHasta) : null,
        createdById: input.createdById || null,
      },
    })

    for (const m of medios) {
      await registerEntry({
        source: 'PREORDER',
        operationId: code,
        description: `Preventa ${code} — ${input.cliente} — ${input.modelo}`,
        category: 'Preventas',
        type: 'INGRESO',
        means: m.pm,
        amount: m.pm === 'USD' ? 0 : m.ars,
        amountUsd: m.pm === 'USD' ? m.usd : null,
        operator: input.operador || input.vendedor || input.createdById || null,
        createdById: input.createdById || null,
      })
    }

    return created
  })

  await auditar({
    entityType: 'PreOrder',
    entityId: pre.id,
    action: 'CREACION',
    reason: 'Registro de preventa',
    operator: input.operador || input.vendedor || null,
    createdById: input.createdById || null,
  }).catch(() => {})

  return { code: pre.code, preOrder: pre, saldo: saldoPendiente(pre, usdRate) }
}

// ══════════════════════════════════════════════════════════════════════════
//  ENTREGAR PREVENTA
// ══════════════════════════════════════════════════════════════════════════
export interface EntregarPreventaInput {
  preOrderId: string
  cobro: Cobro
  accesorios?: { nombre: string; precio: number }[]
  /** Datos mínimos del equipo, si la preventa todavía no tiene compra vinculada. */
  equipo?: {
    imei?: string | null
    costo: number
    proveedor?: string | null
    color?: string | null
    storage?: string | null
  } | null
  /** Confirmación explícita para entregar dejando saldo pendiente (regla 45). */
  confirmarDeuda?: boolean
  fecha?: string | null
  obs?: string | null
  operador?: string | null
  createdById?: string | null
}

export async function entregarPreventa(input: EntregarPreventaInput) {
  const pre = await prisma.preOrder.findUnique({
    where: { id: input.preOrderId },
    include: { inventoryItem: { include: { product: true } } },
  })
  if (!pre) throw new PreventaError('Preventa no encontrada', 404)

  const estado = normalizeStatus(pre.status)
  if (estado === PRE.CANCELADO) throw new PreventaError(`La preventa ${pre.code} está cancelada.`)
  if (estado === PRE.ENTREGADO) throw new PreventaError(`La preventa ${pre.code} ya fue entregada por completo.`)

  const usdRate = (await dolarActual()).compra || 1000
  const saldoCel = saldoPendiente(pre, usdRate)

  const accs = (input.accesorios || []).filter(a => a.nombre && a.precio > 0)
  const sumAccs = accs.reduce((s, a) => s + a.precio, 0)
  const maxCobrable = saldoCel + sumAccs

  const cobradoAhora = totalCobroPesos(input.cobro, usdRate)
  if (cobradoAhora > maxCobrable + 1) {
    throw new PreventaError(
      `Estás cobrando ${fmt(cobradoAhora)} pero corresponde a lo sumo ${fmt(maxCobrable)} ` +
        `(saldo del equipo ${fmt(saldoCel)} + accesorios ${fmt(sumAccs)}).`,
    )
  }

  // Prorrateo del cobro de la entrega entre "saldo del equipo" y accesorios.
  const valorTotalAhora = maxCobrable
  const factorCel = valorTotalAhora > 0 ? saldoCel / valorTotalAhora : 1
  const mediosEntrega = mediosDeCobro(input.cobro, usdRate)
  const mediosCel = mediosEntrega
    .map(m => ({ ...m, ars: Math.round(m.ars * factorCel), usd: Number((m.usd * factorCel).toFixed(2)) }))
    .filter(m => m.ars > 0 || m.usd > 0)
  const cobradoCelArs = mediosCel.filter(m => m.pm !== 'USD').reduce((s, m) => s + m.ars, 0)
  const cobradoCelUsd = mediosCel.reduce((s, m) => s + m.usd, 0)
  const cobradoCelPesos = mediosCel.reduce((s, m) => s + m.ars, 0)

  const nuevoCollectedArs = pre.collectedArs + cobradoCelArs
  const nuevoCollectedUsd = pre.collectedUsd + cobradoCelUsd
  const saldoRestante = Math.max(
    0,
    pre.price - nuevoCollectedArs - Math.round(nuevoCollectedUsd * usdRate),
  )

  if (saldoRestante > 0 && !input.confirmarDeuda) {
    throw new PreventaError(
      `Después de este cobro queda un saldo de ${fmt(saldoRestante)}. ` +
        `Confirmá "entregar con deuda" para continuar.`,
      409,
    )
  }

  // Resolver / crear la compra del equipo.
  let inventoryItemId = pre.inventoryItemId
  let costoEquipo = pre.inventoryItem?.purchasePrice ?? 0
  let productId = pre.inventoryItem?.productId ?? pre.productId ?? null

  const result = await prisma.$transaction(async tx => {
    if (!inventoryItemId) {
      if (!input.equipo || !(input.equipo.costo >= 0)) {
        throw new PreventaError(
          'Esta preventa no tiene equipo vinculado: cargá IMEI, costo y proveedor para crear la compra.',
          400,
        )
      }
      const compraCode = await nextInvCode(tx)
      // Producto de catálogo: reusar el vinculado a la preventa, o crear uno.
      let prod = productId ? await tx.product.findUnique({ where: { id: productId } }) : null
      if (!prod) {
        prod = await tx.product.create({
          data: {
            name: pre.productModelName || 'Equipo en preventa',
            brand: 'Genérico',
            modelGroup: pre.productModelName || undefined,
            ico: '📱',
            condition: pre.productCondition || 'Bueno',
            price: pre.price,
            cost: input.equipo.costo,
            stock: 0, // reservado para preventa: no suma a stock vendible
            type: 'celular',
            storage: input.equipo.storage || pre.productStorage || undefined,
            color: input.equipo.color || pre.productColor || undefined,
            description: `Reservado para preventa ${pre.code}`,
          },
        })
      }
      productId = prod.id
      costoEquipo = input.equipo.costo

      const item = await tx.inventoryItem.create({
        data: {
          code: compraCode,
          imei: input.equipo.imei?.trim() || `NOIMEI-${Date.now().toString().slice(-9)}`,
          brand: prod.brand,
          modelName: pre.productModelName || prod.name,
          storage: input.equipo.storage || pre.productStorage || null,
          color: input.equipo.color || pre.productColor || null,
          deviceType: 'celular',
          purchasePrice: input.equipo.costo,
          cosmeticCondition: pre.productCondition || 'Bueno',
          purchasedFrom: input.equipo.proveedor || null,
          status: 'RESERVED',
          targetPrice: pre.price,
          productId: prod.id,
          createdById: input.createdById || prod.id, // createdById es obligatorio en el modelo
          notes: `Compra creada al entregar la preventa ${pre.code}`,
        },
      })
      inventoryItemId = item.id

      await tx.preOrder.update({
        where: { id: pre.id },
        data: { inventoryItemId: item.id },
      })

      // Asiento EGRESO por el costo del equipo (regla 47 / §4.4 paso 2).
      if (input.equipo.costo > 0) {
        await registerEntry({
          source: 'COMPRA',
          operationId: compraCode,
          description: `Compra (reservada preventa ${pre.code}): ${pre.productModelName || ''}`,
          category: 'COMPRA_EQUIPO',
          type: 'EGRESO',
          means: 'EFECTIVO',
          amount: input.equipo.costo,
          operator: input.operador || input.createdById || null,
          createdById: input.createdById || null,
        })
      }
    }

    // Marcar el equipo vendido y bajar stock del catálogo si estaba sumando.
    const item = await tx.inventoryItem.update({
      where: { id: inventoryItemId! },
      data: { status: 'SOLD', soldAt: new Date(), soldById: input.createdById || null, salePrice: pre.price },
    })
    await tx.inventoryHistory.create({
      data: {
        inventoryItemId: item.id,
        type: 'SOLD',
        oldValue: 'RESERVED',
        newValue: 'SOLD',
        description: `Entrega de preventa ${pre.code}`,
        userId: input.createdById || '',
      },
    })
    if (item.productId && item.status !== undefined) {
      await tx.product
        .update({ where: { id: item.productId }, data: { sold: { increment: 1 } } })
        .catch(() => {})
    }

    // Ganancia (acumulada: lo cobrado del celular en la preventa + ahora − costo).
    const cobradoTotalCel =
      pre.collectedArs + Math.round(pre.collectedUsd * usdRate) + cobradoCelPesos
    const gananciaTeorica = pre.price - costoEquipo
    const gananciaCobrada = cobradoTotalCel - costoEquipo

    // Venta: crear o actualizar la existente (entregas parciales — regla 46).
    let saleCode = pre.saleCode
    if (saleCode) {
      await tx.sale.updateMany({
        where: { code: saleCode },
        data: {
          price: pre.price,
          cost: costoEquipo,
          profitReal: gananciaCobrada,
          status: saldoRestante > 0 ? 'PROCESSING' : 'COMPLETED',
        },
      })
    } else {
      saleCode = await nextSaleCode(tx)
      // userId es obligatorio; usar el user de la preventa o el admin.
      const userId = pre.userId || input.createdById || item.createdById
      await tx.sale.create({
        data: {
          code: saleCode,
          userId: userId!,
          device: pre.productModelName || item.modelName,
          storage: pre.productStorage || item.storage || '',
          condition: pre.productCondition || '',
          imei: item.imei,
          price: pre.price,
          cost: costoEquipo,
          profitReal: gananciaCobrada,
          originType: 'propio',
          payment: 'PREVENTA',
          status: saldoRestante > 0 ? 'PROCESSING' : 'COMPLETED',
          operator: input.operador || pre.sellerName || 'SIN_OPERADOR',
        },
      })
    }

    // Asientos INGRESO por la porción del celular (por medio de pago).
    for (const m of mediosCel) {
      await registerEntry({
        source: 'PREVENTA_ENTREGA',
        operationId: pre.code,
        description: `Entrega preventa ${pre.code} — cobro del equipo`,
        category: 'VENTA_PROPIA',
        type: 'INGRESO',
        means: m.pm,
        amount: m.pm === 'USD' ? 0 : m.ars,
        amountUsd: m.pm === 'USD' ? m.usd : null,
        operator: input.operador || pre.sellerName || input.createdById || null,
        createdById: input.createdById || null,
      })
    }

    // Accesorios de la entrega: descontar stock + asiento por la porción de accesorios.
    for (const a of accs) {
      await tx.accessory
        .updateMany({ where: { name: a.nombre, isActive: true }, data: { stock: { decrement: 1 } } })
        .catch(() => {})
    }
    const mediosAcc = mediosEntrega
      .map(m => ({ pm: m.pm, ars: m.ars - (mediosCel.find(c => c.pm === m.pm)?.ars || 0), usd: m.usd - (mediosCel.find(c => c.pm === m.pm)?.usd || 0) }))
      .filter(m => m.ars > 0 || m.usd > 0)
    for (const m of mediosAcc) {
      await registerEntry({
        source: 'VENTA_ACCESORIO',
        operationId: pre.code,
        description: `Entrega preventa ${pre.code} — accesorios`,
        category: 'VENTA_ACCESORIO',
        type: 'INGRESO',
        means: m.pm,
        amount: m.pm === 'USD' ? 0 : m.ars,
        amountUsd: m.pm === 'USD' ? m.usd : null,
        operator: input.operador || pre.sellerName || input.createdById || null,
        createdById: input.createdById || null,
      })
    }

    const updated = await tx.preOrder.update({
      where: { id: pre.id },
      data: {
        status: saldoRestante > 0 ? PRE.ENTREGADO_SALDO : PRE.ENTREGADO,
        deliveredAt: new Date(),
        collectedArs: nuevoCollectedArs,
        collectedUsd: nuevoCollectedUsd,
        saleCode,
        notes:
          (pre.notes || '') +
          ` | ${saldoRestante > 0 ? 'Entrega parcial' : 'Entregado'} ${new Date().toISOString()}` +
          (saldoRestante > 0 ? ` (saldo ${fmt(saldoRestante)})` : ''),
      },
    })

    return { updated, saleCode, saldoRestante, gananciaTeorica, gananciaCobrada }
  })

  await auditar({
    entityType: 'PreOrder',
    entityId: pre.id,
    action: 'UPDATE',
    reason: result.saldoRestante > 0 ? 'Entrega parcial de preventa' : 'Entrega de preventa',
    operator: input.operador || pre.sellerName || null,
    createdById: input.createdById || null,
  }).catch(() => {})

  return {
    preventa: pre.code,
    saldoPrevio: saldoCel,
    cobradoAhora,
    accesorios: sumAccs,
    saldoRestante: result.saldoRestante,
    saleCode: result.saleCode,
    gananciaTeorica: result.gananciaTeorica,
    gananciaCobrada: result.gananciaCobrada,
  }
}

// ── Errores ────────────────────────────────────────────────────────────────
export class PreventaError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'PreventaError'
    this.status = status
  }
}

function fmt(n: number) {
  return '$' + (n || 0).toLocaleString('es-AR')
}
