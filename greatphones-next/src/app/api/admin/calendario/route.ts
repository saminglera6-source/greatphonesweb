import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'

// Calendario de pendientes: TODO lo que está sin resolver, agrupado por día.
// Reparaciones, preventas, pedidos online, cotizaciones y arrepentimientos.
// Además: contadores globales como el dashboard del ERP (preventas
// pendientes/compradas, reparaciones abiertas) y el href de destino de cada
// pendiente para poder navegar con un clic.
//
// Reprogramación: cada pendiente puede tener una fecha "reprogramada"
// (CalendarOverride) que reemplaza su fecha natural (createdAt, entrega
// prometida, etc) solo para efectos de en qué día del calendario aparece.
// Por eso las reparaciones/preventas/pedidos/cotizaciones/arrepentimientos
// se traen SIN filtro de fecha en la consulta y se ubican en el día que
// corresponda ya calculando la fecha efectiva en memoria.
export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes') // 'YYYY-MM'
    const c = mes ? new Date(mes + '-01T12:00:00') : new Date()
    const year = c.getFullYear()
    const month = c.getMonth()
    const inicio = new Date(year, month, 1, 0, 0, 0)
    const fin = new Date(year, month + 1, 1, 0, 0, 0)

    const iso = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${dd}`
    }

    const resumen: Record<string, Record<string, any[]>> = {}
    const push = (d: Date, tipo: string, item: any) => {
      const key = iso(d)
      if (!resumen[key]) resumen[key] = {}
      if (!resumen[key][tipo]) resumen[key][tipo] = []
      resumen[key][tipo].push(item)
    }

    // Overrides de reprogramación: mapa entityType -> Map(entityId -> fecha)
    const overrides = await prisma.calendarOverride.findMany()
    const overrideMap = new Map<string, Date>()
    for (const o of overrides) overrideMap.set(`${o.entityType}:${o.entityId}`, o.date)
    const efectiva = (tipo: string, id: string, fechaNatural: Date) =>
      overrideMap.get(`${tipo}:${id}`) || fechaNatural

    // Contadores globales (mismo criterio que el dashboard del ERP)
    const [repAbiertas, prevPend, prevCompradas, cotizPend, arrPend, pedidosPend] =
      await Promise.all([
        prisma.repair.count({
          where: {
            deletedAt: null,
            status: { in: ['PENDING', 'DIAGNOSIS', 'APPROVED', 'IN_PROGRESS', 'THIRD_PARTY'] },
          },
        }),
        prisma.preOrder.count({
          where: { deletedAt: null, status: { in: ['ESPERANDO_COMPRA', 'PENDING'] } },
        }),
        prisma.preOrder.count({
          where: {
            deletedAt: null,
            status: { in: ['COMPRADO', 'ENTREGADO_SALDO', 'PAID', 'CONFIRMED'] },
            deliveredAt: null,
          },
        }),
        prisma.quote.count({
          where: { deletedAt: null, status: { in: ['PENDING', 'REVIEWING'] } },
        }),
        prisma.arrepentimiento.count({ where: { estado: 'PENDIENTE' } }),
        prisma.order.count({ where: { status: { in: ['PROCESSING', 'SHIPPED'] } } }),
      ])
    const contadores = {
      reparaciones: repAbiertas,
      preventasPendientes: prevPend,
      preventasCompradas: prevCompradas,
      cotizaciones: cotizPend,
      arrepentimientos: arrPend,
      pedidos: pedidosPend,
    }

    // 1) Reparaciones activas (sin filtro de fecha: se ubican por fecha efectiva)
    const reparaciones = await prisma.repair.findMany({
      where: {
        deletedAt: null,
        status: { in: ['PENDING', 'DIAGNOSIS', 'APPROVED', 'IN_PROGRESS', 'THIRD_PARTY'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    })
    for (const r of reparaciones) {
      const fecha = efectiva('Reparaciones', r.id, r.createdAt)
      if (fecha >= inicio && fecha < fin)
        push(fecha, 'Reparaciones', {
          id: r.id,
          codigo: r.code,
          titulo: r.device,
          subtitulo: r.clientName || r.operator || r.fault1 || '—',
          hora: fecha.toISOString(),
          href: '/admin/taller/reparaciones/historial',
          reprogramado: overrideMap.has(`Reparaciones:${r.id}`),
        })
    }

    // 2) Preventas pendientes / por entregar (canónicos + alias legacy)
    const preventas = await prisma.preOrder.findMany({
      where: {
        deletedAt: null,
        status: {
          in: ['ESPERANDO_COMPRA', 'COMPRADO', 'ENTREGADO_SALDO', 'PENDING', 'PAID', 'CONFIRMED'],
        },
      },
      orderBy: { expectedDeliveryStart: 'asc' },
      take: 500,
    })
    for (const p of preventas) {
      const natural = p.expectedDeliveryStart || p.createdAt
      const fecha = efectiva('Preventas', p.id, natural)
      if (fecha >= inicio && fecha < fin) {
        const modelo = [p.productModelName, p.productStorage].filter(Boolean).join(' ')
        push(fecha, 'Preventas', {
          id: p.id,
          codigo: p.code,
          titulo: modelo || p.customName || 'Preventa',
          subtitulo: `${p.clientName || '—'}${p.productColor ? ' · ' + p.productColor : ''} · entrega hasta ${p.expectedDeliveryEnd ? p.expectedDeliveryEnd.toLocaleDateString('es-AR') : 'sin fecha'}`,
          hora: fecha.toISOString(),
          href: '/admin/ops/entregar-preventa',
          reprogramado: overrideMap.has(`Preventas:${p.id}`),
        })
      }
    }

    // 3) Pedidos online pendientes de entregar
    const pedidos = await prisma.order.findMany({
      where: {
        status: { in: ['PROCESSING', 'SHIPPED'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    })
    for (const o of pedidos) {
      const natural = o.shippedAt || o.createdAt
      const fecha = efectiva('Pedidos', o.id, natural)
      if (fecha >= inicio && fecha < fin)
        push(fecha, 'Pedidos', {
          id: o.id,
          codigo: o.code,
          titulo: `Pedido ${o.code}`,
          subtitulo: `${o.clientName || '—'} · ${o.status} · $${(o.total || 0).toLocaleString('es-AR')}`,
          hora: fecha.toISOString(),
          href: '/admin/pedidos',
          reprogramado: overrideMap.has(`Pedidos:${o.id}`),
        })
    }

    // 4) Cotizaciones pendientes
    const cotizaciones = await prisma.quote.findMany({
      where: {
        deletedAt: null,
        status: { in: ['PENDING', 'REVIEWING'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    })
    for (const q of cotizaciones) {
      const fecha = efectiva('Cotizaciones', q.id, q.createdAt)
      if (fecha >= inicio && fecha < fin)
        push(fecha, 'Cotizaciones', {
          id: q.id,
          codigo: q.code,
          titulo: q.device || 'Cotización',
          subtitulo: `${q.clientName || '—'} · ${q.storage || ''} ${q.condition || ''} · ${q.status}`,
          hora: fecha.toISOString(),
          href: '/admin/cotizaciones',
          reprogramado: overrideMap.has(`Cotizaciones:${q.id}`),
        })
    }

    // 5) Arrepentimientos pendientes
    const arrepentimientos = await prisma.arrepentimiento.findMany({
      where: { estado: 'PENDIENTE' },
      include: { order: { select: { code: true } } },
      orderBy: { createdAt: 'asc' },
      take: 500,
    })
    for (const a of arrepentimientos) {
      const fecha = efectiva('Arrepentimientos', a.id, a.createdAt)
      if (fecha >= inicio && fecha < fin)
        push(fecha, 'Arrepentimientos', {
          id: a.id,
          codigo: a.order?.code || a.id.slice(0, 8),
          titulo: 'Arrepentimiento',
          subtitulo: `${a.email || '—'}${a.motivo ? ' · ' + a.motivo : ''}`,
          hora: fecha.toISOString(),
          href: '/admin/arrepentimientos',
          reprogramado: overrideMap.has(`Arrepentimientos:${a.id}`),
        })
    }

    return NextResponse.json({ mes: iso(inicio).slice(0, 7), pendientes: resumen, contadores })
  } catch (error) {
    return handleRouteError(error)
  }
}
