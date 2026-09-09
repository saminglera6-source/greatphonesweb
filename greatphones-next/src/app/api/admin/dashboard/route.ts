import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { dolarActual } from '@/lib/dolar-server'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const CACHE_TTL_MS = 60_000
let _cache: { data: unknown; ts: number } | null = null

const MEANS_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  CUOTAS: 'Cuotas',
  USD: 'USD',
  PAGO_ONLINE: 'Online',
}

// Ventas locales registradas (Registrar Venta) + preventas entregadas, para que
// el Dashboard no cuente las preventas dos veces (solo suma cuando se entregan).
async function kpiVentasLocal(gte: Date, lt: Date) {
  const [ventasRow, ventasCount, preDlv] = await Promise.all([
    prisma.accountingEntry.aggregate({
      where: { source: 'VENTA', type: 'INGRESO', opDate: { gte, lt } },
      _sum: { amount: true, amountUsd: true },
    }),
    prisma.accountingEntry.groupBy({
      by: ['operationId'],
      where: { source: 'VENTA', type: 'INGRESO', opDate: { gte, lt } },
      _count: { _all: true },
    }),
    prisma.preOrder.aggregate({
      where: { status: 'DELIVERED', deliveredAt: { gte, lt } },
      _sum: { price: true },
      _count: true,
    }),
  ])
  const usdRate = (await dolarActual()).compra || 1000
  const revenue =
    (ventasRow._sum.amount || 0) + Math.round((ventasRow._sum.amountUsd || 0) * usdRate) + (preDlv._sum.price || 0)
  const orders = ventasCount.length + preDlv._count
  return { revenue, orders }
}

