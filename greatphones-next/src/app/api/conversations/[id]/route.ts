import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession, handleRouteError } from '@/lib/auth-guard'



export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const user = await requireSession(request)
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        user: {
          select: { name: true, email: true, avatar: true }
        },
        admin: {
          select: { name: true, email: true }
        }
      }
    })

    if (!conversation || conversation.deletedAt) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    if (conversation.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    return NextResponse.json(conversation, {
      headers: {  }
    })
  } catch (error) { return handleRouteError(error) }
}
