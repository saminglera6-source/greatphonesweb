import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CreateConversationSchema, formatZodError } from '@/lib/validations'
import { requireSession, handleRouteError } from '@/lib/auth-guard'
import { rateLimit } from '@/lib/rate-limit'



export async function GET(request: Request) {
  try {
    const user = await requireSession(request)
    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id, deletedAt: null },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        user: {
          select: { name: true, email: true, avatar: true }
        }
      },
      orderBy: { lastMsgAt: 'desc' }
    })

    return NextResponse.json(conversations, {
      headers: {  }
    })
  } catch (error) { return handleRouteError(error) }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const validation = CreateConversationSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(formatZodError(validation.error), { status: 400 })
    }

    const user = await requireSession(request)
    const rl = await rateLimit(`conv-create:${user.id}`, 5, 60000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Has creado muchas conversaciones. Espera un momento.' }, { status: 429 })
    }
    const { type, subject, firstMessage } = validation.data

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        type,
        subject,
        ...(firstMessage && {
          messages: {
            create: {
              from: user.id,
              fromUserId: user.id,
              text: firstMessage
            }
          }
        })
      },
      include: {
        messages: true,
        user: {
          select: { name: true, email: true }
        }
      }
    })

    return NextResponse.json(conversation, { status: 201 })
  } catch (error) { return handleRouteError(error) }
}
