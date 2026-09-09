import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  AccessoryCreateSchema,
  AccessoryUpdateSchema,
  formatZodError
} from '@/lib/validations'
import { accessoryCache } from '@/lib/cache'
import { getCorsHeaders, corsOptions } from '@/lib/cors'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { rateLimit, clientIpKey } from '@/lib/rate-limit'
import { expireOffers } from '@/lib/expire-offers'

// El campo "Proveedor" del form de accesorios es texto libre (no un select),
// pero Accessory.supplierId es una FK real a Supplier. Buscamos un Supplier
// existente por nombre (o por id, por si algún día vuelve a ser un select) y,
// si no existe, lo creamos — así el usuario puede escribir cualquier nombre
// sin que la creación del accesorio falle por violar la foreign key.
async function resolveSupplierId(raw: unknown): Promise<string | null> {
  const name = typeof raw === 'string' ? raw.trim() : ''
  if (!name) return null
  const byId = await prisma.supplier.findUnique({ where: { id: name } }).catch(() => null)
  if (byId) return byId.id
  const existing = await prisma.supplier.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })
  if (existing) return existing.id
  const created = await prisma.supplier.create({ data: { name, type: 'local' } })
  return created.id
}

export async function GET(request: Request) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  const ip = clientIpKey(request)
  const rl = await rateLimit(`accessories:${ip}`, 30, 60000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
  }
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const category = searchParams.get('category')
  const brand = searchParams.get('brand')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  try {
    if (id) {
      const cacheKey = `accessory:${id}`
      const cached = accessoryCache.get(cacheKey)
      if (cached) {
        return NextResponse.json(cached, { headers: corsHeaders })
      }
      const accessory = await prisma.accessory.findUnique({ where: { id } })
      if (!accessory) {
        return NextResponse.json({ error: 'Accesorio no encontrado' }, { status: 404, headers: corsHeaders })
      }
      accessoryCache.set(cacheKey, accessory)
      return NextResponse.json(accessory, { headers: corsHeaders })
    }

    const cacheKey = `accessories:${category||''}:${brand||''}:${search||''}:${page}:${limit}`
    const cached = accessoryCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached, { headers: corsHeaders })
    }

    await expireOffers()

    const where: any = { isActive: true }

    if (category && category !== 'todos') {
      where.category = category
    }

    if (brand) {
      where.brand = { equals: brand, mode: 'insensitive' }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const total = await prisma.accessory.count({ where })
    const accessories = await prisma.accessory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    const response = {
      data: accessories,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }

    accessoryCache.set(cacheKey, response)

    return NextResponse.json(response, { headers: corsHeaders })
  } catch (error) { return handleRouteError(error) }
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  try {
    await requireAdmin(request)
    const body = await request.json()
    
    // Validar body
    const validation = AccessoryCreateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(formatZodError(validation.error), { status: 400, headers: corsHeaders })
    }
    
    console.log('Creating accessory with data:', body)
    
    const newAccessory = await prisma.accessory.create({
      data: {
        name: body.name,
        ico: body.ico || '📦',
        description: body.description || null,
        category: body.category,
        price: Number(body.price) || 0,
        cost: Number(body.cost) || 0,
        compareAtPrice: body.compareAtPrice ? Number(body.compareAtPrice) : null,
        stock: Number(body.stock) || 0,
        supplierId: await resolveSupplierId(body.supplierId),
        imageUrl: body.imageUrl || null,
        images: body.images || [],
        brand: body.brand || null,
        color: body.color || null,
        compatibleModels: body.compatibleModels || null,
        modelGroup: body.modelGroup || null,
        isActive: body.isActive !== false,
        discount: body.discount ? Number(body.discount) : null,
        isOffer: body.isOffer || false,
        offerStart: body.offerStart ? new Date(body.offerStart) : null,
        offerEnd: body.offerEnd ? new Date(body.offerEnd) : null,
      },
    })

    accessoryCache.clear()

    return NextResponse.json(newAccessory, { status: 201, headers: corsHeaders })
  } catch (error) { return handleRouteError(error) }
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
    console.log('PUT accessory body:', JSON.stringify(body, null, 2))
    
    // Validar body (partial para updates)
    const validation = AccessoryUpdateSchema.safeParse(body)
    if (!validation.success) {
      console.error('Zod validation failed:', JSON.stringify(validation.error.issues, null, 2))
      return NextResponse.json(formatZodError(validation.error), { status: 400, headers: corsHeaders })
    }
    
    const data: any = {}
    if (body.name) data.name = body.name
    if (body.ico) data.ico = body.ico
    if (body.description !== undefined) data.description = body.description || null
    if (body.category) data.category = body.category
    if (body.price !== undefined) data.price = Number(body.price)
    if (body.cost !== undefined) data.cost = Number(body.cost)
    if (body.supplierId !== undefined) data.supplierId = await resolveSupplierId(body.supplierId)
    if (body.compareAtPrice !== undefined) data.compareAtPrice = body.compareAtPrice ? Number(body.compareAtPrice) : null
    if (body.stock !== undefined) data.stock = Number(body.stock)
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl || null
    if (body.images !== undefined) data.images = Array.isArray(body.images) ? body.images : []
    if (body.brand !== undefined) data.brand = body.brand || null
    if (body.color !== undefined) data.color = body.color || null
    if (body.compatibleModels !== undefined) data.compatibleModels = body.compatibleModels || null
    if (body.modelGroup !== undefined) data.modelGroup = body.modelGroup || null
    if (body.colorStock !== undefined) data.colorStock = body.colorStock || null
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.discount !== undefined) data.discount = body.discount !== null ? Number(body.discount) : null
    if (body.isOffer !== undefined) data.isOffer = body.isOffer
    if (body.offerStart !== undefined) data.offerStart = body.offerStart ? new Date(body.offerStart) : null
    if (body.offerEnd !== undefined) data.offerEnd = body.offerEnd ? new Date(body.offerEnd) : null
    
    console.log('Prisma update data:', JSON.stringify(data, null, 2))
    
    const updatedAccessory = await prisma.accessory.update({
      where: { id },
      data,
    })

    accessoryCache.clear()

    return NextResponse.json(updatedAccessory, { headers: corsHeaders })
  } catch (error) { return handleRouteError(error) }
}

export async function DELETE(request: Request) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  try {
    const admin = await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const reason = searchParams.get('reason') || null

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400, headers: corsHeaders })
    }

    // Soft-delete (nunca borrado físico): el accesorio puede estar referenciado
    // por ventas / líneas de pedido.
    await prisma.accessory.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date(), deletedBy: admin.id, deleteReason: reason },
    })

    accessoryCache.clear()

    return NextResponse.json({ success: true, softDeleted: true }, { headers: corsHeaders })
  } catch (error) { return handleRouteError(error) }
}
