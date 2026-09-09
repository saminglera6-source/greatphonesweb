import { prisma } from '@/lib/prisma'
import type { AccountingType, PaymentMeans } from '@prisma/client'

/**
 * Núcleo contable (Fase 1 ERP).
 * Registra un asiento en el Libro Diario y actualiza el saldo de caja por
 * medio de pago. Los pesos y dólares NUNCA se mezclan: el monto en pesos va
 * en `amount` y, si el medio es USD, la cantidad real de dólares va en
 * `amountUsd`.
 *
 * Reglas del ERP que se preservan:
 *  - Un asiento independiente por cada medio de pago con monto > 0.
 *  - INGRESO suma, EGRESO resta, NEUTRO no modifica.
 *  - USD se conservan como dólares reales.
 */
// Cliente Prisma o cliente de transacción (`tx`). Permite generar el asiento
// dentro de la misma transacción que la operación de negocio que lo origina.
type DbClient = Omit<
  typeof prisma,
  '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
>

export async function registerEntry(
  opts: {
    source: string
    operationId?: string | null
    description: string
    category?: string | null
    type: AccountingType
    means: PaymentMeans
    amount: number
    amountUsd?: number | null
    opDate?: Date
    operator?: string | null
    createdById?: string | null
    metadata?: Record<string, unknown>
  },
  client?: DbClient,
) {
  const db = client || prisma
  const amount = Math.round(opts.amount || 0)
  const entry = await db.accountingEntry.create({
    data: {
      source: opts.source,
      operationId: opts.operationId || null,
      description: opts.description,
      category: opts.category || null,
      type: opts.type,
      means: opts.means,
      amount,
      amountUsd: opts.means === 'USD' ? (opts.amountUsd ?? null) : null,
      opDate: opts.opDate || new Date(),
      operator: opts.operator || null,
      createdById: opts.createdById || null,
      metadata: (opts.metadata as any) || undefined,
    },
  })

  await updateCashBalance(
    opts.means,
    opts.type,
    amount,
    opts.means === 'USD' ? (opts.amountUsd ?? null) : null,
    db,
  )
  return entry
}

/** Aplica un asiento sobre el saldo de caja del medio correspondiente. */
async function updateCashBalance(
  means: PaymentMeans,
  type: AccountingType,
  amount: number,
  amountUsd: number | null,
  db: DbClient = prisma,
) {
  const reg = await db.cashRegister.upsert({
    where: { means },
    update: {},
    create: { means, balance: 0, balanceUsd: means === 'USD' ? 0 : null },
  })
  const delta = type === 'INGRESO' ? amount : type === 'EGRESO' ? -amount : 0
  const deltaUsd =
    means === 'USD' && amountUsd != null
      ? type === 'INGRESO'
        ? amountUsd
        : type === 'EGRESO'
          ? -amountUsd
          : 0
      : null

  await db.cashRegister.update({
    where: { id: reg.id },
    data: {
      balance: reg.balance + delta,
      ...(means === 'USD' ? { balanceUsd: (reg.balanceUsd || 0) + (deltaUsd || 0) } : {}),
    },
  })
}

/**
 * Saldo de caja por medio de pago. Se calcula sumando SOLO los asientos con
 * status ACTIVO (los ANULADO no cuentan; los REVERSION son informativos y no
 * mueven saldo). Es la fuente de verdad — el `CashRegister` es una caché que
 * se recalcula con `recomputeCashRegisters` al anular/restaurar.
 */
export async function getCashBalances() {
  const grouped = await prisma.accountingEntry.groupBy({
    by: ['means', 'type'],
    where: { status: 'ACTIVO' },
    _sum: { amount: true, amountUsd: true },
  })
  const map = new Map<string, { balance: number; balanceUsd: number }>()
  for (const g of grouped) {
    const sign = g.type === 'INGRESO' ? 1 : g.type === 'EGRESO' ? -1 : 0
    const cur = map.get(g.means) || { balance: 0, balanceUsd: 0 }
    cur.balance += sign * (g._sum.amount || 0)
    if (g.means === 'USD') cur.balanceUsd += sign * (g._sum.amountUsd || 0)
    map.set(g.means, cur)
  }
  const allMeans: PaymentMeans[] = ['EFECTIVO', 'TRANSFERENCIA', 'CUOTAS', 'USD', 'PAGO_ONLINE']
  return allMeans.map(m => {
    const v = map.get(m)
    return {
      means: m,
      balance: v?.balance || 0,
      balanceUsd: m === 'USD' ? v?.balanceUsd || 0 : null,
    }
  })
}

/**
 * Recalcula el saldo de los `CashRegister` indicados sumando únicamente los
 * asientos con status ACTIVO. Se usa después de anular/restaurar una operación
 * (que marca asientos ANULADO/ACTIVO) para dejar la caja consistente sin tener
 * que emitir asientos espejo.
 */
export async function recomputeCashRegisters(
  means: PaymentMeans[],
  db: DbClient = prisma,
) {
  for (const m of means) {
    const rows = await db.accountingEntry.findMany({
      where: { means: m, status: 'ACTIVO' },
      select: { type: true, amount: true, amountUsd: true },
    })
    let balance = 0
    let balanceUsd = 0
    for (const r of rows) {
      const sign = r.type === 'INGRESO' ? 1 : r.type === 'EGRESO' ? -1 : 0
      balance += sign * r.amount
      if (m === 'USD' && r.amountUsd != null) balanceUsd += sign * r.amountUsd
    }
    await db.cashRegister.upsert({
      where: { means: m },
      update: { balance, ...(m === 'USD' ? { balanceUsd } : {}) },
      create: { means: m, balance, balanceUsd: m === 'USD' ? balanceUsd : null },
    })
  }
}

/** Libro diario: últimas entradas con filtros. Por defecto excluye las anuladas. */
export async function listEntries(opts: {
  page?: number
  limit?: number
  means?: PaymentMeans | string | null
  type?: AccountingType | string | null
  search?: string | null
  /** 'ACTIVO' (default) | 'ANULADO' | 'ALL' */
  status?: string | null
}) {
  const page = Math.max(1, opts.page || 1)
  const limit = Math.min(100, opts.limit || 40)
  const where: any = {}
  if (opts.means) where.means = opts.means
  if (opts.type) where.type = opts.type
  if (opts.search) {
    where.OR = [
      { description: { contains: opts.search, mode: 'insensitive' } },
      { operationId: { contains: opts.search, mode: 'insensitive' } },
      { source: { contains: opts.search, mode: 'insensitive' } },
    ]
  }
  if (opts.status === 'ANULADO') where.status = 'ANULADO'
  else if (opts.status !== 'ALL') where.status = 'ACTIVO'
  const [data, total] = await Promise.all([
    prisma.accountingEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.accountingEntry.count({ where }),
  ])
  return { data, page, limit, total, totalPages: Math.ceil(total / limit) }
}
