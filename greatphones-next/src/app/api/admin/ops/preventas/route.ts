import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { registrarPreventa, PreventaError, saldoPendiente, normalizeStatus } from '@/lib/preventas'
import { dolarActual } from '@/lib/dolar-server'
import { z } from 'zod'

const PreventaSchema = z.object({
  fecha: z.string().optional(),
  modelo: z.string().min(1, 'El modelo es obligatorio'),
  cliente: z.string().min(1, 'El cliente es obligatorio'),
  cuil: z.string().optional(),
  tel: z.string().optional(),
  vendedor: z.preprocess(v => v ?? '', z.string().min(1, 'Ingresá el nombre del vendedor')),
  precioVenta: z.number().int().min(1, 'El precio pactado debe ser > 0'),
  efectivo: z.number().int().min(0).default(0),
  transferencia: z.number().int().min(0).default(0),
  cuotas: z.number().int().min(0).default(0),
  usd: z.number().min(0).default(0),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  obs: z.string().optional(),
  // ERP regla 100/102: operador declarado explícito en toda operación.
  operador: z.preprocess(v => v ?? '', z.string().min(1, 'Seleccioná el operador')),
})

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const preorders = await prisma.preOrder.findMany({
      where: { deletedAt: null, source: 'local' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    const usdRate = (await dolarActual()).compra || 1000
    return NextResponse.json(
      preorders.map(p => ({
        ...p,
        status: normalizeStatus(p.status),
        saldo: saldoPendiente(p, usdRate),
      })),
    )
  } catch (error) {
    console.error('[Ops Preventas GET]', error)
    return NextResponse.json({ error: 'Error al obtener preventas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const body = await request.json()
    const parsed = PreventaSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 },
      )
    const d = parsed.data

    const res = await registrarPreventa({
      cliente: d.cliente,
      cuil: d.cuil,
      tel: d.tel,
      modelo: d.modelo,
      precioVenta: d.precioVenta,
      cobro: { efectivo: d.efectivo, transferencia: d.transferencia, cuotas: d.cuotas, usd: d.usd },
      vendedor: d.vendedor,
      operador: d.operador,
      createdById: admin.id,
      fechaDesde: d.fechaDesde,
      fechaHasta: d.fechaHasta,
      obs: d.obs,
      source: 'local',
    })

    return NextResponse.json({ numero: res.code, ...res.preOrder, saldo: res.saldo }, { status: 201 })
  } catch (error) {
    if (error instanceof PreventaError)
      return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[Ops Preventas POST]', error)
    return NextResponse.json({ error: 'Error al registrar la preventa' }, { status: 500 })
  }
}
