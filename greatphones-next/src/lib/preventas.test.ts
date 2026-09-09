import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/accounting', () => ({ registerEntry: vi.fn() }))
vi.mock('@/lib/dolar-server', () => ({ dolarActual: vi.fn() }))
vi.mock('@/lib/audit', () => ({ auditar: vi.fn() }))

const { saldoPendiente, normalizeStatus, statusFilterValues, PRE, PENDIENTE_ENTREGA } = await import(
  './preventas'
)

describe('saldoPendiente', () => {
  it('resta el cobro en pesos del precio', () => {
    expect(saldoPendiente({ price: 1_200_000, collectedArs: 500_000, collectedUsd: 0 }, 1000)).toBe(
      700_000,
    )
  })

  it('convierte el cobro en dólares con la cotización recibida', () => {
    expect(saldoPendiente({ price: 1_000_000, collectedArs: 0, collectedUsd: 300 }, 1500)).toBe(
      550_000,
    )
  })

  it('nunca devuelve negativo (piso 0)', () => {
    expect(saldoPendiente({ price: 500_000, collectedArs: 900_000, collectedUsd: 0 }, 1000)).toBe(0)
  })

  it('preventa saldada = 0', () => {
    expect(saldoPendiente({ price: 900_000, collectedArs: 900_000, collectedUsd: 0 }, 1000)).toBe(0)
  })
})

describe('normalizeStatus', () => {
  it('mapea los estados legacy al vocabulario canónico', () => {
    expect(normalizeStatus('PENDING')).toBe(PRE.ESPERANDO_COMPRA)
    expect(normalizeStatus('PAID')).toBe(PRE.COMPRADO)
    expect(normalizeStatus('CONFIRMED')).toBe(PRE.COMPRADO)
    expect(normalizeStatus('DELIVERED')).toBe(PRE.ENTREGADO)
    expect(normalizeStatus('CANCELLED')).toBe(PRE.CANCELADO)
  })

  it('deja pasar los canónicos sin tocar', () => {
    expect(normalizeStatus('ENTREGADO_SALDO')).toBe('ENTREGADO_SALDO')
  })

  it('null/undefined → ESPERANDO_COMPRA', () => {
    expect(normalizeStatus(null)).toBe(PRE.ESPERANDO_COMPRA)
    expect(normalizeStatus(undefined)).toBe(PRE.ESPERANDO_COMPRA)
  })
})

describe('statusFilterValues', () => {
  it('sin filtro / "all" / "TODOS" → null', () => {
    expect(statusFilterValues(null)).toBeNull()
    expect(statusFilterValues('all')).toBeNull()
    expect(statusFilterValues('TODOS')).toBeNull()
  })

  it('un filtro legacy incluye también su canónico y otros alias', () => {
    const vals = statusFilterValues('PENDING')!
    expect(vals).toContain('PENDING')
    expect(vals).toContain('ESPERANDO_COMPRA')
  })

  it('un filtro canónico incluye sus alias legacy', () => {
    const vals = statusFilterValues('COMPRADO')!
    expect(vals).toEqual(expect.arrayContaining(['COMPRADO', 'PAID', 'CONFIRMED', 'PROCESSING']))
  })
})

describe('PENDIENTE_ENTREGA', () => {
  it('incluye esperando compra, comprado y entregado con saldo; excluye entregado y cancelado', () => {
    expect(PENDIENTE_ENTREGA).toContain(PRE.ESPERANDO_COMPRA)
    expect(PENDIENTE_ENTREGA).toContain(PRE.COMPRADO)
    expect(PENDIENTE_ENTREGA).toContain(PRE.ENTREGADO_SALDO)
    expect(PENDIENTE_ENTREGA).not.toContain(PRE.ENTREGADO)
    expect(PENDIENTE_ENTREGA).not.toContain(PRE.CANCELADO)
  })
})
