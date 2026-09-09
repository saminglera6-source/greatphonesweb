import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { setConfig } from '@/lib/config'
import {
  calcularRangoEntrega,
  getPlazoConfig,
  invalidateHolidayCache,
} from '@/lib/dias-habiles'
import { z } from 'zod'

/**
 * Configuración del plazo de entrega de preventas: ventana de días hábiles
 * (mín/máx) + calendario de feriados. Lo consume el form de "Registrar
 * Preventa" para sugerir y validar fechas.
 */

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const [plazo, rango, feriados] = await Promise.all([
      getPlazoConfig(),
      calcularRangoEntrega(),
      prisma.holiday.findMany({ orderBy: { date: 'asc' } }),
    ])
    return NextResponse.json({
      plazo,
      rango,
      feriados: feriados.map(f => ({
        id: f.id,
        date: f.date.toISOString().slice(0, 10),
        label: f.label,
      })),
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

const PlazoSchema = z.object({
  minDias: z.number().int().min(0).max(60),
  maxDias: z.number().int().min(0).max(90),
})

/** Actualiza la ventana de días hábiles (AppConfig['PREVENTA_PLAZO']). */
export async function PUT(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const parsed = PlazoSchema.safeParse(await request.json())
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )
    if (parsed.data.maxDias < parsed.data.minDias)
      return NextResponse.json({ error: 'El máximo no puede ser menor que el mínimo.' }, { status: 400 })
    await setConfig('PREVENTA_PLAZO', parsed.data, admin.id)
    return NextResponse.json({ ok: true, plazo: parsed.data })
  } catch (error) {
    return handleRouteError(error)
  }
}

const FeriadoSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  label: z.string().optional(),
})

/** Agrega un feriado. */
export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const parsed = FeriadoSchema.safeParse(await request.json())
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )
    const feriado = await prisma.holiday.upsert({
      where: { date: new Date(parsed.data.date + 'T00:00:00Z') },
      update: { label: parsed.data.label || null },
      create: { date: new Date(parsed.data.date + 'T00:00:00Z'), label: parsed.data.label || null },
    })
    invalidateHolidayCache()
    return NextResponse.json(
      { id: feriado.id, date: feriado.date.toISOString().slice(0, 10), label: feriado.label },
      { status: 201 },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}

/** Borra un feriado por id (?id=) o fecha (?date=YYYY-MM-DD). */
export async function DELETE(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const date = searchParams.get('date')
    if (id) await prisma.holiday.delete({ where: { id } })
    else if (date) await prisma.holiday.delete({ where: { date: new Date(date + 'T00:00:00Z') } })
    else return NextResponse.json({ error: 'Falta id o date' }, { status: 400 })
    invalidateHolidayCache()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
