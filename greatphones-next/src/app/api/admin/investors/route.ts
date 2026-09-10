import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { registerEntry } from '@/lib/accounting'
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
      // NOTA: la dirección del asiento acá NO respeta el ERP §5.8
      // (RETIRO_CAPITAL y PAGO_RENDIMIENTO deberían ser EGRESO, no INGRESO/nada).
      // Se conserva el comportamiento actual — el ajuste de dirección es un
      // cambio de flujo de caja pendiente de confirmación.
      const moneyIn = d.type === 'INGRESO_CAPITAL' || d.type === 'PAGO_RENDIMIENTO' || (d.type === 'AJUSTE' && d.amount > 0)

      await prisma.$transaction(async tx => {
        await tx.investor.update({
          where: { id: inv.id },
          data: { capital: newCapital, pending: newPending, paidTotal: inv.paidTotal },
        })
        await tx.investorMovement.create({
          data: {
            investorId: inv.id,
            type: d.type,
            amount: d.amount,
            detail: d.detail || null,
            capitalAfter: newCapital,
            operator: d.operator || null,
          },
        })
        if (moneyIn) {
          await registerEntry({
            source: 'INVERSOR',
            description: `Inversor ${inv.name} — ${d.detail || d.type}`,
            category: 'Inversores',
            type: 'INGRESO',
            means: 'TRANSFERENCIA',
            amount: d.amount,
            operator: d.operator || null,
          }, tx)
        }
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

      const dup = await prisma.investorMovement.findFirst({
        where: { investorId, detail: `Rendimiento ${month}` },
      })
      if (dup) return NextResponse.json({ error: 'Ya se generó el rendimiento de este mes' }, { status: 400 })

      const amount = Math.round((inv.capital * inv.yieldRate) / 100)
      await prisma.$transaction([
        prisma.investor.update({ where: { id: inv.id }, data: { pending: inv.pending + amount } }),
        prisma.investorMovement.create({
          data: {
            investorId,
            type: 'PAGO_RENDIMIENTO',
            amount: 0,
            detail: `Rendimiento ${month}`,
            capitalAfter: inv.capital,
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