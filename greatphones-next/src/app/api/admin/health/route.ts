import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { runHealthCheck, lastHealthCheck } from '@/lib/health'

/**
 * Health Check (ERP §4.26).
 *  - GET               → última corrida + historial reciente
 *  - GET  ?run=1       → corre uno nuevo ahora
 *  - GET  ?run=1&cron=<CRON_SECRET>  → corrida automática (sin sesión), para el cron
 *  - POST             → corre uno nuevo (equivalente a ?run=1)
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const run = searchParams.get('run')
    const cronSecret = searchParams.get('cron')

    if (run) {
      const isCron = !!cronSecret && cronSecret === process.env.CRON_SECRET
      if (!isCron) await requireAdmin(request)
      const result = await runHealthCheck(isCron)
      return NextResponse.json(result)
    }

    await requireAdmin(request)
    const [last, history] = await Promise.all([
      lastHealthCheck(),
      prisma.healthCheck.findMany({
        orderBy: { runAt: 'desc' },
        take: 20,
        select: { id: true, runAt: true, status: true, info: true, warning: true, error: true, critical: true, auto: true },
      }),
    ])
    return NextResponse.json({ last, history })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const result = await runHealthCheck(false)
    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error)
  }
}
