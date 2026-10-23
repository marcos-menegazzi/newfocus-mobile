import { describe, it, expect } from 'vitest'

describe('catalog', () => {
  it('exports all reference sync functions', async () => {
    const m = await import('./catalog')
    for (const fn of ['syncOperacao','syncCondicao','syncCobrancas','syncComissao','syncCarga','syncHistoricoAgenda','syncEmpresas','syncRegiao','syncVendedores','syncGrupos']) {
      expect(typeof (m as any)[fn]).toBe('function')
    }
  })
})
