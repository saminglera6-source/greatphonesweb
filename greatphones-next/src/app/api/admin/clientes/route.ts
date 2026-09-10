import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'

/**
 * Índice de clientes para la ficha 360 (mejora sobre el ERP, que trata al
 * cliente como texto libre por operación). Búsqueda por nombre / email / teléfono.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 30)))

    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { phone: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, email: true, phone: true, role: true,
          active: true, createdAt: true,
          _count: { select: { orders: true, sales: true, repairs: true, preOrders: true, quotes: true } },
        },
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({ rows, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    return handleRouteError(error)
  }
}
