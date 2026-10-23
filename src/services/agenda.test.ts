import { describe, it, expect } from 'vitest'
import { expandRecorrencia } from './agenda'

describe('expandRecorrencia', () => {
  it('advances data_base by dias, dia times', () => {
    expect(expandRecorrencia('2026-10-01', 3, 7)).toEqual(['2026-10-01', '2026-10-08', '2026-10-15'])
  })
  it('keeps same day when dias is 0', () => {
    expect(expandRecorrencia('2026-10-01', 2, 0)).toEqual(['2026-10-01', '2026-10-01'])
  })
  it('returns empty for dia <= 0', () => {
    expect(expandRecorrencia('2026-10-01', 0, 7)).toEqual([])
    expect(expandRecorrencia('', 2, 7)).toEqual([])
  })
  it('crosses month boundaries', () => {
    expect(expandRecorrencia('2026-01-30', 2, 1)).toEqual(['2026-01-30', '2026-01-31'])
  })
})
