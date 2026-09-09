import { NextResponse } from 'next/server'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { cambioMoneda, ajusteCaja, arqueo, TesoreriaError } from '@/lib/tesoreria'
import { z } from 'zod'

/**
 * Tesorería: cambio de moneda (doble asiento) y ajuste de caja (arqueo).
 *  - GET  ?arqueo=1&efectivo=&transferencia=&usd=  → diferencia físico vs sistema
 *  - POST { op: 'cambio', ... }                    → cambio de moneda
 *  - POST { op: 'ajuste', ... }                    → ajuste de caja
 */

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    if (searchParams.get('arqueo')) {
      const num = (k: string) => {
        const v = searchParams.get(k)
        return v == null || v === '' ? undefined : Number(v)
      }
      const res = await arqueo({
        EFECTIVO: num('efectivo'),
        TRANSFERENCIA: num('transferencia'),
        USD: num('usd'),
      })
      return NextResponse.json(res)
    }
    return NextResponse.json({ error: 'Falta ?arqueo=1' }, { status: 400 })
  } catch (error) {
    return handleRouteError(error)
  }
}

const CambioSchema = z.object({
  op: z.literal('cambio'),
  usd: z.number().positive('La cantidad de dólares debe ser > 0'),
  cajaPesos: z.enum(['EFECTIVO', 'TRANSFERENCIA']),
  direccion: z.enum(['COMPRA_USD', 'VENTA_USD']),
  cotizacion: z.number().positive().optional(),
  obs: z.string().optional(),
  operator: z.string().optional(),
})

const AjusteSchema = z.object({
  op: z.literal('ajuste'),
  means: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'USD']),
  tipo: z.enum(['SOBRANTE', 'FALTANTE']),
  monto: z.number().positive('El monto debe ser > 0'),
  motivo: z.string().min(1, 'El motivo es obligatorio'),
  obs: z.string().optional(),
  operator: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const body = await request.json()

    if (body?.op === 'cambio') {
      const parsed = CambioSchema.safeParse(body)
      if (!parsed.success)
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
      const res = await cambioMoneda({ ...parsed.data, createdById: admin.id })
      return NextResponse.json(res, { status: 201 })
    }

    if (body?.op === 'ajuste') {
      const parsed = AjusteSchema.safeParse(body)
      if (!parsed.success)
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
      const res = await ajusteCaja({ ...parsed.data, createdById: admin.id })
      return NextResponse.json(res, { status: 201 })
    }

    return NextResponse.json({ error: 'op inválido (cambio | ajuste)' }, { status: 400 })
  } catch (error) {
    if (error instanceof TesoreriaError)
      return NextResponse.json({ error: error.message }, { status: error.status })
    return handleRouteError(error)
  }
}
