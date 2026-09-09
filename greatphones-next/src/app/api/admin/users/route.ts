import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get('limit') ?? DEFAULT_LIMIT)))

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, email: true, role: true,
          createdAt: true, phone: true, direccion: true,
        },
      }),
      prisma.user.count(),
    ])
    return NextResponse.json({ users, total, page, limit })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const { id, role } = body

    if (!id || !role) {
      return NextResponse.json({ error: 'id y role son requeridos' }, { status: 400 })
    }

    if (!['ADMIN', 'CLIENT'].includes(role)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role: role as 'ADMIN' | 'CLIENT' },
      select: { id: true, name: true, email: true, role: true },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 })
  }
}

/**
 * "Eliminar" un usuario = DESACTIVARLO. Nunca se borra un usuario con historia
 * comercial (pedidos, ventas, cotizaciones, reparaciones, preventas, cupones):
 * eso destruiría registros contables y de auditoría. Si no tiene ninguna
 * operación, se hace un borrado físico real (es solo una cuenta vacía).
 */
export async function DELETE(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const rawIds = searchParams.get('ids')
    const singleId = searchParams.get('id')
    const reason = searchParams.get('reason') || null
    const ids = rawIds ? rawIds.split(',').map(s => s.trim()).filter(Boolean) : (singleId ? [singleId] : [])

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Falta un id de usuario' }, { status: 400 })
    }

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
    const adminIds = new Set(admins.map(u => u.id))
    for (const id of ids) {
      if (adminIds.has(id)) {
        return NextResponse.json({ error: 'No se puede eliminar un usuario administrador' }, { status: 400 })
      }
    }

    let deactivated = 0
    let deleted = 0
    for (const id of ids) {
      const [orders, sales, quotes, repairs, preorders, coupons, guarantees] = await Promise.all([
        prisma.order.count({ where: { userId: id } }),
        prisma.sale.count({ where: { userId: id } }),
        prisma.quote.count({ where: { userId: id } }),
        prisma.repair.count({ where: { userId: id } }),
        prisma.preOrder.count({ where: { OR: [{ userId: id }, { createdById: id }] } }),
        prisma.coupon.count({ where: { userId: id } }),
        prisma.guarantee.count({ where: { userId: id } }),
      ])
      const tieneOps = orders + sales + quotes + repairs + preorders + coupons + guarantees > 0

      if (tieneOps) {
        await prisma.user.update({
          where: { id },
          data: { active: false, deactivatedAt: new Date(), deactivatedReason: reason },
        })
        await prisma.session.deleteMany({ where: { userId: id } }) // cerrar sesiones
        deactivated++
      } else {
        await prisma.$transaction(async tx => {
          await tx.message.deleteMany({ where: { fromUserId: id } })
          await tx.notification.deleteMany({ where: { userId: id } })
          await tx.favorite.deleteMany({ where: { userId: id } })
          await tx.cartItem.deleteMany({ where: { cart: { userId: id } } })
          await tx.cart.deleteMany({ where: { userId: id } })
          const wallets = await tx.wallet.findMany({ where: { userId: id }, select: { id: true } })
          if (wallets.length) {
            await tx.walletTransaction.deleteMany({ where: { walletId: { in: wallets.map(w => w.id) } } })
            await tx.wallet.deleteMany({ where: { userId: id } })
          }
          await tx.session.deleteMany({ where: { userId: id } })
          await tx.account.deleteMany({ where: { userId: id } })
          await tx.user.delete({ where: { id } })
        })
        deleted++
      }
    }

    return NextResponse.json({
      success: true,
      deactivated,
      deleted,
      message:
        deactivated > 0
          ? `${deactivated} usuario(s) desactivado(s) (tienen historia comercial que se conserva)` +
            (deleted > 0 ? ` · ${deleted} eliminado(s)` : '')
          : `${deleted} usuario(s) eliminado(s)`,
    })
  } catch (error: any) {
    if (error?.code === 'P2003') {
      return NextResponse.json(
        { error: 'El usuario tiene registros asociados. Se puede desactivar, no eliminar.' },
        { status: 409 },
      )
    }
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 })
  }
}
