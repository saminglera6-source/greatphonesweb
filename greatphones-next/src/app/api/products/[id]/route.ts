import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { productCache } from '@/lib/cache'



export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const product = await prisma.product.findUnique({
      where: { id }
    })
    if (!product || product.deletedAt) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    return NextResponse.json(product, {
      headers: {  }
    })
  } catch (error) { return handleRouteError(error) }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await requireAdmin(request)
    const body = await request.json()
    console.log('Updating product:', id)
    console.log('Body:', JSON.stringify(body))
    
    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.brand !== undefined) updateData.brand = body.brand
    if (body.sub !== undefined) updateData.sub = body.sub || null
    if (body.price !== undefined) updateData.price = Number(body.price)
    if (body.stock !== undefined) updateData.stock = Number(body.stock)
    if (body.condition !== undefined) updateData.condition = body.condition
    if (body.type !== undefined) updateData.type = body.type
    if (body.color !== undefined) updateData.color = body.color || null
    if (body.screen !== undefined) updateData.screen = body.screen ? Number(body.screen) : null
    if (body.storage !== undefined) updateData.storage = body.storage || null
    if (body.ram !== undefined) updateData.ram = body.ram || null
    if (body.battery !== undefined) updateData.battery = body.battery ? Number(body.battery) : null
    if (body.processor !== undefined) updateData.processor = body.processor || null
    if (body.discount !== undefined) updateData.discount = Number(body.discount)
    if (body.isOffer !== undefined) updateData.isOffer = Boolean(body.isOffer)
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl || null
    if (body.images !== undefined) updateData.images = body.images || []
    if (body.ico !== undefined) updateData.ico = body.ico
    if (body.availableFrom !== undefined) {
      updateData.availableFrom = body.availableFrom ? new Date(body.availableFrom) : null
    }
    if (body.offerStart !== undefined) {
      updateData.offerStart = body.offerStart ? new Date(body.offerStart) : null
    }
    if (body.offerEnd !== undefined) {
      updateData.offerEnd = body.offerEnd ? new Date(body.offerEnd) : null
    }

    console.log('Update data:', JSON.stringify(updateData))
    
    const updated = await prisma.product.update({
      where: { id },
      data: updateData
    })
    console.log('Updated product:', updated)
    productCache.clear()
    return NextResponse.json(updated, {
      headers: {  }
    })
  } catch (error) { return handleRouteError(error) }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const admin = await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const reason = searchParams.get('reason') || null

    // Bloquear si hay unidades de inventario activas o ventas: son datos que
    // no se pueden dejar huérfanos. Soft-delete siempre (nunca borrado físico).
    const [invActivas, ventas] = await Promise.all([
      prisma.inventoryItem.count({ where: { productId: id, status: { in: ['IN_STOCK', 'IN_REPAIR', 'RESERVED', 'ON_HOLD'] } } }),
      prisma.orderItem.count({ where: { productId: id } }),
    ])
    if (invActivas > 0) {
      return NextResponse.json(
        { error: `El producto tiene ${invActivas} unidad(es) de inventario activa(s). Dá de baja las unidades primero.` },
        { status: 409 },
      )
    }
    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: admin.id, deleteReason: reason, stock: 0 },
    })
    productCache.clear()
    return NextResponse.json({ message: 'Producto dado de baja', softDeleted: true, hadSales: ventas > 0 })
  } catch (error) { return handleRouteError(error) }
}
