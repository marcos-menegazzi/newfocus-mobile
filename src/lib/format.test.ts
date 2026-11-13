import { describe, it, expect } from 'vitest'
import { formatReal, mudadata, realDeDigitos } from './format'

describe('formatReal', () => {
  it('formats pt-BR currency without R$', () => {
    expect(formatReal(1234.56)).toBe('1.234,56')
    expect(formatReal(0)).toBe('0,00')
    expect(formatReal(null)).toBe('0,00')
    expect(formatReal('99.9')).toBe('99,90')
  })
})

describe('mudadata', () => {
  it('converts YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(mudadata('2026-10-23')).toBe('23/10/2026')
  })
})

describe('realDeDigitos', () => {
  it('trata os dígitos como centavos', () => {
    expect(realDeDigitos('3')).toBe(0.03)
    expect(realDeDigitos('333')).toBe(3.33)
    expect(realDeDigitos('3333')).toBe(33.33)
    expect(realDeDigitos('123456')).toBe(1234.56)
  })
  it('ignora o que não é dígito, inclusive a máscara já exibida', () => {
    expect(realDeDigitos('R$ 3,33')).toBe(3.33)
    expect(realDeDigitos('R$ 3,334')).toBe(33.34)
    expect(realDeDigitos('R$ 3,3')).toBe(0.33)
    expect(realDeDigitos('R$ 1.234,56')).toBe(1234.56)
  })
  it('vazio ou zero vira null', () => {
    expect(realDeDigitos('')).toBeNull()
    expect(realDeDigitos('R$ 0,0')).toBeNull()
    expect(realDeDigitos('abc')).toBeNull()
  })
  it('limita a quantidade de dígitos', () => {
    expect(realDeDigitos('123456789012345')).toBe(123456789.01)
  })
})
