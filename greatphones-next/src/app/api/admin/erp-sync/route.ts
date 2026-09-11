import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, handleRouteError } from '@/lib/auth-guard'
import { flushPendingSync, retryOne } from '@/lib/erp-sheet'

/**
 * Estado de la cola de replicación al sheet ERP.
 *  - GET                          → resumen + últimas filas (sesión admin)
 *  - GET ?flush=1&cron=<CRON_SECRET> → reintenta las pendientes (sin sesión, para el cron)
 *  - POST { retry: 'all' | id }   → reintenta manualmente desde el panel
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cronSecret = searchParams.get('cron')
    const isCron = !!cronSecret && cronSecret === process.env.CRON_SECRET
    if (!isCron) await requireAdmin(request)

    if (searchParams.get('flush') === '1') {
      const r = await flushPendingSync()
      return NextResponse.json({ ok: true, ...r })
    }

    const [pending, error, sent24h, ultimas] = await Promise.all([
      prisma.sheetSync.count({ where: { status: 'PENDING' } }),
      prisma.sheetSync.count({ where: { status: 'ERROR' } }),
      prisma.sheetSync.count({ where: { status: 'SENT', sentAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
      prisma.sheetSync.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    ])
    return NextResponse.json({
      configurado: !!process.env.ERP_SHEET_WEBHOOK_URL,
      resumen: { pending, error, sent24h },
      ultimas,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const body = await request.json().catch(() => ({}))
    if (body.retry === 'all') {
      const r = await flushPendingSync(200)
      return NextResponse.json({ ok: true, ...r })
    }
    if (body.id) {
      const ok = await retryOne(body.id)
      return NextResponse.json({ ok })
    }
    return NextResponse.json({ error: 'Nada para reintentar' }, { status: 400 })
  } catch (error) {
    return handleRouteError(error)
  }
}
