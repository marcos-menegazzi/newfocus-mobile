import { describe, it, expect } from 'vitest'

describe('clientes sync module', () => {
  it('exports push and pull', async () => {
    const m = await import('./clientes')
    expect(typeof m.pushClientes).toBe('function')
    expect(typeof m.pullClientes).toBe('function')
  })
})
