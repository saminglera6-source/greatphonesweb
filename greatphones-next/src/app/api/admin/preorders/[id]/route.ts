import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import {
  PRE,
  normalizeStatus,
  saldoPendiente,
  entregarPreventa,
  PreventaError,
} from '@/lib/preventas'
import { dolarActual } from '@/lib/dolar-server'

const CANON_STATUSES: string[] = [
  PRE.ESPERANDO_COMPRA,
  PRE.COMPRADO,
  PRE.ENTREGADO_SALDO,
  PRE.ENTREGADO,
  PRE.CANCELADO,
]

const INCLUDE_DEFAULT = {
  product: { select: { id: true, name: true, imageUrl: true, ico: true, price: true, cost: true, stock: true } },
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await params
    const preOrder = await prisma.preOrder.findUnique({ where: { id }, include: INCLUDE_DEFAULT })
    if (!preOrder) return NextResponse.json({ error: 'Preventa no encontrada' }, { status: 404 })
    const usdRate = (await dolarActual()).compra || 1000
    return NextResponse.json({
      ...preOrder,
      status: normalizeStatus(preOrder.status),
      saldo: saldoPendiente(preOrder, usdRate),
    })
  } catch (error) {
    console.error('Error fetching preorder:', error)
    return NextResponse.json({ error: 'Error al obtener preventa' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request)
    const { id } = await params
    const body = await request.json()
    const rawStatus: string | undefined = body.status
    const canonStatus = rawStatus ? normalizeStatus(rawStatus) : undefined

    const existing = await prisma.preOrder.findUnique({ where: { id }, select: { id: true, status: true } })
    if (!existing) return NextResponse.json({ error: 'Preventa no encontrada' }, { status: 404 })

    // Marcar entregado (botón "Entregar" del panel legacy "Preventa Online"):
    // pasa por el servicio unificado. El panel legacy no cobra en este paso,
    // así que la entrega se hace por el saldo ya cobrado (confirmando deuda si
    // queda pendiente). Para cobrar el saldo en la entrega, usar "Entregar Preventa".
    if (canonStatus === PRE.ENTREGADO && normalizeStatus(existing.status) !== PRE.ENTREGADO) {
      try {
        const res = await entregarPreventa({
          preOrderId: id,
          cobro: {},
          confirmarDeuda: true,
          operador: body.operador || null,
          createdById: admin.id,
        })
        const updated = await prisma.preOrder.findUnique({ where: { id }, include: INCLUDE_DEFAULT })
        return NextResponse.json({ success: true, preOrder: updated, entrega: res })
      } catch (err) {
        if (err instanceof PreventaError)
          return NextResponse.json({ error: err.message }, { status: err.status })
        throw err
      }
    }

    // Edición de campos (y cambios de estado que no son "entregar").
    const updateData: any = {}
    if (canonStatus && CANON_STATUSES.includes(canonStatus)) updateData.status = canonStatus
    if (body.clientName !== undefined) updateData.clientName = body.clientName
    if (body.clientDni !== undefined) updateData.clientDni = body.clientDni
    if (body.clientPhone !== undefined) updateData.clientPhone = body.clientPhone
    if (body.productModelName !== undefined) updateData.productModelName = body.productModelName
    if (body.price !== undefined) updateData.price = body.price
    if (body.sellerName !== undefined) updateData.sellerName = body.sellerName
    if (body.expectedDeliveryStart !== undefined)
      updateData.expectedDeliveryStart = body.expectedDeliveryStart ? new Date(body.expectedDeliveryStart) : null
    if (body.expectedDeliveryEnd !== undefined)
      updateData.expectedDeliveryEnd = body.expectedDeliveryEnd ? new Date(body.expectedDeliveryEnd) : null
    if (body.notes !== undefined) updateData.notes = body.notes
    if (canonStatus === PRE.CANCELADO) {
      updateData.deletedBy = body.operador || admin.id
      updateData.deleteReason = body.motivo || 'Cancelada'
    }

    const updated = await prisma.preOrder.update({
      where: { id },
      data: updateData,
      include: INCLUDE_DEFAULT,
    })
    return NextResponse.json({ ...updated, status: normalizeStatus(updated.status) })
  } catch (error) {
    console.error('Error updating preorder:', error)
    return NextResponse.json({ error: 'Error al actualizar preventa' }, { status: 500 })
  }
}
