import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { registrarCompraAccesorios, CompraAccError } from '@/lib/compras-accesorios'
import { z } from 'zod'

const LineaSchema = z.object({
  categoria: z.string().min(1),
  producto: z.string().min(1),
  marca: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  cantidad: z.number().int().positive(),
  costoUnit: z.number().int().min(0),
  precioVenta: z.number().int().min(0).optional().nullable(),
})

const Schema = z.object({
  proveedor: z.string().optional().nullable(),
  lineas: z.array(LineaSchema).min(1, 'Cargá al menos una línea'),
  efectivo: z.number().int().min(0).default(0),
  transferencia: z.number().int().min(0).default(0),
  usd: z.number().min(0).default(0),
  operador: z.string().optional(),
  obs: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const [accesorios, categorias, ultimas] = await Promise.all([
      prisma.accessory.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, category: true, brand: true, color: true, cost: true, lastCost: true, stock: true, price: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
      prisma.accessory.findMany({ where: { deletedAt: null }, select: { category: true }, distinct: ['category'] }),
      prisma.accessoryPurchase.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    ])
    return NextResponse.json({
      accesorios,
      categorias: [...new Set(categorias.map(c => c.category).filter(Boolean))].sort(),
      ultimas,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const parsed = Schema.safeParse(await request.json())
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    const d = parsed.data
    const res = await registrarCompraAccesorios({
      proveedor: d.proveedor,
      lineas: d.lineas,
      pago: { efectivo: d.efectivo, transferencia: d.transferencia, usd: d.usd },
      operador: d.operador,
      createdById: admin.id,
      obs: d.obs,
    })
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    if (error instanceof CompraAccError)
      return NextResponse.json({ error: error.message }, { status: error.status })
    return handleRouteError(error)
  }
}
