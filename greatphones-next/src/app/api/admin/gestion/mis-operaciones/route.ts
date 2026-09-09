import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { anularOperacion, restaurarOperacion, AnulacionError } from '@/lib/anulaciones'
import { z } from 'zod'

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)

    const id = searchParams.get('id')
    if (id) {
      const entry = await prisma.accountingEntry.findUnique({ where: { id } })
      if (!entry) return NextResponse.json({ error: 'Operación no encontrada' }, { status: 404 })
      return NextResponse.json(entry)
    }

    const page = Number(searchParams.get('page') || 1)
    const limit = Math.min(100, Number(searchParams.get('limit') || 50))
    const operador = searchParams.get('operador')
    const source = searchParams.get('source')
    const medio = searchParams.get('medio')
    const tipo = searchParams.get('tipo')
    const fecha = searchParams.get('fecha')
    const busqueda = searchParams.get('busqueda')
    const estado = searchParams.get('estado') // ACTIVO (default) | ANULADO

    const where: any = {}
    where.status = estado === 'ANULADO' ? 'ANULADO' : 'ACTIVO'
    if (operador) where.operator = operador
    if (source) where.source = source
    if (medio) where.means = medio
    if (tipo) where.type = tipo
    if (fecha) {
      where.opDate = { gte: new Date(fecha + 'T00:00:00'), lte: new Date(fecha + 'T23:59:59') }
    }
    if (busqueda) {
      where.OR = [
        { operationId: { contains: busqueda, mode: 'insensitive' } },
        { description: { contains: busqueda, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      prisma.accountingEntry.findMany({ where, orderBy: { opDate: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.accountingEntry.count({ where }),
    ])

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    return handleRouteError(error)
  }
}

const AnularSchema = z.object({
  operationId: z.string().min(1),
  motivo: z.string().min(1, 'Ingresá un motivo'),
  operador: z.string().min(1, 'Elegí el operador'),
})

/** Anula una operación: marca sus asientos ANULADO (nunca los borra), revierte
 *  stock / vínculos, y deja constancia en Auditoría con snapshot. */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const parsed = AnularSchema.safeParse(await request.json())
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    const d = parsed.data
    const res = await anularOperacion({
      operationId: d.operationId,
      motivo: d.motivo,
      operador: d.operador,
      createdById: admin.id,
    })
    return NextResponse.json(res)
  } catch (error) {
    if (error instanceof AnulacionError)
      return NextResponse.json({ error: error.message }, { status: error.status })
    return handleRouteError(error)
  }
}

const RestaurarSchema = z.object({
  operationId: z.string().min(1),
  operador: z.string().min(1, 'Elegí el operador'),
  motivo: z.string().optional(),
})

/** Restaura una operación anulada: reactiva sus asientos y re-aplica efectos. */
export async function PUT(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const parsed = RestaurarSchema.safeParse(await request.json())
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    const d = parsed.data
    const res = await restaurarOperacion({
      operationId: d.operationId,
      operador: d.operador,
      motivo: d.motivo,
      createdById: admin.id,
    })
    return NextResponse.json(res)
  } catch (error) {
    if (error instanceof AnulacionError)
      return NextResponse.json({ error: error.message }, { status: error.status })
    return handleRouteError(error)
  }
}
