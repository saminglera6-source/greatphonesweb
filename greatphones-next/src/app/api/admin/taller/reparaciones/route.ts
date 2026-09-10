import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { registerEntry } from '@/lib/accounting'
import { auditar } from '@/lib/audit'
import { nextCorrelativo } from '@/lib/correlativo'
import { z } from 'zod'

const CreateSchema = z.object({
  tipo: z.string().optional(),
  fecha: z.string().optional(),
  cliente: z.string().min(1, 'Ingresá el nombre del cliente'),
  tel: z.string().optional(),
  equipo: z.string().min(1, 'Ingresá el equipo'),
  imei: z.string().optional(),
  pin: z.string().optional(),
  falla1: z.string().min(1, 'Describí la falla principal'),
  falla2: z.string().optional(),
  esDiagnostico: z.boolean().optional(),
  trabajos: z.array(z.string()).optional(),
  precioCalculado: z.number().optional(),
  detallePresupuesto: z.string().optional(),
  tiempoEstimadoHoras: z.number().optional(),
  precioCob: z.number().default(0),
  efec: z.number().default(0),
  transf: z.number().default(0),
  cost: z.number().default(0),
  thirdParty: z.boolean().optional(),
  thirdPartyCost: z.number().optional(),
  obs: z.string().optional(),
  operador: z.string().min(1, 'Seleccioná el operador'),
})

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const where: any = { deletedAt: null }
    if (status && status !== 'TODOS') where.status = status
    const repairs = await prisma.repair.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return NextResponse.json(repairs)
  } catch (error) {
    console.error('[Taller Reparaciones GET]', error)
    return NextResponse.json({ error: 'Error al obtener reparaciones' }, { status: 500 })
  }
}

const VALID_STATUS = ['PENDING', 'DIAGNOSIS', 'APPROVED', 'IN_PROGRESS', 'THIRD_PARTY', 'COMPLETED', 'DELIVERED']

