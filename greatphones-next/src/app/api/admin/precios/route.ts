import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { auditar } from '@/lib/audit'
import { z } from 'zod'

const PrecioSchema = z.object({
  id: z.string().optional(),
  modelo: z.string().min(1, 'El modelo es obligatorio'),
  almacenamiento: z.string().default(''),
  precioARS: z.number().int().min(0).default(0),
  preventaARS: z.number().int().min(0).default(0),
  descuentoARS: z.number().int().min(0).default(0),
  imageUrl: z.string().optional().nullable().default(null),
  colors: z.array(z.string()).optional().default([]),
  orden: z.number().int().default(0),
  active: z.boolean().default(true),
})

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const rows = await prisma.priceList.findMany({
      where: { category: 'CELULAR' },
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
    const parsed = PrecioSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    const d = parsed.data
    const last = await prisma.priceList.findFirst({
      where: { category: 'CELULAR' },
      orderBy: { orden: 'desc' },
    })
    const row = await prisma.priceList.create({
      data: {
        category: 'CELULAR',
        modelo: d.modelo,
        almacenamiento: d.almacenamiento,
        precioARS: d.precioARS,
        preventaARS: d.preventaARS,
        descuentoARS: d.descuentoARS,
        imageUrl: d.imageUrl ?? null,
        colors: d.colors ?? [],
        orden: d.orden || (last ? last.orden + 1 : 0),
        active: d.active,
        updatedBy: admin.id,
      },
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
    const parsed = PrecioSchema.partial().safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    const previo = await prisma.priceList.findUnique({ where: { id: body.id } })
    const row = await prisma.priceList.update({
      where: { id: body.id },
      data: { ...parsed.data, updatedBy: admin.id },
    })
    await auditar({
      entityType: 'PriceList',
      entityId: body.id,
      action: 'UPDATE',
      reason: `Edición de precio ${row.modelo} ${row.almacenamiento || ''}`.trim(),
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
    const previo = await prisma.priceList.findUnique({ where: { id } })
    if (!previo) return NextResponse.json({ error: 'Precio no encontrado' }, { status: 404 })
    // La fila se elimina, pero su estado queda preservado en el snapshot de
    // auditoría (traza de responsable + motivo, ERP regla 11).
    await auditar({
      entityType: 'PriceList',
      entityId: id,
      action: 'ANULACION',
      reason: `Baja de precio ${previo.modelo} ${previo.almacenamiento || ''} — ${motivo}`.trim(),
      operator: admin.email,
      createdById: admin.id,
      snapshot: previo,
    }).catch(() => {})
    await prisma.priceList.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
