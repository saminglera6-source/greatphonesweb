import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { registerEntry } from '@/lib/accounting'
import { obtenerDolar } from '@/lib/precios'
import { nextCorrelativo } from '@/lib/correlativo'
import { enqueueSheetSync } from '@/lib/erp-sheet'
import { z } from 'zod'

const GastoSchema = z.object({
  fecha: z.string().optional(),
  cat: z.string().min(1, 'Elegí una categoría'),
  desc: z.string().min(1, 'Ingresá una descripción'),
  efec: z.number().min(0).default(0),
  transf: z.number().min(0).default(0),
  usd: z.number().min(0).default(0),
  resp: z.string().optional(),
  comp: z.string().optional(),
  obs: z.string().optional(),
  operador: z.string().min(1, 'Seleccioná el operador'),
})

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const body = await request.json()
    const parsed = GastoSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })

    const d = parsed.data
    const efec = Math.round(d.efec)
    const transf = Math.round(d.transf)
    const usd = Math.round(d.usd)

    if (efec + transf + usd <= 0) return NextResponse.json({ error: 'El monto total debe ser > 0' }, { status: 400 })

    const cot = await obtenerDolar('blue')
    const cotizacion = cot && cot.venta > 0 ? cot.venta : 0
    const usdEnPesos = Math.round(usd * (cotizacion || 0))
    const montoTotal = efec + transf + usdEnPesos

    const obsUSD = usd > 0
      ? `${d.obs || ''}${d.obs ? ' | ' : ''}USD: ${usd} | USD_COTIZACION: ${cotizacion} | USD_CONVERTIDO: ${usdEnPesos}`
      : (d.obs || '')

    // Un asiento por medio realmente usado
    const medios: Array<{ means: 'EFECTIVO' | 'TRANSFERENCIA' | 'USD'; amount: number; amountUsd?: number; obs: string }> = []
    if (efec > 0) medios.push({ means: 'EFECTIVO', amount: efec, obs: d.obs || '' })
    if (transf > 0) medios.push({ means: 'TRANSFERENCIA', amount: transf, obs: d.obs || '' })
    if (usd > 0) medios.push({ means: 'USD', amount: usd, amountUsd: usd, obs: obsUSD })

    // Correlativo + todos los asientos en una sola transacción (T-8): un gasto
    // nunca queda con la mitad de sus asientos.
    const nGas = await prisma.$transaction(async tx => {
      const code = await nextCorrelativo(tx, 'GST', tx.accountingEntry as any, {
        distinct: true,
        field: 'operationId',
        extraWhere: { source: 'GASTO' },
      })
      for (const m of medios) {
        await registerEntry({
          source: 'GASTO',
          operationId: code,
          description: `Gasto ${d.cat}: ${d.desc}`,
          category: d.cat,
          type: 'EGRESO',
          means: m.means,
          amount: m.amount,
          amountUsd: m.means === 'USD' ? (m.amountUsd ?? null) : null,
          opDate: d.fecha ? new Date(d.fecha) : undefined,
          operator: d.operador,
          createdById: admin.id,
        }, tx)
      }
      return code
    })

    // Replicar al sheet ERP (nunca bloquea el gasto).
    await enqueueSheetSync('GASTO', nGas, {
      numero: nGas,
      fecha: d.fecha || new Date().toISOString().slice(0, 10),
      categoria: d.cat,
      descripcion: d.desc,
      montoEfectivo: efec,
      montoTransferencia: transf,
      montoUsd: usd,
      responsable: d.resp || '',
      comprobante: d.comp || '',
      montoTotal,
      operador: d.operador,
    })

    return NextResponse.json({
      operacion: nGas,
      categoria: d.cat,
      desc: d.desc,
      montoTotal,
      usd,
      usdEnPesos,
      cotizacion,
    }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
