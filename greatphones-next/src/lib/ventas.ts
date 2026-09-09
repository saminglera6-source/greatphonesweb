import { prisma } from '@/lib/prisma'
import { registerEntry } from '@/lib/accounting'
import { auditar } from '@/lib/audit'
import { dolarActual } from '@/lib/dolar-server'
import { getGiftRules, matchGiftRule } from '@/lib/config'

/**
 * Venta de un equipo (ERP §4.2, reglas 27-33).
 *
 * Servicio único: selecciona una unidad concreta de inventario cuando existe
 * (no vende contra el contador agregado), toma el costo real de esa unidad,
 * valida que lo cobrado cuadre con el total de la operación, prorratea el cobro
 * entre el equipo y los accesorios, calcula ganancia teórica y cobrada, y
 * evalúa el regalo automático. Todo dentro de una transacción.
 */

export class VentaError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'VentaError'
    this.status = status
  }
}

interface Accesorio {
  nombre: string
  precio: number
}
interface Cobro {
  efectivo?: number
  transferencia?: number
  cuotas?: number
  usd?: number // cantidad de dólares reales
}

export interface RegistrarVentaInput {
  productId: string
  /** Unidad serializada concreta. Si no se pasa y el producto tiene unidades
   *  IN_STOCK, se toma la más antigua (FIFO). */
  inventoryItemId?: string | null
  precioVenta: number
  cliente: string
  cuil?: string | null
  tel?: string | null
  vendedor?: string | null
  operador?: string | null
  createdById?: string | null
  cobro: Cobro
  accesorios?: Accesorio[]
  entregarRegalos?: boolean
  obs?: string | null
}

type Medio = { pm: 'EFECTIVO' | 'TRANSFERENCIA' | 'CUOTAS' | 'USD'; ars: number; usd: number }

function mediosDeCobro(c: Cobro, usdRate: number): Medio[] {
  const out: Medio[] = []
  const push = (pm: Medio['pm'], v: number, usd = 0) => {
    if (v > 0 || usd > 0) out.push({ pm, ars: Math.round(v), usd })
  }
  push('EFECTIVO', c.efectivo || 0)
  push('TRANSFERENCIA', c.transferencia || 0)
  push('CUOTAS', c.cuotas || 0)
  const us = Number(c.usd || 0)
  if (us > 0) out.push({ pm: 'USD', ars: Math.round(us * usdRate), usd: us })
  return out
}

/** Prorratea cada medio de pago entre "equipo" y cada accesorio según su peso. */
function prorratear(medios: Medio[], pesoEquipo: number, pesosAcc: number[], total: number) {
  const items = [pesoEquipo, ...pesosAcc]
  return medios.map(m => {
    let acumArs = 0
    let acumUsd = 0
    const parts = items.map((valor, i) => {
      const isLast = i === items.length - 1
      if (total <= 0) return { ars: isLast ? m.ars - acumArs : 0, usd: isLast ? m.usd - acumUsd : 0 }
      const ars = isLast ? m.ars - acumArs : Math.round((m.ars * valor) / total)
      const usd = isLast ? Number((m.usd - acumUsd).toFixed(2)) : Number(((m.usd * valor) / total).toFixed(2))
      acumArs += ars
      acumUsd += usd
      return { ars, usd }
    })
    return { pm: m.pm, equipo: parts[0], accesorios: parts.slice(1) }
  })
}

function genCode(prefix: string) {
  return `${prefix}-` + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()
}

