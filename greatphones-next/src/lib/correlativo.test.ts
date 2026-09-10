import { describe, it, expect, vi } from 'vitest'
import { nextCorrelativo } from './correlativo'

function fakeTx(count: number) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    sale: { count: vi.fn().mockResolvedValue(count) },
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
    expect(await nextCorrelativo(tx, 'CMP', tx.sale, 4)).toBe('CMP-10000')
  })
})
