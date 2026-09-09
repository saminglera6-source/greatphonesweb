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

async function getAnulledOps(): Promise<Set<string>> {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { action: 'ANULACION' },
      select: { snapshot: true },
    })
    const set = new Set<string>()
    for (const l of logs as any[]) {
      const s = l.snapshot as any
      if (s?.code) set.add(s.code)
      if (s?.id) set.add(s.id)
    }
    return set
  } catch {
    return new Set()
  }
}

/** Saldo de caja actual por medio de pago (excluye anuladas). */
export async function getCashBalances() {
  const anulled = await getAnulledOps()
  if (anulled.size === 0) {
    const regs = await prisma.cashRegister.findMany({ orderBy: { means: 'asc' } })
    return regs.map(r => ({
      means: r.means,
      balance: r.balance,
      balanceUsd: r.balanceUsd,
    }))
  }
  const entries = await prisma.accountingEntry.findMany({
    select: { means: true, amount: true, amountUsd: true, type: true, operationId: true },
  })
  const filtered = entries.filter(e => !e.operationId || !anulled.has(e.operationId))
  const map = new Map<string, { balance: number; balanceUsd: number | null }>()
  for (const e of filtered) {
    const cur = map.get(e.means) || { balance: 0, balanceUsd: 0 }
    const delta = e.type === 'INGRESO' ? e.amount : e.type === 'EGRESO' ? -e.amount : 0
    cur.balance += delta
    if (e.means === 'USD' && e.amountUsd != null) {
      const dUsd = e.type === 'INGRESO' ? e.amountUsd : e.type === 'EGRESO' ? -e.amountUsd : 0
      cur.balanceUsd = (cur.balanceUsd || 0) + dUsd
    }
    map.set(e.means, cur)
  }
  const regs = await prisma.cashRegister.findMany({ orderBy: { means: 'asc' } })
  return regs.map(r => {
    const v = map.get(r.means)
    if (v) return { means: r.means, balance: v.balance, balanceUsd: v.balanceUsd }
    return { means: r.means, balance: 0, balanceUsd: r.means === 'USD' ? 0 : null }
  })
}

/** Libro diario: últimas entradas con filtros (excluye anuladas). */
export async function listEntries(opts: {
  page?: number
  limit?: number
  means?: PaymentMeans | string | null
  type?: AccountingType | string | null
  search?: string | null
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
  const anulled = await getAnulledOps()
  if (anulled.size > 0) {
    where.NOT = { operationId: { in: Array.from(anulled) } }
  }
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
