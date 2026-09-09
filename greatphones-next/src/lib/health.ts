import { prisma } from '@/lib/prisma'
import { getCashBalances } from '@/lib/accounting'
import { normalizeStatus, PRE, saldoPendiente } from '@/lib/preventas'

/**
 * Health Check (ERP §4.26, reglas 16-17).
 *
 * Recorre el sistema buscando situaciones imposibles del negocio. Compara
 * SIEMPRE estados técnicos, nunca texto libre. NUNCA corrige nada — solo
 * detecta y reporta para revisión humana.
 */

export type Severity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'

export interface Finding {
  severity: Severity
  check: string
  message: string
  refs?: string[]
}

const RANK: Record<Severity, number> = { INFO: 0, WARNING: 1, ERROR: 2, CRITICAL: 3 }

export async function runHealthCheck(auto = false) {
  const findings: Finding[] = []
  const add = (severity: Severity, check: string, message: string, refs?: string[]) =>
    findings.push({ severity, check, message, refs })

  // 1) Equipos SOLD sin ninguna venta asociada.
  const vendidos = await prisma.inventoryItem.findMany({
    where: { status: 'SOLD' },
    select: { code: true, imei: true },
  })
  if (vendidos.length) {
    const imeis = vendidos.map(v => v.imei)
    const salesConImei = await prisma.sale.findMany({ where: { imei: { in: imeis } }, select: { imei: true } })
    const orderItemsConImei = await prisma.orderItem.findMany({
      where: { inventoryItem: { imei: { in: imeis } } },
      select: { inventoryItem: { select: { imei: true } } },
    })
    const conVenta = new Set([
      ...salesConImei.map(s => s.imei),
      ...orderItemsConImei.map(o => o.inventoryItem?.imei).filter(Boolean),
    ])
    const huerfanos = vendidos.filter(v => !conVenta.has(v.imei))
    if (huerfanos.length) {
      add('ERROR', 'equipo_vendido_sin_venta',
        `${huerfanos.length} equipo(s) marcados VENDIDO sin ninguna venta registrada.`,
        huerfanos.slice(0, 20).map(h => h.code))
    }
  }

  // 2) Product.stock incoherente con la cantidad de unidades IN_STOCK.
  const prodsConUnidades = await prisma.product.findMany({
    where: { deletedAt: null, inventoryItems: { some: {} } },
    select: {
      id: true, name: true, stock: true,
      _count: { select: { inventoryItems: { where: { status: 'IN_STOCK' } } } },
    },
  })
  const desalineados = prodsConUnidades.filter(p => p.stock !== p._count.inventoryItems)
  if (desalineados.length) {
    add('WARNING', 'stock_vs_unidades',
      `${desalineados.length} producto(s) con Product.stock distinto de la cantidad de unidades IN_STOCK.`,
      desalineados.slice(0, 20).map(p => `${p.name} (stock ${p.stock} ≠ ${p._count.inventoryItems})`))
  }

  // 3) Asientos ACTIVO con operationId que no corresponde a ninguna entidad.
  const opsAsientos = await prisma.accountingEntry.groupBy({
    by: ['operationId'],
    where: { status: 'ACTIVO', operationId: { not: null } },
  })
  const opIds = opsAsientos.map(o => o.operationId!).filter(Boolean)
  if (opIds.length) {
    const [items, sales, preorders, repairs] = await Promise.all([
      prisma.inventoryItem.findMany({ where: { code: { in: opIds } }, select: { code: true } }),
      prisma.sale.findMany({ where: { code: { in: opIds } }, select: { code: true } }),
      prisma.preOrder.findMany({ where: { code: { in: opIds } }, select: { code: true } }),
      prisma.repair.findMany({ where: { code: { in: opIds } }, select: { code: true } }),
    ])
    const conocidas = new Set([
      ...items.map(x => x.code), ...sales.map(x => x.code),
      ...preorders.map(x => x.code), ...repairs.map(x => x.code),
    ])
    // GST/CAM/AJC/ONLINE/PREVENTA_ENTREGA no tienen entidad propia — se excluyen.
    const sinEntidad = opIds.filter(
      id => !conocidas.has(id) && !/^(GST|CAM|AJC|OP|REG|PRE-ENTREGA)/.test(id) && !id.startsWith('CMP-Q'),
    )
    if (sinEntidad.length) {
      add('WARNING', 'asiento_huerfano',
        `${sinEntidad.length} operación(es) con asientos activos pero sin registro de negocio.`,
        sinEntidad.slice(0, 20))
    }
  }

  // 4) Preventas entregadas con deuda no reflejada / estado legacy.
  const preorders = await prisma.preOrder.findMany({
    where: { deletedAt: null },
    select: { code: true, status: true, price: true, collectedArs: true, collectedUsd: true, inventoryItemId: true },
  })
  const legacyStatus = preorders.filter(p => normalizeStatus(p.status) !== p.status)
  if (legacyStatus.length) {
    add('INFO', 'preventa_estado_legacy',
      `${legacyStatus.length} preventa(s) con estado en vocabulario viejo (se normaliza al leer, conviene migrar).`,
      legacyStatus.slice(0, 20).map(p => `${p.code} (${p.status})`))
  }
  const entregadasConDeuda = preorders.filter(
    p => normalizeStatus(p.status) === PRE.ENTREGADO && saldoPendiente(p, 1000) > 1,
  )
  if (entregadasConDeuda.length) {
    add('ERROR', 'preventa_entregada_con_deuda',
      `${entregadasConDeuda.length} preventa(s) marcadas ENTREGADO pero con saldo pendiente > 0.`,
      entregadasConDeuda.slice(0, 20).map(p => p.code))
  }

  // 5) Unidades RESERVED sin ninguna preventa activa que las reserve.
  const reservados = await prisma.inventoryItem.findMany({
    where: { status: 'RESERVED' },
    select: { code: true, preOrder: { select: { status: true, deletedAt: true } } },
  })
  const reservaHuerfana = reservados.filter(
    r => !r.preOrder || r.preOrder.deletedAt || normalizeStatus(r.preOrder.status) === PRE.CANCELADO,
  )
  if (reservaHuerfana.length) {
    add('WARNING', 'reserva_huerfana',
      `${reservaHuerfana.length} equipo(s) RESERVADO sin una preventa activa detrás.`,
      reservaHuerfana.slice(0, 20).map(r => r.code))
  }

  // 6) CashRegister desalineado con la suma de asientos ACTIVO.
  const balances = await getCashBalances()
  const registros = await prisma.cashRegister.findMany()
  for (const reg of registros) {
    const calc = balances.find(b => b.means === reg.means)
    if (!calc) continue
    if (Math.abs(reg.balance - calc.balance) > 1) {
      add('ERROR', 'caja_desalineada',
        `La caja ${reg.means} guardada (${reg.balance}) no coincide con la suma de asientos activos (${calc.balance}).`,
        [reg.means])
    }
  }

  // 7) Reparaciones cobradas sin asiento.
  const repsCobradas = await prisma.repair.findMany({
    where: { deletedAt: null, pricePaid: { gt: 0 } },
    select: { code: true, pricePaid: true },
  })
  if (repsCobradas.length) {
    const codes = repsCobradas.map(r => r.code)
    const conAsiento = await prisma.accountingEntry.findMany({
      where: { operationId: { in: codes }, source: 'REPAIR', status: 'ACTIVO' },
      select: { operationId: true },
    })
    const set = new Set(conAsiento.map(a => a.operationId))
    const sinAsiento = repsCobradas.filter(r => !set.has(r.code))
    if (sinAsiento.length) {
      add('ERROR', 'reparacion_sin_asiento',
        `${sinAsiento.length} reparación(es) con cobro registrado pero sin asiento contable.`,
        sinAsiento.slice(0, 20).map(r => r.code))
    }
  }

  const counts = {
    info: findings.filter(f => f.severity === 'INFO').length,
    warning: findings.filter(f => f.severity === 'WARNING').length,
    error: findings.filter(f => f.severity === 'ERROR').length,
    critical: findings.filter(f => f.severity === 'CRITICAL').length,
  }
  const worst = findings.reduce<Severity>(
    (acc, f) => (RANK[f.severity] > RANK[acc] ? f.severity : acc),
    'INFO',
  )
  const status = findings.length === 0 ? 'OK' : worst === 'INFO' ? 'OK' : worst

  const run = await prisma.healthCheck.create({
    data: { status, ...counts, findings: findings as any, auto },
  })

  return { id: run.id, runAt: run.runAt, status, ...counts, findings }
}

export async function lastHealthCheck() {
  return prisma.healthCheck.findFirst({ orderBy: { runAt: 'desc' } })
}
