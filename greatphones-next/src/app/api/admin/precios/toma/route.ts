import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { auditar } from '@/lib/audit'
import { z } from 'zod'

const TomaSchema = z.object({
  id: z.string().optional(),
  modelo: z.string().min(1, 'El modelo es obligatorio'),
  impecable: z.number().int().min(0).default(0),
  bateria: z.number().int().min(0).default(0),
  pantalla: z.number().int().min(0).default(0),
  camara: z.number().int().min(0).default(0),
  microfono: z.number().int().min(0).default(0),
  parlante: z.number().int().min(0).default(0),
  tapa: z.number().int().min(0).default(0),
  marco: z.number().int().min(0).default(0),
  pin: z.number().int().min(0).default(0),
  orden: z.number().int().default(0),
  active: z.boolean().default(true),
})

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const rows = await prisma.priceTradeIn.findMany({
      where: { active: true, deletedAt: null },
      orderBy: [{ orden: 'asc' }, { modelo: 'asc' }],
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
    const parsed = TomaSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    const d = parsed.data
    const last = await prisma.priceTradeIn.findFirst({ orderBy: { orden: 'desc' } })
    const row = await prisma.priceTradeIn.create({
      data: { ...d, orden: d.orden || (last ? last.orden + 1 : 0), updatedBy: admin.id },
    })
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
    const parsed = TomaSchema.partial().safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    const previo = await prisma.priceTradeIn.findUnique({ where: { id: body.id } })
    const row = await prisma.priceTradeIn.update({
      where: { id: body.id },
      data: { ...parsed.data, updatedBy: admin.id },
    })
    await auditar({
      entityType: 'PriceTradeIn',
      entityId: body.id,
      action: 'UPDATE',
      reason: `Edición de precio de toma ${row.modelo}`,
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
    const previo = await prisma.priceTradeIn.findUnique({ where: { id } })
    if (!previo) return NextResponse.json({ error: 'Precio de toma no encontrado' }, { status: 404 })
    // Soft-delete (ERP regla 1).
    await prisma.priceTradeIn.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: admin.email, deleteReason: motivo, active: false },
    })
    await auditar({
      entityType: 'PriceTradeIn',
      entityId: id,
      action: 'ANULACION',
      reason: `Baja de precio de toma ${previo.modelo} — ${motivo}`,
      operator: admin.email,
      createdById: admin.id,
      snapshot: previo,
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
