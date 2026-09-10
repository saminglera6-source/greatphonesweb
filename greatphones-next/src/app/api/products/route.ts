import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ProductCreateSchema, ProductUpdateSchema, formatZodError } from '@/lib/validations'
import { productCache } from '@/lib/cache'
import { getCorsHeaders, corsOptions } from '@/lib/cors'
import { requireAdmin, handleRouteError, AuthError } from '@/lib/auth-guard'
import { rateLimit, clientIpKey } from '@/lib/rate-limit'
import { expireOffers } from '@/lib/expire-offers'

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin') || '*'
  const corsHeaders = getCorsHeaders(origin)
  const ip = clientIpKey(request)
  const rl = await rateLimit(`products:${ip}`, 30, 60000)
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error:
          'Demasiadas solicitudes. Reintenta en ' +
          Math.ceil((rl.resetAt - Date.now()) / 1000) +
          's',
      },
      { status: 429 },
    )
  }
  const { searchParams } = new URL(request.url)
  const brand = searchParams.get('brand')
  const offer = searchParams.get('offer')
  const search = searchParams.get('search')
  const preorder = searchParams.get('preorder')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const isAdmin = request.headers.get('x-user-id') && request.headers.get('x-admin-request') === '1'

  const cacheKey = `products:${brand || ''}:${offer || ''}:${search || ''}:${preorder || ''}:${page}:${limit}`
  const cached = productCache.get(cacheKey)
  if (cached) {
    return NextResponse.json(cached, { headers: corsHeaders })
  }

  try {
    await expireOffers()
    const where: any = {}
    where.deletedAt = null

    if (brand) {
      where.brand = { equals: brand, mode: 'insensitive' }
    }

    if (offer === 'true') {
      where.isOffer = true
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { sub: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (preorder === 'true') {
      where.isPreorder = true
    } else if (preorder === 'false') {
      where.isPreorder = { not: true }
    } else if (isAdmin) {
      // Admin: excluye preventas por defecto (stock real solamente)
      where.isPreorder = { not: true }
    }
    // Catálogo público sin filtro: muestra todos (normales + preventa)

    const total = await prisma.product.count({ where })
    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    // Precio mínimo real por producto (IMEIs disponibles): lo usan las cards y
    // el detalle para mostrar el mismo precio. Solo para productos no-preventa.
    let variantStats: Record<string, { minTargetPrice: number; variantCount: number }> = {}
    try {
      if (
        products.length > 0 &&
        prisma.inventoryItem &&
        typeof prisma.inventoryItem.groupBy === 'function'
      ) {
        const agg = await prisma.inventoryItem.groupBy({
          by: ['productId'],
          _min: { targetPrice: true },
          _count: { _all: true },
          where: {
            productId: { in: products.map((p: any) => p.id) },
            status: 'IN_STOCK',
          },
        })
        variantStats = {}
        agg.forEach((r: any) => {
          variantStats[r.productId] = {
            minTargetPrice: r._min.targetPrice || 0,
            variantCount: r._count._all || 0,
          }
        })
        products.forEach((p: any) => {
          const st = variantStats[p.id]
          p.minTargetPrice = st ? st.minTargetPrice : 0
          p.variantCount = st ? st.variantCount : 0
        })
      }

      // Equipos en reparación por producto. Nota: NO se puede condicionar a
      // `isAdmin` (headers x-user-id/x-admin-request) porque ningún cliente
      // real del repo envía esos headers al pedir /api/products — la bandera
      // siempre da false y este bloque nunca corría. Son solo ids, sin datos
      // sensibles, así que se calcula siempre que haya productos.
      let repairItemsByProduct: Record<string, string[]> = {}
      if (products.length > 0) {
        try {
          const repairItems = await prisma.inventoryItem.findMany({
            where: {
              productId: { in: products.map((p: any) => p.id) },
              status: 'IN_REPAIR',
            },
            select: { id: true, productId: true },
          })
          repairItems.forEach((item: any) => {
            if (!repairItemsByProduct[item.productId]) {
              repairItemsByProduct[item.productId] = []
            }
            repairItemsByProduct[item.productId].push(item.id)
          })
          products.forEach((p: any) => {
            p.repairItemIds = repairItemsByProduct[p.id] || []
          })
        } catch (err) {
          console.error('[Products] Error computing repair stats:', err)
        }
      }

      // Preventas: sin IMEIs en stock. El "Desde/ N variantes" se calcula
      // agrupando productos con el mismo modelGroup e isPreorder=true.
      const pregroup = products.filter((p: any) => p.isPreorder && p.modelGroup)
      if (pregroup.length > 0) {
        const groups = new Map<string, { min: number; count: number }>()
        pregroup.forEach((p: any) => {
          const g = groups.get(p.modelGroup) || { min: Infinity, count: 0 }
          g.min = Math.min(g.min, Number(p.price) || 0)
          g.count++
          groups.set(p.modelGroup, g)
        })
        products.forEach((p: any) => {
          if (p.isPreorder && p.modelGroup && groups.has(p.modelGroup)) {
            const g = groups.get(p.modelGroup)!
            p.progroupMin = g.min === Infinity ? 0 : g.min
            p.progroupCount = g.count
          }
        })
      }
    } catch (aggErr) {
      console.error('[Products] Error computing variant stats:', aggErr)
    }

    const response = {
      data: products,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }

    productCache.set(cacheKey, response)

    return NextResponse.json(response, { headers: corsHeaders })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  try {
    await requireAdmin(request)
    const body = await request.json()

    // Validar body
    const validation = ProductCreateSchema.safeParse(body)
    if (!validation.success) {
      console.error('Product validation failed:', JSON.stringify(validation.error.issues, null, 2))
      return NextResponse.json(formatZodError(validation.error), {
        status: 400,
        headers: corsHeaders,
      })
    }

    console.log('Creating product with data:', body)

    let imageUrl = body.imageUrl || null
    if (!imageUrl && body.name) {
      try {
        const priceEntry = await prisma.priceList.findFirst({
          where: {
            modelo: body.name,
            almacenamiento: body.storage || '',
            deletedAt: null,
          },
          select: { imageUrl: true },
        })
        if (priceEntry?.imageUrl) imageUrl = priceEntry.imageUrl
        else {
          const fallback = await prisma.priceList.findFirst({
            where: { modelo: body.name, deletedAt: null },
            orderBy: { almacenamiento: 'desc' },
            select: { imageUrl: true },
          })
          if (fallback?.imageUrl) imageUrl = fallback.imageUrl
        }
      } catch {}
    }

    const newProduct = await prisma.product.create({
      data: {
        name: body.name,
        ico: body.ico || '📱',
        imageUrl: imageUrl,
        brand: body.brand,
        sub: body.sub,
        condition: body.condition || 'Nuevo',
        description: body.description || null,
        modelGroup: body.modelGroup || null,
        price: Number(body.price) || 0,
        cost: Number(body.cost) || 0,
        stock: Number(body.stock) || 0,
        type: body.type || 'celular',
        storage: body.storage || null,
        ram: body.ram || null,
        battery: body.battery ? Number(body.battery) : null,
        processor: body.processor || null,
        images: body.images || [],
        color: body.color || null,
        screen: body.screen ? Number(body.screen) : null,
        isOffer: Boolean(body.isOffer),
        discount: Number(body.discount) || 0,
        offerStart: body.offerStart ? new Date(body.offerStart) : null,
        offerEnd: body.offerEnd ? new Date(body.offerEnd) : null,
        isPreorder: Boolean(body.isPreorder),
        availableFrom: body.availableFrom ? new Date(body.availableFrom) : null,
      },
    })

    productCache.clear()

    await prisma.productLog.create({
      data: {
        productId: newProduct.id,
        name: newProduct.name,
        brand: newProduct.brand,
        price: newProduct.price,
        cost: newProduct.cost,
        stock: newProduct.stock,
        discount: newProduct.discount,
        condition: newProduct.condition,
        type: newProduct.type,
        color: newProduct.color,
        storage: newProduct.storage,
        ram: newProduct.ram,
        battery: newProduct.battery,
        imei: newProduct.imei,
        source: 'manual',
      },
    })

    return NextResponse.json(newProduct, { status: 201, headers: corsHeaders })
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500
    return NextResponse.json({ error: 'Error al crear producto' }, { status, headers: corsHeaders })
  }
}

export async function PUT(request: Request) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400, headers: corsHeaders })
    }

    const body = await request.json()

    const validation = ProductUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(formatZodError(validation.error), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.ico && { ico: body.ico }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl || null }),
        ...(body.brand && { brand: body.brand }),
        ...(body.sub && { sub: body.sub }),
        ...(body.condition && { condition: body.condition }),
        ...(body.description !== undefined && { description: body.description || null }),
        ...(body.modelGroup !== undefined && { modelGroup: body.modelGroup || null }),
        ...(body.price !== undefined && { price: Number(body.price) }),
        ...(body.cost !== undefined && { cost: Number(body.cost) }),
        ...(body.stock !== undefined && { stock: Number(body.stock) }),
        ...(body.type && { type: body.type }),
        ...(body.storage !== undefined && { storage: body.storage || null }),
        ...(body.ram !== undefined && { ram: body.ram || null }),
        ...(body.battery !== undefined && { battery: body.battery ? Number(body.battery) : null }),
        ...(body.processor !== undefined && { processor: body.processor || null }),
        ...(body.images && { images: body.images }),
        ...(body.color !== undefined && { color: body.color || null }),
        ...(body.screen !== undefined && { screen: body.screen ? Number(body.screen) : null }),
        ...(body.isOffer !== undefined && { isOffer: Boolean(body.isOffer) }),
        ...(body.discount !== undefined && { discount: Number(body.discount) }),
        ...(body.offerStart && { offerStart: new Date(body.offerStart) }),
        ...(body.offerEnd && { offerEnd: new Date(body.offerEnd) }),
        ...(body.isPreorder !== undefined && { isPreorder: Boolean(body.isPreorder) }),
        ...(body.availableFrom !== undefined && {
          availableFrom: body.availableFrom ? new Date(body.availableFrom) : null,
        }),
      },
    })

    productCache.clear()

    // Sincronizar el precio de los IMEIs en stock del producto: el precio que
    // ve el cliente (card / detalle / checkout) se calcula desde minTargetPrice
    // de los IMEIs. Si el admin cambia el precio del producto, propagarlo a los
    // IMEIs para que no queden precios viejos inconsistentes.
    let syncedImeis = 0
    if (body.price !== undefined) {
      try {
        if (prisma.inventoryItem && typeof prisma.inventoryItem.updateMany === 'function') {
          const sync = await prisma.inventoryItem.updateMany({
            where: { productId: id, status: 'IN_STOCK' },
            data: { targetPrice: Number(body.price) },
          })
          syncedImeis = sync.count
        }
      } catch (syncErr) {
        console.error('[Products] Error syncing inventory prices:', syncErr)
      }
    }

    return NextResponse.json({ ...updatedProduct, syncedImeis }, { headers: corsHeaders })
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500
    return NextResponse.json(
      { error: 'Error al actualizar producto' },
      { status, headers: corsHeaders },
    )
  }
}

export async function DELETE(request: Request) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const reason = searchParams.get('reason') || 'Eliminación desde el panel'

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400, headers: corsHeaders })
    }

    // Integridad (Fase 3): nunca se borra, se anula con soft-delete + auditoría.
    const { anular } = await import('@/lib/audit')
    await anular({
      entityType: 'Product',
      entityId: id,
      reason,
    }).catch(err => console.error('[Product DELETE] audit:', err))

    await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: { deletedAt: new Date(), isPreorder: false },
      }),
    ])

    productCache.clear()
    return NextResponse.json(
      { success: true, message: 'Producto anulado correctamente' },
      { headers: corsHeaders },
    )
  } catch (error) {
    console.error('Error al anular producto:', error)
    return NextResponse.json(
      { error: 'Error al anular producto' },
      { status: 500, headers: corsHeaders },
    )
  }
}
