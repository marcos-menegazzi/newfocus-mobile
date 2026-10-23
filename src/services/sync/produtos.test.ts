import { describe, it, expect } from 'vitest'

describe('produtos sync module', () => {
  it('exports the three sync functions', async () => {
    const m = await import('./produtos')
    expect(typeof m.syncProdutos).toBe('function')
    expect(typeof m.syncEstoque).toBe('function')
    expect(typeof m.syncTabelaPreco).toBe('function')
  })
})
