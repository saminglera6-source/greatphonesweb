import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-guard'
import { auditar } from '@/lib/audit'



export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const adminId = searchParams.get('adminId')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = { deletedAt: null }
    if (status) where.status = status
    if (adminId) where.adminId = adminId

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true, avatar: true }
        },
        admin: {
          select: { name: true, email: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { lastMsgAt: 'desc' },
      take: Math.min(limit, 100),
    })

    return NextResponse.json(conversations, {
      headers: {  }
    })
  } catch (error) {
    console.error('Error fetching admin conversations:', error)
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const body = await request.json()
    const { conversationId, adminId, action } = body

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId requerido' }, { status: 400 })
    }

    if (action === 'assign') {
      if (!adminId) {
        return NextResponse.json({ error: 'adminId requerido' }, { status: 400 })
      }

      const conversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          adminId,
          status: 'OPEN'
        },
        include: {
          admin: {
            select: { name: true, email: true }
          }
        }
      })

      return NextResponse.json(conversation)
    }

    if (action === 'close') {
      const conversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: 'CLOSED',
          closedAt: new Date()
        }
      })

      return NextResponse.json(conversation)
    }

    if (action === 'delete') {
      // Soft-delete (ERP regla 1): se marca, nunca se borran los mensajes.
      const previo = await prisma.conversation.findUnique({ where: { id: conversationId } })
      if (!previo) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          deletedAt: new Date(),
          deletedBy: admin.email,
          deleteReason: body.motivo || null,
          status: 'CLOSED',
          closedAt: previo.closedAt || new Date(),
        },
      })
      await auditar({
        entityType: 'Conversation',
        entityId: conversationId,
        action: 'ANULACION',
        reason: `Baja de conversación de ${previo.userId}${body.motivo ? ' — ' + body.motivo : ''}`,
        operator: admin.email,
        createdById: admin.id,
        snapshot: previo,
      }).catch(() => {})

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'AcciÃ³n no vÃ¡lida' }, { status: 400 })
  } catch (error) {
    console.error('Error updating conversation:', error)
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 })
  }
}
