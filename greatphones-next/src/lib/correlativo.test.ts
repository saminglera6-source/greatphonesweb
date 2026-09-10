import { describe, it, expect, vi } from 'vitest'
import { nextCorrelativo } from './correlativo'

function fakeTx(count: number) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    sale: {
      count: vi.fn().mockResolvedValue(count),
      findMany: vi.fn().mockResolvedValue(Array.from({ length: count }, (_, i) => ({ code: `X-${i}` }))),
    },
  } as any
}

describe('nextCorrelativo', () => {
  it('numera desde 1 con relleno de ceros', async () => {
    const tx = fakeTx(0)
    expect(await nextCorrelativo(tx, 'VTA', tx.sale)).toBe('VTA-0001')
  })

  it('continúa la secuencia según el conteo existente', async () => {
    const tx = fakeTx(41)
    expect(await nextCorrelativo(tx, 'VTA', tx.sale)).toBe('VTA-0042')
  })

  it('toma el advisory lock antes de contar', async () => {
    const tx = fakeTx(3)
    await nextCorrelativo(tx, 'REP', tx.sale)
    expect(tx.$executeRaw).toHaveBeenCalledOnce()
    expect(tx.sale.count).toHaveBeenCalledWith({ where: { code: { startsWith: 'REP-' } } })
  })

  it('respeta el ancho de relleno', async () => {
    const tx = fakeTx(9999)
    expect(await nextCorrelativo(tx, 'CMP', tx.sale, { pad: 4 })).toBe('CMP-10000')
  })

  it('con distinct cuenta valores únicos del campo, no filas', async () => {
    const tx = fakeTx(2)
    const n = await nextCorrelativo(tx, 'CAC', tx.sale, { distinct: true })
    expect(n).toBe('CAC-0003')
    expect(tx.sale.findMany).toHaveBeenCalledWith({
      where: { code: { startsWith: 'CAC-' } },
      distinct: ['code'],
      select: { code: true },
    })
  })

  it('acepta field y extraWhere para hojas compartidas (gastos)', async () => {
    const tx = fakeTx(5)
    await nextCorrelativo(tx, 'GST', tx.sale, {
      distinct: true,
      field: 'operationId',
      extraWhere: { source: 'GASTO' },
    })
    expect(tx.sale.findMany).toHaveBeenCalledWith({
      where: { source: 'GASTO', operationId: { startsWith: 'GST-' } },
      distinct: ['operationId'],
      select: { operationId: true },
    })
  })
})
