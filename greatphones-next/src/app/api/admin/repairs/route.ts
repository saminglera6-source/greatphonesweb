import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { registerEntry } from '@/lib/accounting'
import { auditar } from '@/lib/audit'
import { nextCorrelativo } from '@/lib/correlativo'
import { z } from 'zod'

const CreateSchema = z.object({
  type: z.string().optional(),
  device: z.string().min(1, 'Equipo requerido'),
  issue: z.string().min(1, 'Falla requerida'),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  clientDni: z.string().optional(),
  imei: z.string().optional(),
  pin: z.string().optional(),
  faults: z.array(z.string()).optional(),
  jobs: z.array(z.string()).optional(),
  diagnosis: z.string().optional(),
  isDiagnosis: z.boolean().optional(),
  priceCalc: z.number().optional(),
  estimatedHours: z.number().optional(),
  operator: z.string().optional(),
})

const UpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['PENDING', 'DIAGNOSIS', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED']).optional(),
  diagnosisStatus: z.enum(['PENDIENTE', 'ACEPTADO', 'RECHAZADO']).optional(),
  price: z.number().optional(),
  pricePaid: z.number().optional(),
  diagnosis: z.string().optional(),
  jobs: z.array(z.string()).optional(),
  operator: z.string().optional(),
})

async function codeToId(code: string) {
  const r = await prisma.repair.findFirst({ where: { code } })
  return r ? r.id : code
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get('page') || 1)
    const limit = Number(searchParams.get('limit') || 30)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const where: any = { deletedAt: null }
    if (status && status !== 'all') where.status = status
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { device: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
      ]
    }
    const [data, total] = await Promise.all([
      prisma.repair.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.repair.count({ where }),
    ])
    return NextResponse.json({ data, page, limit, total, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[Admin Repairs GET]', error)
    return NextResponse.json({ error: 'Error al obtener reparaciones' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const body = await request.json()

    // Crear reparación / diagnóstico
    if (body.action === 'create') {
      const parsed = CreateSchema.safeParse(body.data || body)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
      const d = parsed.data
      const code = await prisma.$transaction(tx => nextCorrelativo(tx, 'REP', tx.repair))
      const repair = await prisma.repair.create({
        data: {
          code,
          userId: 'admin',
          device: d.device,
          issue: d.issue,
          type: d.type || null,
          clientName: d.clientName || null,
          clientPhone: d.clientPhone || null,
          clientDni: d.clientDni || null,
          imei: d.imei || null,
          pin: d.pin || null,
          fault1: (d.faults && d.faults[0]) || null,
          fault2: (d.faults && d.faults[1]) || null,
          jobs: d.jobs || [],
          diagnosis: d.diagnosis || null,
          diagnosisStatus: d.isDiagnosis ? 'PENDIENTE' : null,
          isDiagnosis: !!d.isDiagnosis,
          priceCalc: d.priceCalc || 0,
          estimatedHours: d.estimatedHours || null,
          operator: d.operator || null,
          status: d.isDiagnosis ? 'DIAGNOSIS' : 'PENDING',
        },
      })
      await auditar({ entityType: 'Repair', entityId: repair.id, action: 'CREACION', reason: 'Ingreso de reparación' }).catch(() => {})
      return NextResponse.json(repair, { status: 201 })
    }

    // Aceptar/rechazar diagnóstico, avanzar estado, cobrar o entregar
    if (body.action === 'update') {
      const parsed = UpdateSchema.safeParse(body.data || body)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
      const d = parsed.data
      const realId = await codeToId(d.id)
      const existing = await prisma.repair.findUnique({ where: { id: realId } })
      if (!existing) return NextResponse.json({ error: 'Reparación no encontrada' }, { status: 404 })

      const up: any = {}
      if (d.status) up.status = d.status
      if (d.diagnosisStatus) up.diagnosisStatus = d.diagnosisStatus
      if (d.price !== undefined) up.priceCalc = d.price
      if (d.jobs) up.jobs = d.jobs
      if (d.diagnosis) up.diagnosis = d.diagnosis
      if (d.operator) up.operator = d.operator
      if (d.status === 'DELIVERED') up.deliveredAt = new Date()

      const repair = await prisma.repair.update({ where: { id: realId }, data: up })

      // Cobro de reparación → asiento INGRESO (medio único)
      if (d.pricePaid && d.pricePaid > 0 && !existing.isDiagnosis) {
        await registerEntry({
          source: 'REPAIR',
          operationId: repair.code,
          description: `Reparación ${repair.code} — ${repair.device}`,
          category: 'Reparaciones',
          type: 'INGRESO',
          means: 'EFECTIVO',
          amount: d.pricePaid,
          operator: d.operator || null,
        }).catch(e => console.error('[Repairs] asiento:', e))
        await prisma.repair.update({ where: { id: realId }, data: { pricePaid: d.pricePaid } })
      }

      await auditar({ entityType: 'Repair', entityId: realId, action: 'UPDATE', reason: d.status || d.diagnosisStatus || 'Avance' }).catch(() => {})
      return NextResponse.json(repair)
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    console.error('[Admin Repairs POST]', error)
    return NextResponse.json({ error: 'Error al procesar reparación' }, { status: 500 })
  }
}