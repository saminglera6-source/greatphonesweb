import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { 
  OrderCreateSchema, 
  OrderQuerySchema,
  formatZodError 
} from '@/lib/validations'
import { sendOrderStatusEmail } from '@/lib/email'
import { requireAdmin, requireSession, handleRouteError } from '@/lib/auth-guard'
import { restoreStock } from '@/lib/stock'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || undefined
    const admin = searchParams.get('admin')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    
    let authUser: { id: string; role: string } | null = null
    // Allow unauthenticated access; if auth fails, continue as anonymous
    try { authUser = await requireSession(request) } catch {}
    
    if (admin === 'true') {
      if (!authUser || authUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
      }
    } else if (userId) {
      if (!authUser || (authUser.id !== userId && authUser.role !== 'ADMIN')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
    } else {
      if (!authUser || authUser.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
      }
    }

    const user = authUser
    
    const status = searchParams.get('status') || undefined
    const where: any = {}
    
    if (status) {
      const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']
      const statusList = status.split(',').map(s => s.trim().toUpperCase())
      
      for (const s of statusList) {
        if (!validStatuses.includes(s)) {
          return NextResponse.json({ error: `Invalid status: ${s}` }, { status: 400 })
        }
      }
      
      if (statusList.length === 1) {
        where.status = statusList[0]
      } else {
        where.status = { in: statusList }
      }
    }
    
    if (userId) {
      where.userId = userId
    }
    
    if (search && admin === 'true') {
      where.OR = [
        { clientDni: { contains: search, mode: 'insensitive' } },
        { clientEmail: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ]
    }
    
    const total = await prisma.order.count({ where })
    
    // Admin view: include user and product details
    if (admin === 'true') {
      const orders = await prisma.order.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                  brand: true,
                  sub: true,
                }
              }
            }
          },
          orderCoupons: {
            include: {
              coupon: {
                select: {
                  code: true,
                }
              }
            }
          },
          invoice: {
            select: {
              id: true,
              type: true,
              pos: true,
              number: true,
              cae: true,
              caeExpiry: true,
              status: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })
      
      // Transform to include product details in items
      const transformed = orders.map(order => ({
        ...order,
        items: order.items.map(item => ({
          ...item,
          productName: item.product?.name || 'Producto eliminado',
          productImage: item.product?.imageUrl || null,
          productBrand: item.product?.brand || '',
          productSub: item.product?.sub || '',
        }))
      }))
      
      return NextResponse.json({
        data: transformed,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      })
    }
    
    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                brand: true,
                sub: true,
              }
            }
          }
        },
        orderCoupons: {
          include: {
            coupon: {
              select: {
                code: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })
    
    return NextResponse.json({
      data: orders,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) { return handleRouteError(error) }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    
    // Validar body
    const validation = OrderCreateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(formatZodError(validation.error), { status: 400 })
    }
    
    const { items, userId, email, phone, document, street, number, floor, zip, city, province, warranty, cuotas, subtotal, total, notes } = body
    
    // Find or create user
    let finalUserId = userId
    if (!finalUserId && email) {
      const existingUser = await prisma.user.findFirst({
        where: { email }
      })
      if (existingUser) {
        finalUserId = existingUser.id
      } else {
        const newUser = await prisma.user.create({
          data: {
            email,
            name: email.split('@')[0],
            phone: phone || null,
          }
        })
        finalUserId = newUser.id
      }
    }
    
    if (!finalUserId) {
      return NextResponse.json({ error: 'User ID or email is required' }, { status: 400 })
    }
    
    // Generate order code
    const code = `GP-${Date.now()}`
    
    // Create order with items - usando nombres del schema
    const order = await prisma.order.create({
      data: {
        code,
        userId: finalUserId,
        clientEmail: email || null,
        clientPhone: phone || null,
        clientDni: document || null,
        shippingStreet: street,
        shippingNumber: number,
        shippingFloor: floor || null,
        shippingZip: zip,
        shippingCity: city,
        shippingProvince: province,
        ...(warranty && { warranty: '12 meses' }),
        cuotas: cuotas || 1,
        subtotal,
        total,
        notes: notes || null,
        status: 'PENDING',
        items: {
          create: items.map((item: any) => ({
            productId: item.id,
            quantity: item.quantity || 1,
            price: item.price,
          }))
        }
      },
      include: {
        items: true
      }
    })
    
    return NextResponse.json(order, { status: 201 })
  } catch (error) { return handleRouteError(error) }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }
    
    const body = await request.json()
    const { status, trackingNumber } = body
    
    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }
    
    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']
    if (!validStatuses.includes(status.toUpperCase())) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        items: {
          include: {
            product: true
          }
        }
      }
    })
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    
    const oldStatus = order.status
    const newStatus = status.toUpperCase()

    // Validate status transition
    const VALID_TRANSITIONS: Record<string, string[]> = {
      PENDING: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: [],
    }

    if (newStatus !== oldStatus &&
        (!VALID_TRANSITIONS[oldStatus] || !VALID_TRANSITIONS[oldStatus].includes(newStatus))) {
      return NextResponse.json({
        error: `Transición inválida: ${oldStatus} → ${newStatus}`,
        validTransitions: VALID_TRANSITIONS[oldStatus] || [],
      }, { status: 400 })
    }

    const updateData: any = { status: newStatus }
    
    if (newStatus === 'SHIPPED' && trackingNumber) {
      updateData.trackingNumber = trackingNumber
      updateData.shippedAt = new Date()
    }

    // Restore stock if cancelling a PENDING or PROCESSING order
    if (newStatus === 'CANCELLED' && (oldStatus === 'PENDING' || oldStatus === 'PROCESSING')) {
      await prisma.$transaction(async (tx) => {
        await restoreStock(tx, order.items, false, order.code)
      });
    }
    
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        items: {
          include: {
            product: true
          }
        }
      }
    })
    
    // Send email notification if status changed
    if (oldStatus !== newStatus) {
      sendOrderStatusEmail({
        email: order.clientEmail || order.user?.email || '',
        userName: order.user?.name || 'Cliente',
        orderCode: order.code,
        oldStatus,
        newStatus,
        trackingNumber: trackingNumber || updatedOrder.trackingNumber || undefined,
      }).catch((err) => console.error('[Orders] Error sending status email:', err))
    }
    
    const transformed = {
      ...updatedOrder,
      items: updatedOrder.items.map(item => ({
        ...item,
        productName: item.product?.name || 'Producto eliminado',
        productImage: item.product?.imageUrl || null,
        productBrand: item.product?.brand || '',
        productSub: item.product?.sub || '',
      }))
    }
    
    return NextResponse.json(transformed)
  } catch (error) { return handleRouteError(error) }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.deletedAt) {
      return NextResponse.json({ error: 'El pedido ya fue anulado' }, { status: 409 })
    }

    const reason = searchParams.get('reason') || null
    const admin = await requireAdmin(request)

    // Liberar stock reservado y marcar el pedido anulado (soft-delete —
    // nunca se borra un pedido: es un registro contable y de auditoría).
    await prisma.$transaction(async (tx) => {
      if (order.status === 'PENDING' || order.status === 'PROCESSING') {
        await restoreStock(tx, order.items, false, order.code)
      }
      await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          deletedAt: new Date(),
          deletedBy: admin.id,
          deleteReason: reason,
        },
      })
    })

    return NextResponse.json({ success: true, softDeleted: true })
  } catch (error) { return handleRouteError(error) }
}