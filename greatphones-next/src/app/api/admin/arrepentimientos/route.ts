import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { auditar } from '@/lib/audit'



export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const arrepentimientos = await prisma.arrepentimiento.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            total: true,
          }
        },
        user: {
          select: {
            name: true,
            email: true,
          }
        }
      }
    })

    return NextResponse.json(arrepentimientos, {
      headers: {  }
    })
  } catch (error) {
    console.error('[ADMIN ARREPENTIMIENTOS] Error:', error)
    return NextResponse.json(
      { error: 'Error al obtener arrepentimientos' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const body = await request.json()
    const { id, estado } = body

    if (!id || !estado) {
      return NextResponse.json(
        { error: 'ID y estado son requeridos' },
        { status: 400 }
      )
    }

    const validStates = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'COMPLETADO']
    if (!validStates.includes(estado)) {
      return NextResponse.json(
        { error: 'Estado inválido' },
        { status: 400 }
      )
    }

    const previo = await prisma.arrepentimiento.findUnique({ where: { id } })
    if (!previo) {
      return NextResponse.json({ error: 'Arrepentimiento no encontrado' }, { status: 404 })
    }

    const updated = await prisma.arrepentimiento.update({
      where: { id },
      data: { estado }
    })

    // Traza de responsable (ERP §3.20): quién cambió el estado y desde cuál.
    await auditar({
      entityType: 'Arrepentimiento',
      entityId: id,
      action: 'UPDATE',
      reason: `Arrepentimiento ${previo.estado} → ${estado}`,
      operator: admin.email,
      createdById: admin.id,
      snapshot: previo,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: 'Estado actualizado',
      data: updated
    }, {
      headers: {  }
    })
  } catch (error) {
    console.error('[ADMIN ARREPENTIMIENTOS] PATCH Error:', error)
    return NextResponse.json(
      { error: 'Error al actualizar estado' },
      { status: 500 }
    )
  }
}
