import { prisma } from '@/lib/prisma'
import { recomputeCashRegisters } from '@/lib/accounting'
import type { PaymentMeans } from '@prisma/client'

/**
 * Anulación / restauración de operaciones (ERP §4.23, reglas 1, 10-15).
 *
 * Principios:
 *  - NUNCA se borra información. Anular = marcar estado + revertir efectos.
 *    Los asientos pasan a status ANULADO (no se eliminan); las entidades de
 *    negocio se marcan con soft-delete (`deletedAt`).
 *  - Toda anulación exige motivo, queda en `AuditLog` con snapshot completo, y
 *    se serializa con un advisory lock para no competir con otra anulación
 *    de la misma operación.
 *  - `restaurar` es la operación inversa exacta.
 *  - La corrección (anular + recrear vinculado) es una fase posterior.
 */

export class AnulacionError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'AnulacionError'
    this.status = status
  }
}

interface Ctx {
  operationId: string
  motivo: string
  operador?: string | null
  createdById?: string | null
}

const ALL_MEANS: PaymentMeans[] = ['EFECTIVO', 'TRANSFERENCIA', 'CUOTAS', 'USD', 'PAGO_ONLINE']

/** Lock consultivo por operación (se libera al cerrar la transacción). */
async function lockOperacion(tx: any, operationId: string) {
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `anul:${operationId}`)
}