export async function registrarVenta(input: RegistrarVentaInput) {
  if (!input.cliente?.trim()) throw new VentaError('El cliente es obligatorio')
  if (!(input.precioVenta > 0)) throw new VentaError('El precio de venta debe ser mayor a 0')

  const producto = await prisma.product.findUnique({ where: { id: input.productId } })
  if (!producto || producto.deletedAt || producto.isPreorder) {
    throw new VentaError('Ese producto no está disponible')
  }

  // Unidad de inventario: la elegida, o la más antigua IN_STOCK.
  let unidad = null as Awaited<ReturnType<typeof prisma.inventoryItem.findFirst>> | null
  if (input.inventoryItemId) {
    unidad = await prisma.inventoryItem.findUnique({ where: { id: input.inventoryItemId } })
    if (!unidad || unidad.status !== 'IN_STOCK') throw new VentaError('Esa unidad no está disponible para la venta')
  } else {
    unidad = await prisma.inventoryItem.findFirst({
      where: { productId: producto.id, status: 'IN_STOCK' },
      orderBy: { purchaseDate: 'asc' },
    })
  }

  const disponibleContador = (producto.stock || 0) - (producto.reserved || 0)
  if (!unidad && disponibleContador < 1) {
    throw new VentaError('Sin stock disponible para ese producto')
  }

  const accs = (input.accesorios || []).filter(a => a.nombre && a.precio > 0)
  const totalAcc = accs.reduce((s, a) => s + a.precio, 0)
  const totalOperacion = input.precioVenta + totalAcc

  const usdRate = (await dolarActual()).compra || 1000
  const medios = mediosDeCobro(input.cobro, usdRate)
  const totalCobrado = medios.reduce((s, m) => s + m.ars, 0)

  // Regla 28: el cobro debe cuadrar con el total de la operación (±$1).
  if (Math.abs(totalCobrado - totalOperacion) > 1) {
    throw new VentaError(
      `Lo cobrado (${fmt(totalCobrado)}) no coincide con el total de la operación (${fmt(totalOperacion)} = equipo ${fmt(input.precioVenta)} + accesorios ${fmt(totalAcc)}).`,
    )
  }

  // Costo base y tipo de origen (regla 30).
  const costo = unidad ? unidad.purchasePrice : producto.cost || 0
  const enConsignacion = (unidad?.notes || '').toLowerCase().includes('consign')
  const originType = enConsignacion ? 'consignacion' : 'propio'
  const tipoGanancia = enConsignacion ? 'Comisión' : 'Ganancia directa'

  // Verificar stock de accesorios antes de la transacción.
  for (const a of accs) {
    const acc = await prisma.accessory.findFirst({ where: { name: a.nombre, isActive: true } })
    if (acc && (acc.stock || 0) - (acc.reserved || 0) < 1) {
      throw new VentaError(`Accesorio sin stock: ${a.nombre}`)
    }
  }

  const numero = genCode('VTA')
  const distrib = prorratear(medios, input.precioVenta, accs.map(a => a.precio), totalOperacion)

  const cobradoEquipoPesos = distrib.reduce((s, d) => s + d.equipo.ars, 0)
  const gananciaTeorica = input.precioVenta - costo
  const gananciaCobrada = cobradoEquipoPesos - costo

  const result = await prisma.$transaction(async tx => {
    // Descontar stock del equipo.
    await tx.product.update({
      where: { id: producto.id },
      data: { stock: { decrement: 1 }, sold: { increment: 1 } },
    })
    if (unidad) {
      await tx.inventoryItem.update({
        where: { id: unidad.id },
        data: { status: 'SOLD', soldAt: new Date(), soldById: input.createdById || null, salePrice: input.precioVenta },
      })
      await tx.inventoryHistory.create({
        data: { inventoryItemId: unidad.id, type: 'SOLD', oldValue: 'IN_STOCK', newValue: 'SOLD', description: `Venta ${numero} — ${input.cliente}`, userId: input.createdById || '' },
      })
    }

    // Sale (para Comisiones / ganancia).
    const userId = input.createdById || (await tx.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } }))?.id
    await tx.sale.create({
      data: {
        code: numero,
        userId: userId!,
        device: producto.name,
        storage: producto.storage || '',
        condition: producto.condition || '',
        imei: unidad?.imei || '',
        price: totalOperacion,
        cost: costo,
        profitReal: gananciaCobrada,
        originType,
        payment: medios[0]?.pm || 'Otro',
        status: 'COMPLETED',
        operator: input.operador || input.vendedor || 'SIN_OPERADOR',
      },
    })

    // Asientos INGRESO por medio — porción del equipo.
    for (const d of distrib) {
      if (d.equipo.ars <= 0 && d.equipo.usd <= 0) continue
      await registerEntry({
        source: 'VENTA',
        operationId: numero,
        description: `Venta de ${producto.name} a ${input.cliente}`,
        category: 'VENTA_PROPIA',
        type: 'INGRESO',
        means: d.pm,
        amount: d.pm === 'USD' ? 0 : d.equipo.ars,
        amountUsd: d.pm === 'USD' ? d.equipo.usd : null,
        operator: input.operador || input.vendedor || null,
        createdById: input.createdById || null,
        metadata: { productId: producto.id, accesorios: accs.map(a => a.nombre), tipoGanancia, originType },
      }, tx)
    }

    // Accesorios: descontar stock + asiento por su porción prorrateada.
    for (let i = 0; i < accs.length; i++) {
      const a = accs[i]
      await tx.accessory.updateMany({ where: { name: a.nombre, isActive: true }, data: { stock: { decrement: 1 }, sold: { increment: 1 } } }).catch(() => {})
      for (const d of distrib) {
        const part = d.accesorios[i]
        if (!part || (part.ars <= 0 && part.usd <= 0)) continue
        await registerEntry({
          source: 'VENTA_ACCESORIO',
          operationId: numero,
          description: `Venta ${numero} — accesorio ${a.nombre}`,
          category: 'VENTA_ACCESORIO',
          type: 'INGRESO',
          means: d.pm,
          amount: d.pm === 'USD' ? 0 : part.ars,
          amountUsd: d.pm === 'USD' ? part.usd : null,
          operator: input.operador || input.vendedor || null,
          createdById: input.createdById || null,
        }, tx)
      }
    }

    return { numero }
  })

  // Auditoría (fuera de la tx — no bloquea la venta si falla).
  await auditar({
    entityType: 'Product',
    entityId: producto.id,
    action: 'CREACION',
    reason: `Venta ${numero} de ${producto.name}`,
    operator: input.operador || input.vendedor || null,
    createdById: input.createdById || null,
    metadata: { operationId: numero, precio: input.precioVenta },
  }).catch(() => {})

  // Regalo automático (regla 87-91) — nunca bloquea la venta.
  let regalo: { accesorio: string; entregado: boolean; motivo?: string } | null = null
  if (input.entregarRegalos !== false) {
    try {
      const rules = await getGiftRules()
      const rule = matchGiftRule(rules, producto.name + ' ' + (producto.modelGroup || ''))
      if (rule) {
        const acc = await prisma.accessory.findFirst({
          where: {
            isActive: true,
            name: { contains: rule.accessoryName, mode: 'insensitive' },
            ...(rule.accessoryCategory ? { category: { equals: rule.accessoryCategory, mode: 'insensitive' } } : {}),
          },
        })
        if (acc && (acc.stock || 0) > 0) {
          await prisma.accessory.update({ where: { id: acc.id }, data: { stock: { decrement: 1 } } })
          await prisma.sale.create({
            data: {
              code: genCode('REG'),
              userId: (await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } }))!.id,
              device: `Regalo: ${acc.name}`,
              price: 0,
              cost: acc.cost || 0,
              profitReal: -(acc.cost || 0),
              payment: 'REGALO',
              status: 'COMPLETED',
              operator: input.operador || input.vendedor || 'SIN_OPERADOR',
            },
          })
          regalo = { accesorio: acc.name, entregado: true }
        } else {
          regalo = { accesorio: rule.accessoryName, entregado: false, motivo: 'sin stock' }
          await auditar({
            entityType: 'Product',
            entityId: producto.id,
            action: 'UPDATE',
            reason: `Regalo automático omitido (sin stock de ${rule.accessoryName}) en venta ${numero}`,
            operator: input.operador || null,
          }).catch(() => {})
        }
      }
    } catch (e) {
      console.error('[registrarVenta] regalo:', e)
    }
  }

  return {
    numero: result.numero,
    equipo: producto.name,
    precio: input.precioVenta,
    unidad: unidad?.imei || null,
    originType,
    tipoGanancia,
    gananciaTeorica,
    gananciaCobrada,
    totalOperacion,
    totalCobrado,
    regalo,
  }
}

function fmt(n: number) {
  return '$' + (n || 0).toLocaleString('es-AR')
}
