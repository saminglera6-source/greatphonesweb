import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { auditar } from '@/lib/audit'
import { z } from 'zod'

const CuotaSchema = z.object({
  id: z.string().optional(),
  cuotas: z.number().int().min(1),
  coeficiente: z.number().positive().default(1),
  activo: z.boolean().default(true),
  mostrar: z.boolean().default(true),
  observacion: z.string().optional(),
  orden: z.number().int().default(0),
})

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const rows = await prisma.cuotasConfig.findMany({
      where: { deletedAt: null },
      orderBy: [{ orden: 'asc' }, { cuotas: 'asc' }],
    })
    return NextResponse.json(rows)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const body = await request.json()
    const parsed = CuotaSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    const d = parsed.data
    // `cuotas` es único: si ya hay un plan (incluso dado de baja) para ese
    // número, se revive/actualiza en lugar de fallar contra el índice único.
    const existente = await prisma.cuotasConfig.findUnique({ where: { cuotas: d.cuotas } })
    const row = existente
      ? await prisma.cuotasConfig.update({
          where: { id: existente.id },
          data: { ...d, updatedBy: admin.id, deletedAt: null, deletedBy: null, deleteReason: null },
        })
      : await prisma.cuotasConfig.create({ data: { ...d, updatedBy: admin.id } })
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })
    const parsed = CuotaSchema.partial().safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    const previo = await prisma.cuotasConfig.findUnique({ where: { id: body.id } })
    const row = await prisma.cuotasConfig.update({
      where: { id: body.id },
      data: { ...parsed.data, updatedBy: admin.id },
    })
    await auditar({
      entityType: 'CuotasConfig',
      entityId: body.id,
      action: 'UPDATE',
      reason: `Edición de plan de ${row.cuotas} cuotas (coef. ${row.coeficiente})`,
      operator: admin.email,
      createdById: admin.id,
      snapshot: previo,
    }).catch(() => {})
    return NextResponse.json(row)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const motivo = (searchParams.get('motivo') || '').trim()
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })
    if (motivo.length < 3) return NextResponse.json({ error: 'Indicá el motivo de la baja' }, { status: 400 })
    const previo = await prisma.cuotasConfig.findUnique({ where: { id } })
    if (!previo) return NextResponse.json({ error: 'Plan de cuotas no encontrado' }, { status: 404 })
    // Soft-delete (ERP regla 1).
    await prisma.cuotasConfig.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: admin.email, deleteReason: motivo, activo: false, mostrar: false },
    })
    await auditar({
      entityType: 'CuotasConfig',
      entityId: id,
      action: 'ANULACION',
      reason: `Baja de plan de ${previo.cuotas} cuotas — ${motivo}`,
      operator: admin.email,
      createdById: admin.id,
      snapshot: previo,
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
