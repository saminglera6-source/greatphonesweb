import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { getCashBalances } from '@/lib/accounting'

/**
 * Reportes consolidados: TODOS los ingresos del sistema, de todos los
 * canales (online y local).
 *
 * Fuentes:
 *  - Caja: saldos por medio de pago (efectivo/transferencia/USD/cuotas).
 *  - Libro Diario (AccountingEntry): ingresos y egresos de todos los módulos
 *    (SALE/REPAIR/PREORDER/ONLINE/GASTO/...).
 *  - Pedidos online (Order): ventas pagadas de la tienda online.
 * Se agrupa por canal: ONLINE (web) vs LOCAL (local/tienda física).
 */
const ONLINE_SOURCES = ['ONLINE', 'PREORDER']
const LOCAL_INGRESO_SOURCES = ['SALE', 'REPAIR', 'PURCHASE']

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')

    const range: { gte?: Date; lte?: Date } = {}
    if (desde) range.gte = new Date(desde + 'T00:00:00')
    if (hasta) range.lte = new Date(hasta + 'T23:59:59')
    const whereDate = Object.keys(range).length ? { opDate: range } : {}

    // 1) Saldos de caja — getCashBalances ya excluye los asientos ANULADO.
    const balances = await getCashBalances()

    // 2) Consolidado de Libro Diario por source y tipo (solo asientos ACTIVO)
    const entriesRaw = await prisma.accountingEntry.findMany({
      where: { ...whereDate, status: 'ACTIVO' },
      select: {
        source: true,
        type: true,
        amount: true,
        amountUsd: true,
        means: true,
        operationId: true,
        description: true,
        operator: true,
        opDate: true,
        id: true,
        createdAt: true,
      },
      orderBy: { opDate: 'desc' },
    })
    const entries = entriesRaw

    const resumen = new Map<string, { ingresos: number; egresos: number; cantidad: number }>()
    for (const e of entries) {
      const key = e.source || 'OTRO'
      let r = resumen.get(key)
      if (!r) {
        r = { ingresos: 0, egresos: 0, cantidad: 0 }
        resumen.set(key, r)
      }
      if (e.type === 'INGRESO') r.ingresos += e.amount || 0
      if (e.type === 'EGRESO') r.egresos += e.amount || 0
      r.cantidad++
    }

    // 3) Pedidos online pagados (ventas web confirmadas)
    const pedidosOnline = await prisma.order.findMany({
      where: {
        ...(desde || hasta
          ? {
              createdAt: {
                ...(desde ? { gte: new Date(desde + 'T00:00:00') } : {}),
                ...(hasta ? { lte: new Date(hasta + 'T23:59:59') } : {}),
              },
            }
          : {}),
        status: { in: ['PROCESSING', 'SHIPPED', 'DELIVERED'] },
        saleChannel: { not: 'instore' },
      },
      select: { total: true, status: true, saleChannel: true, code: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    const totalOnline = pedidosOnline.reduce((s, o) => s + (o.total || 0), 0)

    // 4) Totales por canal
    const onlineIngresos = entries
      .filter(e => ONLINE_SOURCES.includes(e.source) && e.type === 'INGRESO')
      .reduce((s, e) => s + (e.amount || 0), 0)
    const localIngresos = entries
      .filter(e => LOCAL_INGRESO_SOURCES.includes(e.source) && e.type === 'INGRESO')
      .reduce((s, e) => s + (e.amount || 0), 0)
    const localOtrosIngresos = entries
      .filter(
        e =>
          !ONLINE_SOURCES.includes(e.source) &&
          !LOCAL_INGRESO_SOURCES.includes(e.source) &&
          e.type === 'INGRESO',
      )
      .reduce((s, e) => s + (e.amount || 0), 0)
    const egresos = entries
      .filter(e => e.type === 'EGRESO')
      .reduce((s, e) => s + (e.amount || 0), 0)

    const canales = {
      online: {
        total: onlineIngresos,
        cantidad: entries.filter(e => ONLINE_SOURCES.includes(e.source) && e.type === 'INGRESO')
          .length,
      },
      local: {
        total: localIngresos,
        cantidad: entries.filter(
          e => LOCAL_INGRESO_SOURCES.includes(e.source) && e.type === 'INGRESO',
        ).length,
      },
      otros: {
        total: localOtrosIngresos,
        cantidad: entries.filter(
          e =>
            !ONLINE_SOURCES.includes(e.source) &&
            !LOCAL_INGRESO_SOURCES.includes(e.source) &&
            e.type === 'INGRESO',
        ).length,
      },
      egresos: { total: egresos, cantidad: entries.filter(e => e.type === 'EGRESO').length },
    }

    return NextResponse.json({
      balances,
      resumen: Array.from(resumen.entries()).map(([source, v]) => ({ source, ...v })),
      canales,
      pedidosOnline: {
        total: totalOnline,
        cantidad: pedidosOnline.length,
        items: pedidosOnline.slice(0, 50),
      },
      entries: entries.slice(0, 300),
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