async function ventasLocalesAnio(startOfYear: Date) {
  const [ventas, preDlv] = await Promise.all([
    prisma.accountingEntry.findMany({
      where: { source: 'VENTA', type: 'INGRESO', opDate: { gte: startOfYear } },
      select: { amount: true, amountUsd: true, means: true, opDate: true },
    }),
    prisma.preOrder.findMany({
      where: { status: 'DELIVERED', deliveredAt: { gte: startOfYear } },
      select: { price: true, deliveredAt: true },
    }),
  ])
  const usdRate = (await dolarActual()).compra || 1000
  const usdVentas = ventas
    .filter(v => v.amountUsd)
    .map(v => ({ ...v, pesos: Math.round((v.amountUsd || 0) * usdRate) }))
  return { ventas: ventas.filter(v => !v.amountUsd), usdVentas, preDlv, usdRate }
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request)

    if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
      return NextResponse.json(_cache.data)
    }

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = new Date(currentYear, now.getMonth(), 1)
    const lastMonth = new Date(currentYear, now.getMonth() - 1, 1)
    const nextMonth = new Date(currentYear, now.getMonth() + 1, 1)
    const startOfYear = new Date(currentYear, 0, 1)

    // KPIs - Current month (aggregate instead of findMany)
    const [currentAgg, lastAgg, currentLocal, lastLocal] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: currentMonth, lt: nextMonth } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: lastMonth, lt: currentMonth } },
        _sum: { total: true },
        _count: true,
      }),
      kpiVentasLocal(currentMonth, nextMonth),
      kpiVentasLocal(lastMonth, currentMonth),
    ])

    const currentRevenue = (currentAgg._sum.total || 0) + currentLocal.revenue
    const currentOrderCount = currentAgg._count + currentLocal.orders
    const lastRevenue = (lastAgg._sum.total || 0) + lastLocal.revenue
    const lastOrderCount = lastAgg._count + lastLocal.orders

    // Ticket average
    const avgTicket = currentOrderCount > 0 ? Math.round(currentRevenue / currentOrderCount) : 0
    const lastAvgTicket = lastOrderCount > 0 ? Math.round(lastRevenue / lastOrderCount) : 0

    // New users
    const [newUsers, lastNewUsers] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: currentMonth } } }),
      prisma.user.count({ where: { createdAt: { gte: lastMonth, lt: currentMonth } } }),
    ])

    // Monthly stats - fetch orders (with items+cost) and users for the year in parallel
    const [yearOrders, yearUsers, localAnio] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: startOfYear } },
        select: {
          total: true,
          createdAt: true,
          payment: true,
          items: {
            select: {
              price: true,
              quantity: true,
              customPrice: true,
              productId: true,
              product: { select: { cost: true } },
            },
          },
        },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: startOfYear } },
        select: { createdAt: true },
      }),
      ventasLocalesAnio(startOfYear),
    ])

    // Compute profit per order and index by month
    const ordersByMonth = new Map<number, { revenue: number; orders: number; profit: number }>()
    const paymentMap = new Map<string, { count: number; revenue: number; profit: number }>()

    yearOrders.forEach((o) => {
      const monthIndex = new Date(o.createdAt).getMonth()
      const existing = ordersByMonth.get(monthIndex) || { revenue: 0, orders: 0, profit: 0 }
      existing.revenue += o.total || 0
      existing.orders++

      // Compute profit for this order: sum(item.price*qty - cost*qty)
      let orderProfit = 0
      o.items.forEach((item) => {
        const qty = item.quantity || 1
        const cost = item.product?.cost || 0
        orderProfit += (item.price * qty) - (cost * qty)
      })
      existing.profit += orderProfit

      ordersByMonth.set(monthIndex, existing)

      // Payment breakdown
      const method = o.payment || 'Sin especificar'
      const pm = paymentMap.get(method) || { count: 0, revenue: 0, profit: 0 }
      pm.count++
      pm.revenue += o.total || 0
      pm.profit += orderProfit
      paymentMap.set(method, pm)
    })

    // Sumar ventas locales (Registrar Venta) al año por mes
    const lv = localAnio.ventas
    lv.forEach(v => {
      const monthIndex = new Date(v.opDate).getMonth()
      const existing = ordersByMonth.get(monthIndex) || { revenue: 0, orders: 0, profit: 0 }
      existing.revenue += v.amount || 0
      existing.orders++
      ordersByMonth.set(monthIndex, existing)
      const pm = paymentMap.get(MEANS_LABEL[v.means] || v.means || 'Efectivo') || { count: 0, revenue: 0, profit: 0 }
      pm.count++
      pm.revenue += v.amount || 0
      paymentMap.set(MEANS_LABEL[v.means] || v.means || 'Efectivo', pm)
    })
    localAnio.usdVentas.forEach(v => {
      const monthIndex = new Date(v.opDate).getMonth()
      const existing = ordersByMonth.get(monthIndex) || { revenue: 0, orders: 0, profit: 0 }
      existing.revenue += v.pesos
      existing.orders++
      ordersByMonth.set(monthIndex, existing)
      const pm = paymentMap.get('USD') || { count: 0, revenue: 0, profit: 0 }
      pm.count++
      pm.revenue += v.pesos
      paymentMap.set('USD', pm)
    })
    // Preventas entregadas: se cuentan UNA vez (sin el anticipo de registro)
    localAnio.preDlv.forEach(p => {
      const monthIndex = new Date(p.deliveredAt as Date).getMonth()
      const existing = ordersByMonth.get(monthIndex) || { revenue: 0, orders: 0, profit: 0 }
      existing.revenue += p.price
      existing.orders++
      ordersByMonth.set(monthIndex, existing)
      const pm = paymentMap.get('Preventa (entrega)') || { count: 0, revenue: 0, profit: 0 }
      pm.count++
      pm.revenue += p.price
      paymentMap.set('Preventa (entrega)', pm)
    })

    // Index users by month using Map for O(1) lookups
    const usersByMonth = new Map<number, number>()
    yearUsers.forEach((u) => {
      const monthIndex = new Date(u.createdAt).getMonth()
      usersByMonth.set(monthIndex, (usersByMonth.get(monthIndex) || 0) + 1)
    })

    // Build monthly stats with O(1) lookups instead of O(n) iterations
    const monthlyStats = MONTHS.map((month, i) => {
      const orderData = ordersByMonth.get(i) || { revenue: 0, orders: 0, profit: 0 }
      const userCount = usersByMonth.get(i) || 0
      return {
        month,
        monthIndex: i,
        revenue: orderData.revenue,
        orders: orderData.orders,
        profit: orderData.profit,
        avgTicket: orderData.orders > 0 ? Math.round(orderData.revenue / orderData.orders) : 0,
        newUsers: userCount,
      }
    })

    // Annual totals
    const annualRevenue = monthlyStats.reduce((sum, m) => sum + m.revenue, 0)
    const annualOrders = monthlyStats.reduce((sum, m) => sum + m.orders, 0)
    const annualProfit = monthlyStats.reduce((sum, m) => sum + m.profit, 0)
    const annualAvgTicket = annualOrders > 0 ? Math.round(annualRevenue / annualOrders) : 0
    const annualUsers = monthlyStats.reduce((sum, m) => sum + m.newUsers, 0)

    // Payment breakdown
    const paymentBreakdown = Array.from(paymentMap.entries())
      .map(([method, data]) => ({ method, ...data }))
      .sort((a, b) => b.revenue - a.revenue)

    // Recent orders, top products, and low stock - all independent, run in parallel
    const [recentOrders, topProducts, lowStockProducts, lowStockAccessories] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          code: true,
          clientName: true,
          clientEmail: true,
          total: true,
          status: true,
          payment: true,
          createdAt: true,
          items: {
            select: {
              price: true,
              quantity: true,
              productId: true,
              product: { select: { cost: true } },
            },
          },
        },
      }),
      prisma.product.findMany({
        orderBy: { sold: 'desc' },
        take: 3,
        where: { sold: { gt: 0 } },
        select: {
          id: true,
          name: true,
          sub: true,
          brand: true,
          sold: true,
          imageUrl: true,
          ico: true,
        },
      }),
      prisma.product.findMany({
        where: { stock: { lte: 3 } },
        orderBy: { stock: 'asc' },
        take: 5,
        select: {
          id: true,
          name: true,
          brand: true,
          stock: true,
          imageUrl: true,
          ico: true,
        },
      }),
      prisma.accessory.findMany({
        where: { stock: { lte: 3 }, isActive: true },
        orderBy: { stock: 'asc' },
        take: 5,
        select: {
          id: true,
          name: true,
          brand: true,
          stock: true,
          imageUrl: true,
          ico: true,
        },
      }),
    ])

    // Order statuses distribution — single groupBy instead of 5 individual counts
    const statusCounts = await prisma.order.groupBy({
      by: ['status'],
      _count: { status: true },
    })
    const allStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']
    const statusMap = new Map(statusCounts.map((s: any) => [s.status, Number(s._count.status)]))
    const orderStatuses = allStatuses.map(status => ({
      status,
      count: statusMap.get(status) || 0,
    }))

    // Sales by brand - optimized with groupBy
    const brandSalesData = await prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
    })

    const brandMap: Record<string, number> = {}
    const productIds = brandSalesData.map((b) => b.productId).filter((id): id is string => id !== null)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, brand: true },
    })
    const productBrandMap: Record<string, string> = {}
    products.forEach((p) => { productBrandMap[p.id] = p.brand || 'Otros' })

    brandSalesData.forEach((item) => {
      if (!item.productId) return
      const brand = productBrandMap[item.productId] || 'Otros'
      brandMap[brand] = (brandMap[brand] || 0) + (item._sum.quantity || 0)
    })

    const brandSales = Object.entries(brandMap)
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    // ── Dimensión financiera (ERP §4.16): caja, preventas, reparaciones ──
    const { getCashBalances } = await import('@/lib/accounting')
    const { lastHealthCheck } = await import('@/lib/health')
    const [cashBalances, preComprado, preEsperando, preSaldo, repAbiertas, gananciaMesRows, health] =
      await Promise.all([
        getCashBalances(),
        prisma.preOrder.count({ where: { deletedAt: null, status: { in: ['COMPRADO', 'PAID', 'CONFIRMED'] } } }),
        prisma.preOrder.count({ where: { deletedAt: null, status: { in: ['ESPERANDO_COMPRA', 'PENDING'] } } }),
        prisma.preOrder.count({ where: { deletedAt: null, status: 'ENTREGADO_SALDO' } }),
        prisma.repair.count({
          where: { deletedAt: null, status: { in: ['PENDING', 'DIAGNOSIS', 'APPROVED', 'IN_PROGRESS', 'THIRD_PARTY'] } },
        }),
        prisma.sale.findMany({
          where: { status: 'COMPLETED', createdAt: { gte: currentMonth, lt: nextMonth } },
          select: { profitReal: true },
        }),
        lastHealthCheck(),
      ])
    const cajaArs = cashBalances
      .filter(b => b.means !== 'USD')
      .reduce((s, b) => s + b.balance, 0)
    const cajaUsd = cashBalances.find(b => b.means === 'USD')?.balanceUsd || 0
    const gananciaCobradaMes = gananciaMesRows.reduce((s, r) => s + (r.profitReal || 0), 0)

    const finanzas = {
      caja: {
        ars: cajaArs,
        usd: cajaUsd,
        porMedio: cashBalances.map(b => ({ means: b.means, balance: b.balance, balanceUsd: b.balanceUsd })),
      },
      gananciaCobradaMes,
      preventas: { esperandoCompra: preEsperando, compradas: preComprado, conSaldo: preSaldo },
      reparacionesAbiertas: repAbiertas,
      salud: health
        ? { status: health.status, warning: health.warning, error: health.error, critical: health.critical, runAt: health.runAt }
        : null,
    }

    // Calculate percentages
    const revenueChange = lastRevenue > 0 ? Math.round(((currentRevenue - lastRevenue) / lastRevenue) * 100) : 0
    const ordersChange = lastOrderCount > 0 ? Math.round(((currentOrderCount - lastOrderCount) / lastOrderCount) * 100) : 0
    const ticketChange = lastAvgTicket > 0 ? Math.round(((avgTicket - lastAvgTicket) / lastAvgTicket) * 100) : 0
    const usersChange = lastNewUsers > 0 ? Math.round(((newUsers - lastNewUsers) / lastNewUsers) * 100) : 0

    const payload = {
      revenue: currentRevenue,
      revenueChange,
      orders: currentOrderCount,
      ordersChange,
      avgTicket,
      ticketChange,
      newUsers,
      usersChange,
      finanzas,
      monthlyStats,
      annualStats: {
        revenue: annualRevenue,
        orders: annualOrders,
        profit: annualProfit,
        avgTicket: annualAvgTicket,
        newUsers: annualUsers,
      },
      paymentBreakdown,
      recentOrders: recentOrders.map((o) => {
        let profit = 0
        o.items.forEach((item) => {
          const qty = item.quantity || 1
          const cost = item.product?.cost || 0
          profit += (item.price * qty) - (cost * qty)
        })
        return {
          id: o.code,
          client: o.clientName || o.clientEmail || 'N/A',
          total: o.total,
          status: o.status,
          payment: o.payment || null,
          profit,
          date: o.createdAt.toISOString(),
        }
      }),
      topProducts: topProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sub: p.sub,
        brand: p.brand,
        sold: p.sold,
        imageUrl: p.imageUrl,
        ico: p.ico,
      })),
      lowStock: [
        ...lowStockProducts.map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          stock: p.stock,
          imageUrl: p.imageUrl,
          ico: p.ico,
          type: 'producto',
        })),
        ...lowStockAccessories.map((a) => ({
          id: a.id,
          name: a.name,
          brand: a.brand || '',
          stock: a.stock,
          imageUrl: a.imageUrl,
          ico: a.ico || '📦',
          type: 'accesorio',
        })),
      ]
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 5),
      orderStatuses: orderStatuses.filter(s => s.count > 0),
      brandSales,
    }

    _cache = { data: payload, ts: Date.now() }
    return NextResponse.json(payload)
  } catch (error) { return handleRouteError(error) }
}
