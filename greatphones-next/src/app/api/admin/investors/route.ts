import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { registerEntry } from '@/lib/accounting'
import { enqueueSheetSync } from '@/lib/erp-sheet'
import { z } from 'zod'

const CreateInvestorSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  capital: z.number().int().min(0).default(0),
  yieldRate: z.number().int().min(0).max(100).optional(),
})

const MovementSchema = z.object({
  investorId: z.string().min(1, 'Inversor requerido'),
  type: z.enum(['INGRESO_CAPITAL', 'RETIRO_CAPITAL', 'PAGO_RENDIMIENTO', 'AJUSTE']),
  amount: z.number().int().positive('El monto debe ser positivo'),
  detail: z.string().optional(),
  operator: z.string().optional(),
})

const YieldSchema = z.object({
  investorId: z.string().min(1),
  month: z.string().min(1, 'Mes requerido (YYYY-MM)'),
  operator: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    // Panel dedicado de un inversor (ERP §3.17): capital, movimientos y la
    // tabla de rendimientos mensuales con su estado.
    if (id) {
      const inv = await prisma.investor.findUnique({
        where: { id },
        include: {
          movements: { orderBy: { createdAt: 'desc' } },
          yields: { orderBy: { period: 'desc' } },
        },
      })
      if (!inv) return NextResponse.json({ error: 'Inversor no encontrado' }, { status: 404 })
      const aportado = inv.movements.filter(m => m.type === 'INGRESO_CAPITAL').reduce((s, m) => s + m.amount, 0)
      const retirado = inv.movements.filter(m => m.type === 'RETIRO_CAPITAL').reduce((s, m) => s + m.amount, 0)
      return NextResponse.json({
        ...inv,
        resumen: {
          aportado,
          retirado,
          rendimientoDevengado: inv.yields.reduce((s, y) => s + y.amount, 0),
          rendimientoPagado: inv.paidTotal,
          rendimientoPendiente: inv.pending,
        },
      })
    }

    const investors = await prisma.investor.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: { movements: { orderBy: { createdAt: 'desc' }, take: 200 } },
    })
    return NextResponse.json(investors)
  } catch (error) {
    console.error('[Admin Investors GET]', error)
    return NextResponse.json({ error: 'Error al obtener inversores' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const body = await request.json()

    // Crear inversor
    if (body.action === 'create') {
      const parsed = CreateInvestorSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
      const investor = await prisma.investor.create({
        data: { name: parsed.data.name, capital: parsed.data.capital, yieldRate: parsed.data.yieldRate || 20 },
      })
      return NextResponse.json(investor, { status: 201 })
    }

    // Movimiento de capital / rendimiento
    if (body.action === 'move') {
      const parsed = MovementSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
      const d = parsed.data
      const inv = await prisma.investor.findUnique({ where: { id: d.investorId } })
      if (!inv) return NextResponse.json({ error: 'Inversor no encontrado' }, { status: 404 })

      let newCapital = inv.capital
      let newPending = inv.pending

      switch (d.type) {
        case 'INGRESO_CAPITAL':
          newCapital += d.amount
          break
        case 'RETIRO_CAPITAL':
          if (d.amount > inv.capital) return NextResponse.json({ error: 'El retiro supera el capital invertido' }, { status: 400 })
          newCapital -= d.amount
          break
        case 'PAGO_RENDIMIENTO':
          if (d.amount > inv.pending) return NextResponse.json({ error: 'El pago supera el rendimiento pendiente' }, { status: 400 })
          inv.paidTotal += d.amount
          newPending = inv.pending - d.amount
          break
        case 'AJUSTE':
          // Ajuste libre de capital (puede ser + o -)
          newCapital = Math.max(0, inv.capital + d.amount)
          break
      }

      // Movimiento + asiento en una sola transacción: si el asiento falla,
      // el movimiento y el nuevo capital se revierten (T-8).
      // Dirección del asiento según ERP §5.8; medio siempre TRANSFERENCIA (regla 76):
      //   INGRESO_CAPITAL   → INGRESO  (entra plata al negocio)
      //   RETIRO_CAPITAL    → EGRESO   (el inversor retira capital)
      //   PAGO_RENDIMIENTO  → EGRESO   (se le paga el rendimiento acumulado)
      //   AJUSTE            → NEUTRO   (corrección sin movimiento real de caja)
      const tipoAsiento: 'INGRESO' | 'EGRESO' | 'NEUTRO' | null =
        d.type === 'INGRESO_CAPITAL' ? 'INGRESO'
        : d.type === 'RETIRO_CAPITAL' || d.type === 'PAGO_RENDIMIENTO' ? 'EGRESO'
        : d.type === 'AJUSTE' ? 'NEUTRO'
        : null

      const movimiento = await prisma.$transaction(async tx => {
        await tx.investor.update({
          where: { id: inv.id },
          data: { capital: newCapital, pending: newPending, paidTotal: inv.paidTotal },
        })
        const mov = await tx.investorMovement.create({
          data: {
            investorId: inv.id,
            type: d.type,
            amount: d.amount,
            detail: d.detail || null,
            capitalAfter: newCapital,
            operator: d.operator || null,
          },
        })
        // Pago de rendimiento: se saldan los períodos PENDIENTE más viejos
        // primero (FIFO) hasta cubrir el monto pagado (ERP §3.17).
        if (d.type === 'PAGO_RENDIMIENTO') {
          let restante = d.amount
          const pendientes = await tx.investorYield.findMany({
            where: { investorId: inv.id, status: 'PENDIENTE' },
            orderBy: { period: 'asc' },
          })
          for (const y of pendientes) {
            if (restante <= 0) break
            if (y.amount <= restante) {
              await tx.investorYield.update({
                where: { id: y.id },
                data: { status: 'PAGADO', paidAt: new Date(), operator: d.operator || null },
              })
              restante -= y.amount
            }
          }
        }
        if (tipoAsiento && d.amount !== 0) {
          await registerEntry({
            source: 'INVERSOR',
            description: `Inversor ${inv.name} — ${d.detail || d.type}`,
            category: 'Inversores',
            type: tipoAsiento,
            means: 'TRANSFERENCIA',
            amount: Math.abs(d.amount),
            operator: d.operator || null,
          }, tx)
        }
        return mov
      })

      await enqueueSheetSync('INVERSOR', movimiento.id, {
        inversor: inv.name,
        fecha: new Date().toISOString().slice(0, 10),
        tipo: d.type,
        detalle: d.detail || '',
        monto: d.amount,
        capitalResultante: newCapital,
        operador: d.operator || '',
      })

      return NextResponse.json({ success: true })
    }

    // Generar rendimiento mensual (no duplica período)
    if (body.action === 'yield') {
      const parsed = YieldSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
      const { investorId, month, operator } = parsed.data
      const inv = await prisma.investor.findUnique({ where: { id: investorId } })
      if (!inv) return NextResponse.json({ error: 'Inversor no encontrado' }, { status: 404 })

      const dup = await prisma.investorYield.findUnique({
        where: { investorId_period: { investorId, period: month } },
      })
      if (dup) return NextResponse.json({ error: 'Ya se generó el rendimiento de este mes' }, { status: 400 })

      const amount = Math.round((inv.capital * inv.yieldRate) / 100)
      await prisma.$transaction([
        prisma.investor.update({ where: { id: inv.id }, data: { pending: inv.pending + amount } }),
        prisma.investorYield.create({
          data: {
            investorId,
            period: month,
            capitalBase: inv.capital,
            amount,
            status: 'PENDIENTE',
            operator: operator || null,
          },
        }),
      ])
      return NextResponse.json({ success: true, amount })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    console.error('[Admin Investors POST]', error)
    return NextResponse.json({ error: 'Error al procesar inversor' }, { status: 500 })
  }
}