const PatchSchema = z.object({
  id: z.string().min(1, 'Falta id'),
  status: z.enum(VALID_STATUS as [string, ...string[]]).optional(),
  thirdParty: z.boolean().optional(),
  deliveredAt: z.string().optional(),
  cost: z.number().optional(),
  thirdPartyCost: z.number().optional(),
})

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    const { id, status, thirdParty, deliveredAt, cost, thirdPartyCost } = parsed.data
    if (!status && thirdParty === undefined && !deliveredAt && cost === undefined && thirdPartyCost === undefined)
      return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })

    const existing = await prisma.repair.findUnique({ where: { id } })
    if (!existing || existing.deletedAt)
      return NextResponse.json({ error: 'Reparación no encontrada' }, { status: 404 })

    const data: any = {}
    if (status) data.status = status
    if (cost !== undefined) data.cost = Math.max(0, cost)
    if (thirdPartyCost !== undefined) data.thirdPartyCost = Math.max(0, thirdPartyCost)

    // Calcular profitReal según estado y costos
    const newStatus = status || existing.status
    const newPricePaid = existing.pricePaid || 0
    const newCost = cost !== undefined ? Math.max(0, cost) : existing.cost
    const newThirdPartyCost = thirdPartyCost !== undefined ? Math.max(0, thirdPartyCost) : existing.thirdPartyCost

    // Si hay thirdPartyCost, siempre usarlo (incluso si cambia a DELIVERED)
    if (newThirdPartyCost) {
      data.profitReal = newPricePaid - newThirdPartyCost
    } else {
      data.profitReal = newPricePaid - newCost
    }

    // Enviar a tercero: queda en reparación por fuera, no se marca como entregada.
    if (status === 'THIRD_PARTY') {
      data.thirdParty = true
    } else {
      if (thirdParty !== undefined) data.thirdParty = !!thirdParty
      if (status === 'DELIVERED') data.deliveredAt = deliveredAt ? new Date(deliveredAt) : new Date()
      else if (deliveredAt) data.deliveredAt = new Date(deliveredAt)
    }

    const updated = await prisma.repair.update({ where: { id }, data })
    await auditar({
      entityType: 'Repair',
      entityId: id,
      action: 'UPDATE',
      reason: `Estado cambiado a ${status}${data.thirdParty ? ' (tercero)' : ''}${cost !== undefined ? ` · costo ${cost}` : ''}${thirdPartyCost !== undefined ? ` · costo tercero ${thirdPartyCost}` : ''}`,
    }).catch(() => {})

    // Garantía de la reparación: 90 días desde la entrega (ERP §6.5 regla 61).
    // Solo reparaciones reales (no diagnóstico), una sola vez.
    if (status === 'DELIVERED' && existing.status !== 'DELIVERED' && !existing.isDiagnosis) {
      try {
        const yaTiene = await prisma.guarantee.findFirst({
          where: { userId: existing.userId, product: { contains: existing.code } },
        })
        if (!yaTiene) {
          const start = (data.deliveredAt as Date) || new Date()
          await prisma.guarantee.create({
            data: {
              userId: existing.userId,
              product: `Reparación ${existing.code} — ${existing.device}`,
              type: 'reparacion',
              price: existing.pricePaid || 0,
              startsAt: start,
              expiresAt: new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000),
              status: 'ACTIVE',
            },
          })
        }
      } catch (e) {
        console.error('[Taller Reparaciones] garantía:', e)
      }
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('[Taller Reparaciones PATCH]', error)
    if (error?.name === 'AuthError')
      return NextResponse.json({ error: error.message }, { status: error.status || 401 })
    return NextResponse.json(
      { error: error?.message || 'Error al actualizar reparación' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const body = await request.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )

    const d = parsed.data

    const pricePaid = d.precioCob || 0
    const costValue = d.cost || 0
    const thirdPartyCostValue = d.thirdPartyCost || 0
    const isThirdParty = d.thirdParty && thirdPartyCostValue > 0
    const profitReal = isThirdParty ? pricePaid - thirdPartyCostValue : pricePaid - costValue

    // Número correlativo REP-nnnn (regla 9), bajo advisory lock transaccional.
    const code = await prisma.$transaction(tx => nextCorrelativo(tx, 'REP', tx.repair))

    const repair = await prisma.repair.create({
      data: {
        code,
        userId: admin.id,
        device: d.equipo,
        issue: d.falla1,
        type: d.tipo || 'Particular',
        clientName: d.cliente,
        clientPhone: d.tel || null,
        clientDni: null,
        imei: d.imei || null,
        pin: d.pin || null,
        fault1: d.falla1,
        fault2: d.falla2 || null,
        jobs: d.trabajos || [],
        isDiagnosis: !!d.esDiagnostico,
        diagnosisStatus: d.esDiagnostico ? 'PENDIENTE' : null,
        priceCalc: d.precioCalculado || 0,
        estimatedHours: d.tiempoEstimadoHoras || null,
        pricePaid,
        cost: costValue,
        thirdParty: isThirdParty,
        thirdPartyCost: thirdPartyCostValue || null,
        profitReal,
        operator: d.operador,
        status: isThirdParty ? 'THIRD_PARTY' : d.esDiagnostico ? 'DIAGNOSIS' : 'PENDING',
      },
    })

    await auditar({
      entityType: 'Repair',
      entityId: repair.id,
      action: 'CREACION',
      reason: 'Ingreso de reparación',
      operator: d.operador,
      createdById: admin.id,
    }).catch(() => {})

    // Cobro al ingresar: un asiento por medio (efectivo/transferencia)
    const efec = Math.round(d.efec)
    const transf = Math.round(d.transf)
    const cobrado = d.precioCob || 0
    if (cobrado > 0 && !d.esDiagnostico) {
      const medios: Array<{ means: 'EFECTIVO' | 'TRANSFERENCIA'; amount: number }> = []
      if (efec > 0) medios.push({ means: 'EFECTIVO', amount: efec })
      if (transf > 0) medios.push({ means: 'TRANSFERENCIA', amount: transf })
      for (const m of medios) {
        await registerEntry({
          source: 'REPAIR',
          operationId: repair.code,
          description: `Reparación ${repair.code} — ${d.equipo} — ${d.falla1}`,
          category: 'Reparaciones',
          type: 'INGRESO',
          means: m.means,
          amount: m.amount,
          operator: d.operador,
          createdById: admin.id,
        }).catch(e => console.error('[Taller Reparacion] asiento:', e))
      }
    }

    return NextResponse.json({ numero: code, ...repair }, { status: 201 })
  } catch (error) {
    console.error('[Taller Reparaciones POST]', error)
    return NextResponse.json({ error: 'Error al registrar la reparación' }, { status: 500 })
  }
}