// ══════════════════════════════════════════════════════════════════════════
//  ANULAR
// ══════════════════════════════════════════════════════════════════════════
export async function anularOperacion(ctx: Ctx) {
  if (!ctx.motivo?.trim()) throw new AnulacionError('El motivo de la anulación es obligatorio.')
  const opId = ctx.operationId.trim()

  return prisma.$transaction(async tx => {
    await lockOperacion(tx, opId)

    const entries = await tx.accountingEntry.findMany({
      where: { operationId: opId, status: 'ACTIVO' },
    })
    const item = await tx.inventoryItem.findUnique({
      where: { code: opId },
      include: { preOrder: true, product: true },
    })
    const sale = await tx.sale.findUnique({ where: { code: opId } })
    const preOrder = await tx.preOrder.findFirst({
      where: { OR: [{ code: opId }, { saleCode: opId }], deletedAt: null },
      include: { inventoryItem: true },
    })
    const repair = await tx.repair.findUnique({ where: { code: opId } })

    if (entries.length === 0 && !item && !sale && !preOrder && !repair) {
      throw new AnulacionError('No se encontró la operación.', 404)
    }

    const snapshot: any = { operationId: opId, entries, item, sale, preOrder, repair }
    const source = entries[0]?.source || ''
    const affectedMeans = new Set<PaymentMeans>(entries.map(e => e.means))

    // ── Reversión de efectos por tipo ──────────────────────────────────────
    // VENTA (equipo): devolver stock, reponer accesorios, soft-delete Sale,
    // equipo vuelve a IN_STOCK.
    if (source === 'VENTA' || sale) {
      const meta = (entries.find(e => e.source === 'VENTA')?.metadata as any) || {}
      if (meta.productId) {
        await tx.product
          .update({ where: { id: meta.productId }, data: { stock: { increment: 1 }, sold: { decrement: 1 } } })
          .catch(() => {})
      }
      if (Array.isArray(meta.accesorios)) {
        for (const nombre of meta.accesorios) {
          await tx.accessory.updateMany({
            where: { name: nombre, isActive: true },
            data: { stock: { increment: 1 }, sold: { decrement: 1 } },
          }).catch(() => {})
        }
      }
      if (sale?.imei) {
        await tx.inventoryItem.updateMany({ where: { imei: sale.imei, status: 'SOLD' }, data: { status: 'IN_STOCK', soldAt: null, soldById: null, salePrice: null } }).catch(() => {})
      }
      if (sale) {
        await tx.sale.update({ where: { id: sale.id }, data: { status: 'CANCELLED' } }).catch(() => {})
      }
    }

    // PREVENTA (registro o entrega): cancelar la preventa; si generó compra
    // automática, revertir el equipo.
    if (source === 'PREORDER' || source === 'PREVENTA_ENTREGA' || preOrder) {
      if (preOrder) {
        const est = preOrder.status
        if (est === 'ENTREGADO') {
          throw new AnulacionError(
            'No se puede anular una preventa entregada por completo. Anulá primero la venta asociada.',
          )
        }
        if (preOrder.saleCode) {
          await tx.sale.updateMany({ where: { code: preOrder.saleCode }, data: { status: 'CANCELLED' } }).catch(() => {})
        }
        if (preOrder.inventoryItem) {
          const notas = preOrder.inventoryItem.notes || ''
          const creadaConLaEntrega = notas.includes('al entregar la preventa') || notas.includes('Reservado para preventa')
          await tx.inventoryItem.update({
            where: { id: preOrder.inventoryItem.id },
            data: creadaConLaEntrega
              ? { status: 'ANULADO', notes: `${notas} | anulada con la preventa ${opId}` }
              : { status: 'IN_STOCK', soldAt: null, soldById: null, salePrice: null },
          }).catch(() => {})
        }
        await tx.preOrder.update({
          where: { id: preOrder.id },
          data: { status: 'CANCELADO', deletedAt: new Date(), deletedBy: ctx.operador || null, deleteReason: ctx.motivo },
        })
      }
    }

    // COMPRA (equipo): no se puede si ya fue vendido; si no, se da de baja.
    if ((source === 'COMPRA' || item) && item) {
      if (item.status === 'SOLD') {
        throw new AnulacionError('El equipo de esta compra ya fue vendido. Anulá primero la venta.')
      }
      if (item.status === 'IN_STOCK' && item.productId) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: 1 } } }).catch(() => {})
      }
      if (item.preOrder) {
        await tx.preOrder.update({
          where: { id: item.preOrder.id },
          data: { status: 'ESPERANDO_COMPRA', inventoryItemId: null },
        }).catch(() => {})
      }
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { status: 'ANULADO', notes: `${item.notes || ''} | Compra ${opId} anulada: ${ctx.motivo}` },
      })
      if (item.productId) {
        const otras = await tx.inventoryItem.count({
          where: { productId: item.productId, id: { not: item.id }, status: { not: 'ANULADO' } },
        })
        if (otras === 0) {
          await tx.product.update({
            where: { id: item.productId },
            data: { deletedAt: new Date(), deletedBy: ctx.operador || null, deleteReason: `Compra ${opId} anulada` },
          }).catch(() => {})
        }
      }
    }

    // REPARACIÓN: soft-delete.
    if ((source === 'REPAIR' || repair) && repair) {
      await tx.repair.update({
        where: { id: repair.id },
        data: { deletedAt: new Date(), deletedBy: ctx.operador || null, deleteReason: ctx.motivo },
      })
    }

    // ── Marcar los asientos ANULADO ───────────────────────────────────────
    if (entries.length > 0) {
      await tx.accountingEntry.updateMany({
        where: { operationId: opId, status: 'ACTIVO' },
        data: { status: 'ANULADO', voidedAt: new Date(), voidReason: ctx.motivo, voidedBy: ctx.operador || null },
      })
      await recomputeCashRegisters([...affectedMeans].length ? [...affectedMeans] : ALL_MEANS, tx)
    }

    // ── Auditoría ─────────────────────────────────────────────────────────
    await tx.auditLog.create({
      data: {
        entityType: 'AccountingEntry',
        entityId: opId,
        action: 'ANULACION',
        reason: ctx.motivo,
        operator: ctx.operador || null,
        createdById: ctx.createdById || null,
        snapshot: JSON.parse(JSON.stringify(snapshot)),
      },
    })

    return { ok: true, operacion: opId, asientos: entries.length, motivo: ctx.motivo }
  })
}

