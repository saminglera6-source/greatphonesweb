import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SendMessageSchema, formatZodError } from '@/lib/validations'
import { sendNewMessageToAdminEmail, sendAdminReplyEmail } from '@/lib/email'
import { getIO } from '@/lib/socket'
import { requireSession, handleRouteError } from '@/lib/auth-guard'
import { enqueueEmail } from '@/lib/queue'



export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const user = await requireSession(request)

    // Verify ownership: only conversation owner or admin can read messages
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { userId: true }
    })
    if (!conversation) {
      return NextResponse.json({ error: 'ConversaciÃ³n no encontrada' }, { status: 404 })
    }
    if (user.id !== conversation.userId && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const cursor = searchParams.get('cursor')
    const search = searchParams.get('search') || ''

    const where: any = { conversationId: id }

    if (search) {
      where.OR = [
        { text: { contains: search, mode: 'insensitive' } },
        { imageCaption: { contains: search, mode: 'insensitive' } },
      ]
    }

    const query: any = {
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: {
        fromUser: {
          select: { name: true, avatar: true }
        }
      }
    }

    if (cursor) {
      query.cursor = { id: cursor }
      query.skip = 1
    }

    const messages = await prisma.message.findMany(query)

    return NextResponse.json(messages.reverse(), {
      headers: {  }
    })
  } catch (error) { return handleRouteError(error) }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()

    const validation = SendMessageSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(formatZodError(validation.error), { status: 400 })
    }

    const user = await requireSession(request)
    const { text, imageUrl, imageCaption } = validation.data
    const isAutoReply = body.isAutoReply === true

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        admin: { select: { id: true, name: true, email: true } }
      }
    })

    if (!conversation || conversation.deletedAt) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Determine if sender is admin or the conversation owner
    const isAdminSender = user.role === 'ADMIN';
    const userId = user.id;
    const isUserSender = conversation.userId === userId;

    if (!isAdminSender && !isUserSender) {
      return NextResponse.json({ error: 'No autorizado â€” no sos parte de esta conversaciÃ³n' }, { status: 403 })
    }

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        from: userId,
        fromUserId: userId,
        text: text || null,
        imageUrl: imageUrl || null,
        imageCaption: imageCaption || null
      },
      include: {
        fromUser: {
          select: { name: true, avatar: true }
        }
      }
    })

    // Update conversation with direction-aware unread counters
    const updateData: any = {
      lastMsgAt: new Date()
    }

    if (isUserSender) {
      // User sent message -> increment admin unread
      updateData.unreadByAdmin = { increment: 1 }
    } else if (isAdminSender) {
      // Admin sent message -> increment user unread
      updateData.unreadByUser = { increment: 1 }
    }

    await prisma.conversation.update({
      where: { id },
      data: updateData
    })

    // Create notification for the recipient (skip for auto-replies)
    if (isAutoReply) {
      // Auto-reply: only notify admin, don't send email
      let targetAdmin = conversation.admin;
      if (!targetAdmin) {
        const autoAdmin = await prisma.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true, name: true, email: true }
        });
        if (autoAdmin) {
          targetAdmin = autoAdmin;
          await prisma.conversation.update({
            where: { id },
            data: { adminId: autoAdmin.id }
          });
        }
      }

      if (targetAdmin) {
        await prisma.notification.create({
          data: {
            userId: targetAdmin.id,
            type: 'MESSAGE',
            title: 'Usuario solicito asesor',
            text: `${conversation.user.name || 'Un usuario'} solicito hablar con un asesor`,
            conversationId: id,
            messageId: message.id
          }
        });

        // Queue email to admin
        const adminEmail = targetAdmin.email || process.env.EMAIL_USER || 'contacto@greatphones.com.ar'
        enqueueEmail({
          type: 'admin-auto-reply',
          to: adminEmail,
          userName: conversation.user.name || 'Usuario',
          messageText: text || '(solicito hablar con un asesor)',
          conversationId: id,
          conversationType: conversation.type,
        }).then(queued => {
          if (queued) return
          sendNewMessageToAdminEmail({
            adminEmail,
            userName: conversation.user.name || 'Usuario',
            messageText: text || '(solicito hablar con un asesor)',
            conversationId: id,
            conversationType: conversation.type,
          }).catch((emailError: Error) => {
            console.error('[Messages] Error sending email to admin:', emailError)
          })
        })
      }
    } else if (isUserSender) {
      // Normal user message: notify admin
      let targetAdmin = conversation.admin;
      if (!targetAdmin) {
        // Auto-assign first available admin
        const autoAdmin = await prisma.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true, name: true, email: true }
        });
        if (autoAdmin) {
          targetAdmin = autoAdmin;
          await prisma.conversation.update({
            where: { id },
            data: { adminId: autoAdmin.id }
          });
        }
      }

      if (targetAdmin) {
        // Notify admin about new message from user
        await prisma.notification.create({
          data: {
            userId: targetAdmin.id,
            type: 'MESSAGE',
            title: 'Nuevo mensaje',
            text: `${conversation.user.name || 'Un usuario'} te ha enviado un mensaje`,
            conversationId: id,
            messageId: message.id
          }
        });

        // Queue email to admin
        const adminEmail = targetAdmin.email || process.env.EMAIL_USER || 'contacto@greatphones.com.ar'
        enqueueEmail({
          type: 'admin-new-message',
          to: adminEmail,
          userName: conversation.user.name || 'Usuario',
          messageText: text || '(imagen)',
          conversationId: id,
          conversationType: conversation.type,
        }).then(queued => {
          if (queued) return
          sendNewMessageToAdminEmail({
            adminEmail,
            userName: conversation.user.name || 'Usuario',
            messageText: text || '(imagen)',
            conversationId: id,
            conversationType: conversation.type,
          }).catch((emailError: Error) => {
            console.error('[Messages] Error sending email to admin:', emailError)
          })
        })
      }
    } else if (isAdminSender) {
      // Notify user about admin reply
      await prisma.notification.create({
        data: {
          userId: conversation.userId,
          type: 'MESSAGE',
          title: 'Nuevo mensaje del administrador',
          text: 'Tienes un nuevo mensaje del administrador',
          conversationId: id,
          messageId: message.id
        }
      })

      // Queue email to user
      if (conversation.user.email) {
        enqueueEmail({
          type: 'admin-reply',
          to: conversation.user.email,
          userName: conversation.user.name || 'Usuario',
          adminName: 'Great Phones',
          messageText: text || '(imagen)',
          conversationId: id,
        }).then(queued => {
          if (queued) return
          sendAdminReplyEmail({
            userEmail: conversation.user.email!,
            userName: conversation.user.name || 'Usuario',
            adminName: 'Great Phones',
            messageText: text || '(imagen)',
            conversationId: id,
          }).catch((emailError: Error) => {
            console.error('[Messages] Error sending email to user:', emailError)
          })
        })
      }
    }

    // Emit socket event for real-time delivery (production: integrated server)
    const io = getIO();
    if (io) {
      io.to(id).emit('newMessage', { ...message, conversationId: id, fromUserId: userId });
    }

    // Emit unreadUpdate for the recipient so badges update instantly
    if (isUserSender && conversation.adminId) {
      const { emitUnreadUpdate } = await import('@/lib/socket');
      emitUnreadUpdate(conversation.adminId);
    } else if (isAdminSender) {
      const { emitUnreadUpdate } = await import('@/lib/socket');
      emitUnreadUpdate(conversation.userId);
    }

    return NextResponse.json(message, { status: 201 })
  } catch (error) { return handleRouteError(error) }
}
