import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { normalizeStatus, saldoPendiente, PENDIENTE_ENTREGA } from '@/lib/preventas'
import { dolarActual } from '@/lib/dolar-server'

/**
 * Ficha de cliente 360 (ERP §11 — brecha "entidad Cliente real"): consolida en
 * una sola vista todo lo que un cliente tiene en el sistema — pedidos online,
 * ventas de mostrador, reparaciones, preventas, cotizaciones de usados,
 * garantías, cupones y billetera — sin cambiar cómo se cargan (el cliente sigue
 * siendo texto libre por operación; acá se agrupa por el `userId` cuando existe).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true, dni: true, role: true,
        active: true, verified: true, createdAt: true,
        direccion: true, piso: true, ciudad: true, provincia: true, cp: true,
      },
    })
    if (!user) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const [orders, sales, repairs, preOrders, quotes, guarantees, coupons, wallet] = await Promise.all([
      prisma.order.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, code: true, status: true, total: true, warranty: true, createdAt: true, saleChannel: true },
      }),
      prisma.sale.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, code: true, device: true, price: true, profitReal: true, status: true, payment: true, createdAt: true },
      }),
      prisma.repair.findMany({
        where: { userId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, code: true, device: true, issue: true, status: true, type: true, pricePaid: true, profitReal: true, deliveredAt: true, createdAt: true },
      }),
      prisma.preOrder.findMany({
        where: { OR: [{ userId: id }, { createdById: id }], deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quote.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, code: true, device: true, status: true, createdAt: true },
      }),
      prisma.guarantee.findMany({
        where: { userId: id },
        orderBy: { expiresAt: 'desc' },
        select: { id: true, product: true, type: true, price: true, startsAt: true, expiresAt: true, status: true },
      }),
      prisma.coupon.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, code: true, status: true, originalAmount: true, remainingAmount: true, expiresAt: true, usedAt: true, createdAt: true },
      }),
      prisma.wallet.findUnique({
        where: { userId: id },
        select: {
          balance: true,
          transactions: { orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, type: true, amount: true, description: true, createdAt: true } },
        },
      }),
    ])

    const usdRate = (await dolarActual().catch(() => null))?.venta || 1000
    const preventas = preOrders.map(p => ({
      id: p.id,
      code: p.code,
      estado: normalizeStatus(p.status),
      modelo: p.productModelName || p.customName || '—',
      precio: p.price,
      cobrado: p.collectedArs + Math.round(p.collectedUsd * usdRate),
      saldo: saldoPendiente(p, usdRate),
      entregaDesde: p.expectedDeliveryStart,
      entregaHasta: p.expectedDeliveryEnd,
      createdAt: p.createdAt,
    }))

    const now = Date.now()
    const resumen = {
      pedidos: orders.length,
      ventas: sales.length,
      reparaciones: repairs.length,
      preventas: preventas.length,
      cotizaciones: quotes.length,
      gastoTotal:
        orders.filter(o => o.status !== 'CANCELLED').reduce((s, o) => s + o.total, 0) +
        sales.filter(s => s.status !== 'CANCELLED').reduce((s, v) => s + v.price, 0) +
        repairs.reduce((s, r) => s + (r.pricePaid || 0), 0),
      gananciaGenerada:
        sales.reduce((s, v) => s + (v.profitReal || 0), 0) +
        repairs.reduce((s, r) => s + (r.profitReal || 0), 0),
      preventasPendientes: preventas.filter(p => PENDIENTE_ENTREGA.includes(p.estado)).length,
      saldoPreventas: preventas.reduce((s, p) => s + p.saldo, 0),
      garantiasVigentes: guarantees.filter(g => g.status === 'ACTIVE' && new Date(g.expiresAt).getTime() > now).length,
      creditoCupones: coupons.filter(c => c.status === 'ACTIVE').reduce((s, c) => s + c.remainingAmount, 0),
      billetera: wallet?.balance || 0,
    }

    return NextResponse.json({
      user,
      resumen,
      orders,
      sales,
      repairs,
      preventas,
      quotes,
      guarantees,
      coupons,
      wallet: wallet || { balance: 0, transactions: [] },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
