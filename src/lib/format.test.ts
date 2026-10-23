import { describe, it, expect } from 'vitest'
import { formatReal, mudadata } from './format'

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
