import { prisma } from '@/lib/prisma'

/**
 * Replicación de operaciones del panel al sheet ERP ("PRUEBA GP").
 *
 * El receptor es un Apps Script Web App (doPost) desplegado desde el propio
 * sheet — reutiliza la lógica de formato de filas que ya tiene el ERP. Acá
 * solo encolamos y empujamos; nunca bloqueamos la operación real por esto
 * (ERP §1.4: prioridad a la continuidad operativa sobre capas secundarias).
 *
 * Configuración: ERP_SHEET_WEBHOOK_URL (URL de /exec del Apps Script) y,
 * opcionalmente, ERP_SHEET_SECRET (se manda como header X-ERP-Secret; el
 * receptor lo valida contra su propio Script Property).
 */

const WEBHOOK_URL = process.env.ERP_SHEET_WEBHOOK_URL
const WEBHOOK_SECRET = process.env.ERP_SHEET_SECRET
const MAX_ATTEMPTS = 8

export type SheetSyncTipo =
  | 'VENTA'
  | 'COMPRA'
  | 'PREVENTA'
  | 'ENTREGA_PREVENTA'
  | 'REPARACION'
  | 'GASTO'
  | 'CAMBIO_MONEDA'
  | 'AJUSTE_CAJA'
  | 'INVERSOR'
  | 'COMPRA_ACCESORIOS'
  | 'ANULACION'
  | 'RESTAURACION'

/**
 * Encola una fila para el sheet y dispara un intento inmediato en segundo
 * plano (no se espera). Si falla, queda PENDING/ERROR para que
 * /api/admin/erp-sync (manual o cron) la reintente.
 */
export async function enqueueSheetSync(
  tipo: SheetSyncTipo,
  operationId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const row = await prisma.sheetSync.create({ data: { tipo, operationId, payload: payload as any } })
    void pushOne(row.id).catch(() => {})
  } catch (e) {
    console.error('[erp-sheet] no se pudo encolar', tipo, operationId, e)
  }
}

/** Reintenta una fila puntual (usado por el botón "Reintentar" del panel). */
export async function retryOne(id: string): Promise<boolean> {
  return pushOne(id)
}

async function pushOne(id: string): Promise<boolean> {
  if (!WEBHOOK_URL) return false
  const row = await prisma.sheetSync.findUnique({ where: { id } })
  if (!row || row.status === 'SENT') return true
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      // Apps Script Web Apps no exponen headers custom en doPost(e); el
      // secreto viaja también en el body para que el receptor lo valide.
      headers: {
        'Content-Type': 'application/json',
        ...(WEBHOOK_SECRET ? { 'X-ERP-Secret': WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify({
        secret: WEBHOOK_SECRET || undefined,
        tipo: row.tipo,
        operationId: row.operationId,
        payload: row.payload,
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (res.ok) {
      await prisma.sheetSync.update({
        where: { id },
        data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
      })
      return true
    }
    const text = await res.text().catch(() => '')
    await prisma.sheetSync.update({
      where: { id },
      data: { status: 'ERROR', attempts: { increment: 1 }, lastError: `HTTP ${res.status}: ${text}`.slice(0, 500) },
    })
    return false
  } catch (e: any) {
    await prisma.sheetSync
      .update({
        where: { id },
        data: { status: 'ERROR', attempts: { increment: 1 }, lastError: String(e?.message || e).slice(0, 500) },
      })
      .catch(() => {})
    return false
  }
}

/** Aplana un arreglo de medios de pago [{pm, ars, usd}] a las 4 columnas que usa el ERP. */
export function mediosAPlano(medios: { pm: string; ars: number; usd?: number }[]) {
  const get = (pm: string) => medios.find(m => m.pm === pm)
  return {
    cobradoEfectivo: get('EFECTIVO')?.ars || 0,
    cobradoTransferencia: get('TRANSFERENCIA')?.ars || 0,
    cobradoCuotas: get('CUOTAS')?.ars || 0,
    cobradoUsd: get('USD')?.usd || 0,
  }
}

/** Reintenta las filas PENDING/ERROR (con margen de intentos). */
export async function flushPendingSync(limit = 50) {
  const rows = await prisma.sheetSync.findMany({
    where: { status: { in: ['PENDING', 'ERROR'] }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
  let enviadas = 0
  let fallidas = 0
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await pushOne(row.id)
    if (ok) enviadas++
    else fallidas++
  }
  return { enviadas, fallidas, total: rows.length, configurado: !!WEBHOOK_URL }
}
