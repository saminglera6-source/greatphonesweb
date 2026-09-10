import { describe, it, expect } from 'vitest'
import {
  formatMilesInput, parseMiles,
  formatUsdInput, parseUsd,
  formatIntInput, parseIntSafe,
  maskCuil, isCuilValid, cuilDigits,
  maskImei, isImeiValid,
  maskTelefono, isTelefonoValid,
} from './formato'

describe('miles (pesos enteros)', () => {
  it('agrupa de a tres', () => {
    expect(formatMilesInput('1200000')).toBe('1.200.000')
    expect(formatMilesInput('999')).toBe('999')
    expect(formatMilesInput('1000')).toBe('1.000')
  })
  it('es idempotente y limpia basura', () => {
    expect(formatMilesInput('1.200.000')).toBe('1.200.000')
    expect(formatMilesInput('$ 1.200.000 ar')).toBe('1.200.000')
    expect(formatMilesInput('007')).toBe('7')
    expect(formatMilesInput('')).toBe('')
  })
  it('parseMiles vuelve al número', () => {
    expect(parseMiles('1.200.000')).toBe(1200000)
    expect(parseMiles('')).toBe(0)
    expect(parseMiles(4500)).toBe(4500)
  })
})

describe('usd (con decimales)', () => {
  it('miles con punto, decimales con coma', () => {
    expect(formatUsdInput('1234')).toBe('1.234')
    expect(formatUsdInput('1234,5')).toBe('1.234,5')
    expect(formatUsdInput('1234.56')).toBe('1.234,56')
    expect(formatUsdInput('1.234,567')).toBe('1.234,56')
  })
  it('parseUsd', () => {
    expect(parseUsd('1.234,56')).toBeCloseTo(1234.56)
    expect(parseUsd('980')).toBe(980)
    expect(parseUsd('')).toBe(0)
  })
})

describe('entero', () => {
  it('respeta el máximo', () => {
    expect(formatIntInput('150', { max: 100 })).toBe('100')
    expect(formatIntInput('87', { max: 100 })).toBe('87')
    expect(formatIntInput('03')).toBe('3')
  })
  it('parseIntSafe', () => {
    expect(parseIntSafe('12')).toBe(12)
    expect(parseIntSafe('')).toBe(0)
  })
})

describe('CUIL / CUIT', () => {
  it('pone los guiones al tipear', () => {
    expect(maskCuil('20')).toBe('20')
    expect(maskCuil('204290894')).toBe('20-4290894')
    expect(maskCuil('20429089450')).toBe('20-42908945-0')
    expect(maskCuil('20-42908945-0')).toBe('20-42908945-0')
  })
  it('valida el dígito verificador', () => {
    expect(isCuilValid('20-42908945-0')).toBe(true)   // válido
    expect(isCuilValid('20-42908945-1')).toBe(false)  // verificador mal
    expect(isCuilValid('20-4290894-0')).toBe(false)   // faltan dígitos
    expect(cuilDigits('20-42908945-0')).toBe('20429089450')
  })
})

describe('IMEI', () => {
  it('solo 15 dígitos', () => {
    expect(maskImei('35-680605-1234567-x')).toBe('356806051234567')
    expect(maskImei('3568060512345678999')).toBe('356806051234567')
  })
  it('valida Luhn', () => {
    expect(isImeiValid('490154203237518')).toBe(true)   // IMEI de ejemplo Luhn-válido
    expect(isImeiValid('490154203237519')).toBe(false)
    expect(isImeiValid('12345')).toBe(false)
  })
})

describe('teléfono', () => {
  it('formatea tolerante', () => {
    expect(maskTelefono('1155667788')).toBe('11 5566-7788')
    expect(maskTelefono('2914567890')).toBe('29 1456-7890')
    expect(maskTelefono('4567788')).toBe('456-7788')
  })
  it('valida largo razonable', () => {
    expect(isTelefonoValid('1155667788')).toBe(true)
    expect(isTelefonoValid('123')).toBe(false)
  })
})
