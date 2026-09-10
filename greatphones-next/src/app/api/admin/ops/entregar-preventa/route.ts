import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { dolarActual } from '@/lib/dolar-server'
import {
  entregarPreventa,
  PreventaError,
  saldoPendiente,
  normalizeStatus,
  PENDIENTE_ENTREGA,
} from '@/lib/preventas'
import { z } from 'zod'

const EntregaSchema = z.object({
  preOrderId: z.string().min(1, 'Seleccioná una preventa'),
  fecha: z.string().optional(),
  efectivo: z.number().int().min(0).default(0),
  transferencia: z.number().int().min(0).default(0),
  cuotas: z.number().int().min(0).default(0),
  usd: z.number().min(0).default(0),
  accesorios: z.array(z.object({ nombre: z.string(), precio: z.number().int().default(0) })).optional(),
  equipo: z
    .object({
      imei: z.string().optional().nullable(),
      costo: z.number().int().min(0),
      proveedor: z.string().optional().nullable(),
      color: z.string().optional().nullable(),
      storage: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  confirmarDeuda: z.boolean().optional(),
  obs: z.string().optional(),
  // ERP regla 100/102: operador declarado explícito en toda operación.
  operador: z.preprocess(v => v ?? '', z.string().min(1, 'Seleccioná el operador')),
})

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const preorders = await prisma.preOrder.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { product: true, inventoryItem: { select: { id: true, imei: true, modelName: true } } },
    })
    const usdRate = (await dolarActual()).compra || 1000
    const pendientes = preorders
      .map(p => ({ ...p, status: normalizeStatus(p.status) }))
      .filter(p => PENDIENTE_ENTREGA.includes(p.status))
      .map(p => ({
        ...p,
        saldo: saldoPendiente(p, usdRate),
        tieneEquipo: !!p.inventoryItemId,
      }))
    return NextResponse.json(pendientes)
  } catch (error) {
    console.error('[Ops Entrega GET]', error)
    return NextResponse.json({ error: 'Error al obtener preventas para entrega' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const body = await request.json()
    const parsed = EntregaSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )
    const d = parsed.data

    const res = await entregarPreventa({
      preOrderId: d.preOrderId,
      cobro: { efectivo: d.efectivo, transferencia: d.transferencia, cuotas: d.cuotas, usd: d.usd },
      accesorios: d.accesorios,
      equipo: d.equipo || null,
      confirmarDeuda: d.confirmarDeuda,
      fecha: d.fecha,
      obs: d.obs,
      operador: d.operador,
      createdById: admin.id,
    })

    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    if (error instanceof PreventaError)
      return NextResponse.json(
        { error: error.message, needsConfirm: error.status === 409 },
        { status: error.status },
      )
    console.error('[Ops Entrega POST]', error)
    return NextResponse.json({ error: 'Error al registrar la entrega' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const body = await request.json()
    const { preOrderId, operador, motivo } = body

    if (!preOrderId) {
      return NextResponse.json({ error: 'ID de preventa requerido' }, { status: 400 })
    }

    const pre = await prisma.preOrder.findUnique({ where: { id: preOrderId } })
    if (!pre) {
      return NextResponse.json({ error: 'Preventa no encontrada' }, { status: 404 })
    }

    const notasActualizadas =
      (pre.notes || '') +
      ` | Eliminada ${new Date().toISOString()} por ${operador || admin.id} — Motivo: ${motivo || 'Sin especificar'}`

    await prisma.preOrder.update({
      where: { id: pre.id },
      data: {
        deletedAt: new Date(),
        deletedBy: operador || admin.id,
        deleteReason: motivo || null,
        notes: notasActualizadas,
      },
    })

    // TODO (Fase 3 — gobierno de anulación): marcar los asientos ANULADO en vez
    // de borrarlos. Por ahora se eliminan para que dejen de sumar en Caja.
    await prisma.accountingEntry.deleteMany({ where: { operationId: pre.code } }).catch(() => {})

    return NextResponse.json({ success: true, code: pre.code }, { status: 200 })
  } catch (error) {
    console.error('[Ops Entrega DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar la preventa' }, { status: 500 })
  }
}
