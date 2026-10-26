import { describe, it, expect, vi, beforeEach } from 'vitest'

const runs: { sql: string; params: unknown[] }[] = []

vi.mock('../../db/connection', () => ({
  run: vi.fn(async (sql: string, params: unknown[] = []) => {
    runs.push({ sql, params })
    return { changes: 1 }
  }),
}))

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({ usuario: { codlic: 3, usuario: 'MARCOS' } }),
}))

const PAGE = `<retorno><produto>
  <codigo>527868</codigo><descricao>ACUM ELET 100NE</descricao><grupo>1</grupo>
  <descred>1023</descred><peso>14.2</peso><barras>17898924883843</barras><link></link>
  <comprado>1054</comprado><observacao>OBS</observacao>
  <fatores><fator><unidade>CX</unidade><fator>12</fator></fator></fatores>
</produto></retorno>`

// Resposta real do P_PRODWEB quando o offset passa do último produto.
const FIM = '<retorno><result>false</result></retorno>'

const call = vi.fn()
vi.mock('./context', () => ({ call: (c: string) => call(c) }))

const xml = (s: string) => new DOMParser().parseFromString(s, 'text/xml')

describe('produtos sync module', () => {
  it('exports the three sync functions', async () => {
    const m = await import('./produtos')
    expect(typeof m.syncProdutos).toBe('function')
    expect(typeof m.syncEstoque).toBe('function')
    expect(typeof m.syncTabelaPreco).toBe('function')
  })
})

describe('syncProdutos', () => {
  beforeEach(() => {
    runs.length = 0
    call.mockReset()
  })

  it('para a paginação quando o servidor devolve result=false', async () => {
    let n = 0
    call.mockImplementation(async () => {
      if (++n > 5) throw new Error('paginação não terminou')
      return xml(n === 1 ? PAGE : FIM)
    })

    const { syncProdutos } = await import('./produtos')
    await syncProdutos()

    expect(call).toHaveBeenCalledTimes(2)
    const produtos = runs.filter((r) => /INSERT INTO produtos/.test(r.sql))
    expect(produtos).toHaveLength(1)
    expect(produtos[0].params[0]).toBe('527868')
    expect(runs.filter((r) => /INSERT INTO fatores/.test(r.sql))).toHaveLength(1)
  })
})
