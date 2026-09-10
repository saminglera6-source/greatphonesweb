import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { dolarActual } from '@/lib/dolar-server'
import { PRE, normalizeStatus, saldoPendiente, statusFilterValues } from '@/lib/preventas'

function generatePreOrderCode() {
  const prefix = 'PRE'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const source = searchParams.get('source')

    const where: any = { deletedAt: null }
    const statusVals = statusFilterValues(status)
    if (statusVals) where.status = { in: statusVals }
    if (source) where.source = source
    if (search) {
      const s = search.trim()
      where.OR = [
        { clientName: { contains: s, mode: 'insensitive' } },
        { clientDni: { contains: s } },
        { productModelName: { contains: s, mode: 'insensitive' } },
      ]
    }

    const preOrders = await prisma.preOrder.findMany({
      where,
      include: { product: { select: { id: true, name: true, imageUrl: true, ico: true, price: true, cost: true, stock: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const usdRate = (await dolarActual()).compra || 1000
    return NextResponse.json(
      preOrders.map(p => ({
        ...p,
        status: normalizeStatus(p.status),
        saldo: saldoPendiente(p, usdRate),
      })),
    )
  } catch (error) {
    console.error('Error fetching preorders:', error)
    return NextResponse.json({ error: 'Error al obtener preventas' }, { status: 500 })
  }
}

/**
 * Reserva de preventa sin cobro (flujo legacy de "Venta en Tienda" / instore.js):
 * el cliente reserva un modelo, sin seña. El cobro se registra después, al
 * entregar. Para el registro CON seña, el frontend nuevo usa /api/admin/ops/preventas
 * (servicio lib/preventas.ts).
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const body = await request.json()
    const {
      clientName, clientDni, clientPhone, clientEmail,
      productId, customName, customPrice,
      productModelName, productStorage, productColor, productCondition,
      expectedDeliveryStart, expectedDeliveryEnd,
      notes, vendedor, operador,
    } = body

    if (!clientName || !clientName.trim()) {
      return NextResponse.json({ error: 'El nombre del cliente es obligatorio' }, { status: 400 })
    }
    if (!productId && !customName && !productModelName) {
      return NextResponse.json({ error: 'Seleccioná un producto o ingresá un modelo' }, { status: 400 })
    }

    const preOrder = await prisma.preOrder.create({
      data: {
        code: generatePreOrderCode(),
        clientName: clientName.trim(),
        clientDni: clientDni || null,
        clientPhone: clientPhone || null,
        clientEmail: clientEmail || null,
        productId: productId || null,
        customName: customName || null,
        customPrice: customPrice ? Number(customPrice) : null,
        productModelName: productModelName || customName || null,
        productStorage: productStorage || null,
        productColor: productColor || null,
        productCondition: productCondition || null,
        price: customPrice ? Number(customPrice) : 0,
        collectedArs: 0,
        collectedUsd: 0,
        sellerName: operador || vendedor || null,
        status: PRE.ESPERANDO_COMPRA,
        expectedDeliveryStart: expectedDeliveryStart ? new Date(expectedDeliveryStart) : null,
        expectedDeliveryEnd: expectedDeliveryEnd ? new Date(expectedDeliveryEnd) : null,
        notes: notes || null,
        createdById: admin.id,
      },
    })

    return NextResponse.json(preOrder, { status: 201 })
  } catch (error) {
    console.error('Error creating preorder:', error)
    return NextResponse.json({ error: 'Error al crear preventa' }, { status: 500 })
  }
}