// ══════════════════════════════════════════════════════════════════════════
//  RESTAURAR
// ══════════════════════════════════════════════════════════════════════════
export async function restaurarOperacion(ctx: Omit<Ctx, 'motivo'> & { motivo?: string }) {
  const opId = ctx.operationId.trim()
  const motivo = ctx.motivo || 'Restauración'

  return prisma.$transaction(async tx => {
    await lockOperacion(tx, opId)

    const entries = await tx.accountingEntry.findMany({
      where: { operationId: opId, status: 'ANULADO' },
    })
    const item = await tx.inventoryItem.findUnique({ where: { code: opId }, include: { product: true, preOrder: true } })
    const sale = await tx.sale.findUnique({ where: { code: opId } })
    const preOrder = await tx.preOrder.findFirst({ where: { OR: [{ code: opId }, { saleCode: opId }] } })
    const repair = await tx.repair.findUnique({ where: { code: opId } })

    const itemAnulado = item?.status === 'ANULADO'
    if (entries.length === 0 && !itemAnulado && !preOrder?.deletedAt && !repair?.deletedAt) {
      throw new AnulacionError('No hay nada anulado para restaurar en esta operación.', 404)
    }

    const source = entries[0]?.source || ''
    const affectedMeans = new Set<PaymentMeans>(entries.map(e => e.means))

    // VENTA: volver a descontar stock, re-marcar equipo vendido.
    if (source === 'VENTA' || sale) {
      const meta = (entries.find(e => e.source === 'VENTA')?.metadata as any) || {}
      if (meta.productId) {
        const p = await tx.product.findUnique({ where: { id: meta.productId } })
        if (!p || p.stock < 1) throw new AnulacionError('El producto no tiene stock para restaurar esta venta.')
        await tx.product.update({ where: { id: meta.productId }, data: { stock: { decrement: 1 }, sold: { increment: 1 } } })
      }
      if (sale?.imei) {
        const inv = await tx.inventoryItem.findFirst({ where: { imei: sale.imei } })
        if (inv && inv.status === 'SOLD') throw new AnulacionError('El equipo fue vendido en otra operación mientras estaba anulada.')
        await tx.inventoryItem.updateMany({ where: { imei: sale.imei }, data: { status: 'SOLD', soldAt: new Date() } }).catch(() => {})
      }
      if (sale) await tx.sale.update({ where: { id: sale.id }, data: { status: 'COMPLETED' } }).catch(() => {})
    }

    // PREVENTA
    if (preOrder?.deletedAt) {
      await tx.preOrder.update({
        where: { id: preOrder.id },
        data: {
          status: preOrder.inventoryItemId ? 'COMPRADO' : 'ESPERANDO_COMPRA',
          deletedAt: null, deletedBy: null, deleteReason: null,
        },
      })
    }

    // COMPRA
    if (itemAnulado && item) {
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { status: 'IN_STOCK' },
      })
      if (item.productId) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: 1 }, deletedAt: null, deletedBy: null, deleteReason: null } }).catch(() => {})
      }
    }

    // REPARACIÓN
    if (repair?.deletedAt) {
      await tx.repair.update({ where: { id: repair.id }, data: { deletedAt: null, deletedBy: null, deleteReason: null } })
    }

    // Reactivar asientos
    if (entries.length > 0) {
      await tx.accountingEntry.updateMany({
        where: { operationId: opId, status: 'ANULADO' },
        data: { status: 'ACTIVO', voidedAt: null, voidReason: null, voidedBy: null },
      })
      await recomputeCashRegisters([...affectedMeans].length ? [...affectedMeans] : ALL_MEANS, tx)
    }

    await tx.auditLog.create({
      data: {
        entityType: 'AccountingEntry',
        entityId: opId,
        action: 'RESTAURACION',
        reason: motivo,
        operator: ctx.operador || null,
        createdById: ctx.createdById || null,
      },
    })

    return { ok: true, operacion: opId, asientos: entries.length }
  })
}
