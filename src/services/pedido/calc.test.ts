import { describe, it, expect } from 'vitest'
import { round, retNumber, pad, gerarIdUnico, getfator, isCondAvista } from './calc'

describe('round', () => {
  it('rounds to decimals correctly', () => {
    expect(round(1.005, 2)).toBe(1.01)
    expect(round(1234.5678, 2)).toBe(1234.57)
    expect(round(10)).toBe(10)
  })
})
describe('retNumber', () => {
  it('parses pt-BR numbers', () => {
    expect(retNumber('1.234,56')).toBe(1234.56)
    expect(retNumber('0,50')).toBe(0.5)
    expect(retNumber('')).toBe(0)
  })
})
describe('pad', () => {
  it('zero-pads to size', () => { expect(pad(42, 10)).toBe('0000000042') })
})
describe('gerarIdUnico', () => {
  it('returns a long non-empty string', () => { expect(gerarIdUnico().length).toBeGreaterThan(20) })
})
describe('getfator', () => {
  const f: [string, string, number][] = [['A', 'UN', 2], ['A', 'CX', 12]]
  it('returns fator or 1', () => {
    expect(getfator(f, 'A', 'CX')).toBe(12)
    expect(getfator(f, 'A', '')).toBe(1)
    expect(getfator(f, 'B', 'CX')).toBe(1)
  })
})
describe('isCondAvista', () => {
  const c = [{ codigo: 1, avista: 'S' }, { codigo: 2, avista: 'N' }]
  it('checks avista flag', () => {
    expect(isCondAvista(c, 1)).toBe(true)
    expect(isCondAvista(c, 2)).toBe(false)
    expect(isCondAvista(c, 9)).toBe(false)
  })
})
