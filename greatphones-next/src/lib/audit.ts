import { prisma } from '@/lib/prisma'

/**
 * Integridad y gobierno (Fase 3 ERP).
 * Auditoría genérica: una sola tabla conserva el snapshot previo a la acción,
 * el responsable y el motivo. "Nunca se borra información": anular es marcar
 * `deletedAt`/`deletedBy`/`deleteReason` sobre el registro, nunca eliminarlo.
 */

type AuditableEntity =
  | 'Product'
  | 'Accessory'
  | 'Order'
  | 'Repair'
  | 'Quote'
  | 'PreOrder'
  | 'AccountingEntry'
  | 'User'
  | 'Arrepentimiento'
  | 'PriceList'
  | 'PriceTradeIn'
  | 'CuotasConfig'
  | 'AppConfig'

const ENTITY_MODEL: Record<AuditableEntity, string> = {
  Product: 'product',
  Accessory: 'accessory',
  Order: 'order',
  Repair: 'repair',
  Quote: 'quote',
  PreOrder: 'preOrder',
  AccountingEntry: 'accountingEntry',
  User: 'user',
  Arrepentimiento: 'arrepentimiento',
  PriceList: 'priceList',
  PriceTradeIn: 'priceTradeIn',
  CuotasConfig: 'cuotasConfig',
  AppConfig: 'appConfig',
}

async function getEntitySnapshot(entityType: AuditableEntity, entityId: string) {
  const model = ENTITY_MODEL[entityType]
  const acc = (prisma as any)[model]
  if (!acc || typeof acc.findUnique !== 'function') return { id: entityId }
  try {
    return await acc.findUnique({ where: { id: entityId } })
  } catch {
    return { id: entityId }
  }
}

/** Registra una acción de auditoría con snapshot del estado previo. */
export async function auditar(opts: {
  entityType: AuditableEntity
  entityId: string
  action?: 'ANULACION' | 'RESTAURACION' | 'CORRECCION' | 'CREACION' | 'UPDATE'
  reason?: string | null
  operator?: string | null
  createdById?: string | null
  metadata?: Record<string, unknown>
  /** Snapshot explícito. Si se pasa, no se busca la entidad por id (útil para
   *  entidades sin PK `id` o cuando ya se tiene el estado previo en mano). */
  snapshot?: unknown
}) {
  const snapshot = opts.snapshot !== undefined
    ? opts.snapshot
    : await getEntitySnapshot(opts.entityType, opts.entityId)
  await prisma.auditLog.create({
    data: {
      entityType: opts.entityType,
      entityId: opts.entityId,
      action: (opts.action || 'ANULACION') as any,
      reason: opts.reason || null,
      operator: opts.operator || null,
      createdById: opts.createdById || null,
      snapshot: snapshot as any,
      metadata: (opts.metadata as any) || undefined,
    },
  })
}

/**
 * Anula un registro de forma trazable: audita con snapshot y marca soft-delete.
 * Nunca borra físicamente.
 */
export async function anular(opts: {
  entityType: AuditableEntity
  entityId: string
  reason: string
  operator?: string | null
  createdById?: string | null
}) {
  if (!opts.reason || !opts.reason.trim()) {
    throw new Error('El motivo de anulación es obligatorio')
  }
  const model = ENTITY_MODEL[opts.entityType]
  await auditar({
    entityType: opts.entityType,
    entityId: opts.entityId,
    action: 'ANULACION',
    reason: opts.reason,
    operator: opts.operator,
    createdById: opts.createdById,
  })
  const acc = (prisma as any)[model]
  if (acc && typeof acc.update === 'function') {
    await acc.update({
      where: { id: opts.entityId },
      data: {
        deletedAt: new Date(),
        deletedBy: opts.operator || opts.createdById || null,
        deleteReason: opts.reason,
      },
    })
  }
}

/** Listar auditoría con filtros y paginación. */
export async function listAudit(opts: {
  page?: number
  limit?: number
  entityType?: string
  search?: string | null
}) {
  const page = Math.max(1, opts.page || 1)
  const limit = Math.min(100, opts.limit || 40)
  const where: any = {}
  if (opts.entityType) where.entityType = opts.entityType
  if (opts.search) {
    where.OR = [
      { entityId: { contains: opts.search, mode: 'insensitive' } },
      { reason: { contains: opts.search, mode: 'insensitive' } },
      { operator: { contains: opts.search, mode: 'insensitive' } },
    ]
  }
  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])
  return { data, page, limit, total, totalPages: Math.ceil(total / limit) }
}