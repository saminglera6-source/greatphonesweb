import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { registrarVenta, VentaError } from '@/lib/ventas'
import { z } from 'zod'

const VentaSchema = z.object({
  productId: z.string().min(1, 'Seleccioná un producto con stock'),
  inventoryItemId: z.string().optional(),
  fecha: z.string().optional(),
  precioVenta: z.number().int().min(1, 'El precio de venta debe ser > 0'),
  cliente: z.string().min(1, 'El cliente es obligatorio'),
  cuil: z.string().optional(),
  tel: z.string().optional(),
  vendedor: z.string().optional(),
  efectivo: z.number().int().min(0).default(0),
  transferencia: z.number().int().min(0).default(0),
  cuotas: z.number().int().min(0).default(0),
  usd: z.number().min(0).default(0),
  accesorios: z
    .array(z.object({ nombre: z.string(), precio: z.number().int().default(0) }))
    .optional(),
  obs: z.string().optional(),
  entregarRegalos: z.boolean().optional(),
  operador: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    // Productos con stock, anotando cuántas unidades serializadas hay.
    const productos = await prisma.product.findMany({
      where: { deletedAt: null, isPreorder: false, stock: { gt: 0 } },
      orderBy: { name: 'asc' },
      take: 500,
      select: {
        id: true, name: true, brand: true, sub: true, storage: true, color: true,
        condition: true, battery: true, price: true, cost: true, stock: true, reserved: true,
        imageUrl: true,
        inventoryItems: {
          where: { status: 'IN_STOCK' },
          select: { id: true, imei: true, purchasePrice: true, batteryHealth: true, cosmeticCondition: true, purchaseDate: true },
          orderBy: { purchaseDate: 'asc' },
        },
      },
    })
    return NextResponse.json(productos)
  } catch (error) {
    console.error('[Ops Ventas GET]', error)
    return NextResponse.json({ error: 'Error al obtener productos en stock' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const parsed = VentaSchema.safeParse(await request.json())
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 })
    const d = parsed.data

    const res = await registrarVenta({
      productId: d.productId,
      inventoryItemId: d.inventoryItemId || null,
      precioVenta: d.precioVenta,
      cliente: d.cliente,
      cuil: d.cuil,
      tel: d.tel,
      vendedor: d.vendedor,
      operador: d.operador,
      createdById: admin.id,
      cobro: { efectivo: d.efectivo, transferencia: d.transferencia, cuotas: d.cuotas, usd: d.usd },
      accesorios: d.accesorios,
      entregarRegalos: d.entregarRegalos,
      obs: d.obs,
    })

    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    if (error instanceof VentaError)
      return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[Ops Ventas POST]', error)
    return NextResponse.json({ error: 'Error al registrar la venta' }, { status: 500 })
  }
}
