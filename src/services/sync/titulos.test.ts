import { describe, it, expect } from 'vitest'

describe('titulos + historico modules', () => {
  it('export the sync functions', async () => {
    const t = await import('./titulos')
    const h = await import('./historico')
    expect(typeof t.syncTitulos).toBe('function')
    expect(typeof h.syncHistorico).toBe('function')
  })
})
