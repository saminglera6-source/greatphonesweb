import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { holiday: { findMany: vi.fn() } } }))
vi.mock('@/lib/config', () => ({ getConfig: vi.fn() }))

const { esFinDeSemana, esDiaHabil, sumarDiasHabiles } = await import('./dias-habiles')

// 2026-09-09 es miércoles.
const MIERCOLES = new Date(2026, 8, 9)

describe('esFinDeSemana', () => {
  it('sábado y domingo', () => {
    expect(esFinDeSemana(new Date(2026, 8, 12))).toBe(true) // sáb
    expect(esFinDeSemana(new Date(2026, 8, 13))).toBe(true) // dom
    expect(esFinDeSemana(new Date(2026, 8, 14))).toBe(false) // lun
  })
})

describe('esDiaHabil', () => {
  it('un feriado en día de semana no es hábil', () => {
    const feriados = new Set(['2026-09-14']) // lunes
    expect(esDiaHabil(new Date(2026, 8, 14), feriados)).toBe(false)
    expect(esDiaHabil(new Date(2026, 8, 15), feriados)).toBe(true)
  })
})

describe('sumarDiasHabiles', () => {
  it('salta el fin de semana', () => {
    // desde miércoles 9: +1 hábil = jueves 10, +2 = viernes 11, +3 = lunes 14
    const r = sumarDiasHabiles(MIERCOLES, 3, new Set())
    expect(r.getDate()).toBe(14)
    expect(r.getMonth()).toBe(8)
  })

  it('salta también los feriados', () => {
    // +3 hábiles desde miércoles 9 con lunes 14 feriado → martes 15
    const r = sumarDiasHabiles(MIERCOLES, 3, new Set(['2026-09-14']))
    expect(r.getDate()).toBe(15)
  })

  it('0 días devuelve la misma fecha', () => {
    const r = sumarDiasHabiles(MIERCOLES, 0, new Set())
    expect(r.getDate()).toBe(9)
  })
})
