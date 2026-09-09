import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies, verifySessionToken } from '@/lib/session'
import { SESSION_COOKIE_NAME } from '@/config'

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'AuthError'
  }
}

async function getAuthenticatedUser(request?: Request) {
  const session = await getServerSession(authOptions)
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, role: true, active: true },
    })
    if (user && user.active !== false) return user
  }

  // `request` está disponible en Route Handlers. En Server Components (p.ej.
  // el layout de /admin) no existe un Request; ahí leemos la cookie firmada
  // vía la API de next/headers, que solo funciona dentro del render de RSC.
  const sessionPayload = request
    ? getSessionFromCookies(request.headers.get('cookie'))
    : verifySessionToken((await cookies()).get(SESSION_COOKIE_NAME)?.value)

  if (sessionPayload) {
    const user = await prisma.user.findUnique({
      where: { id: sessionPayload.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        dni: true,
        direccion: true,
        piso: true,
        cp: true,
        provincia: true,
        ciudad: true,
        role: true,
        active: true,
      },
    })
    if (user && user.active !== false) return user
  }

  return null
}

export async function requireSession(request?: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    throw new AuthError('No autenticado', 401)
  }
  return user
}

export async function requireAdmin(request?: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    throw new AuthError('No autenticado. Por favor, inicia sesión.', 401)
  }
  if (user.role !== 'ADMIN') {
    throw new AuthError('No tienes permiso para acceder al panel de administración', 403)
  }
  return user
}

export async function requireSelfOrAdmin(userId: string, request?: Request) {
  const user = await requireSession(request)
  if (user.id !== userId && user.role !== 'ADMIN') {
    throw new AuthError('No tienes permiso para modificar este recurso', 403)
  }
  return user
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error('Route error:', error)
  return NextResponse.json({ error: 'Error interno' }, { status: 500 })
}
