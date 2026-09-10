import { prisma } from '@/lib/prisma'
import { registerEntry } from '@/lib/accounting'
import { dolarActual } from '@/lib/dolar-server'

/**
 * Compra de accesorios (ERP §4.5, reglas 77-79, 84-85).
 *
 * Ingreso multilínea: varios productos en una operación. Por cada línea:
 *  - resuelve o crea el accesorio (match normalizado categoría+producto+marca+color),
 *  - suma stock y recalcula el costo promedio ponderado (`cost`) y el costo
 *    vigente (`lastCost`).
 * Exige que el total pagado (efec + transf + usd convertido) coincida con el
 * costo total (±$1). Genera un asiento EGRESO por cada medio de pago.
 */

export class CompraAccError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'CompraAccError'
    this.status = status
  }
}

export interface LineaCompra {
  categoria: string
  producto: string
  marca?: string | null
  color?: string | null
  cantidad: number
  costoUnit: number
  precioVenta?: number | null
  stockMinimo?: number | null
}

export interface RegistrarCompraAccInput {
  proveedor?: string | null
  lineas: LineaCompra[]
  pago: { efectivo?: number; transferencia?: number; usd?: number }
  operador?: string | null
  createdById?: string | null
  obs?: string | null
}

function norm(s: string | null | undefined) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

async function nextCode(tx: any): Promise<string> {
  // Correlativo por operación, no por línea (ERP regla 9): cada compra crea
  // varias filas AccessoryPurchase que comparten el mismo `code`. Advisory
  // lock transaccional para que dos compras simultáneas no tomen el mismo N°.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'correlativo:CAC'}))`
  const rows: { code: string }[] = await tx.accessoryPurchase.findMany({
    distinct: ['code'],
    select: { code: true },
    where: { code: { startsWith: 'CAC-' } },
  })
  return `CAC-${String(rows.length + 1).padStart(4, '0')}`
}

export async function registrarCompraAccesorios(input: RegistrarCompraAccInput) {
  const lineas = (input.lineas || []).filter(l => l.producto?.trim() && l.cantidad > 0 && l.costoUnit >= 0)
  if (lineas.length === 0) throw new CompraAccError('Cargá al menos una línea con producto y cantidad.')

  const costoTotal = lineas.reduce((s, l) => s + l.cantidad * l.costoUnit, 0)

  const usdRate = (await dolarActual()).venta || 1000
  const ef = Math.round(input.pago.efectivo || 0)
  const tr = Math.round(input.pago.transferencia || 0)
  const us = Number(input.pago.usd || 0)
  const pagoTotal = ef + tr + Math.round(us * usdRate)

  if (Math.abs(pagoTotal - costoTotal) > 1) {
    throw new CompraAccError(
      `Lo pagado (${fmt(pagoTotal)}) no coincide con el costo total (${fmt(costoTotal)}).`,
    )
  }

  const result = await prisma.$transaction(async tx => {
    const code = await nextCode(tx)

    for (const l of lineas) {
      // Resolver o crear el accesorio por combinación normalizada.
      const candidatos = await tx.accessory.findMany({
        where: { category: { equals: l.categoria, mode: 'insensitive' }, name: { equals: l.producto, mode: 'insensitive' } },
      })
      let acc = candidatos.find(
        c => norm(c.brand) === norm(l.marca) && norm(c.color) === norm(l.color),
      ) || null

      if (!acc) {
        acc = await tx.accessory.create({
          data: {
            name: l.producto.trim(),
            category: l.categoria.trim(),
            brand: l.marca?.trim() || null,
            color: l.color?.trim() || null,
            price: l.precioVenta || Math.round(l.costoUnit * 1.8),
            cost: l.costoUnit,
            lastCost: l.costoUnit,
            stock: l.cantidad,
            isActive: true,
          },
        })
      } else {
        // Costo promedio ponderado.
        const stockPrev = acc.stock || 0
        const costoPrev = acc.cost || 0
        const nuevoStock = stockPrev + l.cantidad
        const promedio = nuevoStock > 0
          ? Math.round((stockPrev * costoPrev + l.cantidad * l.costoUnit) / nuevoStock)
          : l.costoUnit
        acc = await tx.accessory.update({
          where: { id: acc.id },
          data: {
            stock: nuevoStock,
            cost: promedio,
            lastCost: l.costoUnit,
            ...(l.precioVenta ? { price: l.precioVenta } : {}),
            deletedAt: null,
            isActive: true,
          },
        })
      }

      await tx.accessoryPurchase.create({
        data: {
          code,
          proveedor: input.proveedor || null,
          accessoryId: acc.id,
          categoria: l.categoria,
          producto: l.producto,
          cantidad: l.cantidad,
          costoUnit: l.costoUnit,
          precioVenta: l.precioVenta || null,
          operator: input.operador || null,
          createdById: input.createdById || null,
        },
      })
    }

    // Asiento EGRESO por medio de pago.
    const medios: { pm: 'EFECTIVO' | 'TRANSFERENCIA' | 'USD'; ars: number; usd: number }[] = []
    if (ef > 0) medios.push({ pm: 'EFECTIVO', ars: ef, usd: 0 })
    if (tr > 0) medios.push({ pm: 'TRANSFERENCIA', ars: tr, usd: 0 })
    if (us > 0) medios.push({ pm: 'USD', ars: Math.round(us * usdRate), usd: us })
    for (const m of medios) {
      await registerEntry({
        source: 'COMPRA_ACC',
        operationId: code,
        description: `Compra de accesorios ${code}${input.proveedor ? ' — ' + input.proveedor : ''} (${lineas.length} líneas)`,
        category: 'COMPRA_ACCESORIOS',
        type: 'EGRESO',
        means: m.pm,
        amount: m.pm === 'USD' ? 0 : m.ars,
        amountUsd: m.pm === 'USD' ? m.usd : null,
        operator: input.operador || null,
        createdById: input.createdById || null,
      }, tx)
    }

    return { code, lineas: lineas.length, costoTotal }
  })

  return result
}

function fmt(n: number) {
  return '$' + (n || 0).toLocaleString('es-AR')
}
