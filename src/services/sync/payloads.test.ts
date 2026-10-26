import { describe, it, expect, vi } from 'vitest'
import initSqlJs from 'sql.js'
import { SCHEMA_SQL } from '../../db/schema'
import { tag } from './helpers'

vi.mock('../../db/connection', () => ({ run: vi.fn(), query: vi.fn(async () => []) }))
vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ usuario: null }) }))
vi.mock('./context', () => ({ call: vi.fn() }))

describe('tag', () => {
  it('uses the bracket format the server parses', () => {
    expect(tag('cnpj', '123')).toBe('[cnpj]123[/cnpj]')
    expect(tag('cj', null)).toBe('[cj]null[/cj]')
  })
})

describe('clientesPayload', () => {
  it('matches the legacy layout', async () => {
    const { clientesPayload } = await import('./clientes')
    const xml = clientesPayload([{ razao: 'AÇO & CIA', fantasia: 'Aço', cnpj: '1', obs: null, regiao: '01' }])
    expect(xml.startsWith('[clientes][cliente][razao]ACO  CIA[/razao][fantasia]Aco[/fantasia]')).toBe(true)
    expect(xml).toContain('[cnpj]1[/cnpj]')
    expect(xml).toContain('[obs][/obs]')
    expect(xml.endsWith('[regiao]01[/regiao][/cliente][/clientes]')).toBe(true)
    expect(xml).not.toMatch(/[<>]/)
  })
})

describe('pedidoPayload', () => {
  it('wraps every item in its own [produto]', async () => {
    const { pedidoPayload } = await import('./pedidos')
    const xml = pedidoPayload(
      { numpedido: '10', obsped: 'Entregar às 8h', complemento: '', cliente_nome: 'José' },
      [{ cobranca: 1, condicao: 2, valor: 50, autorizacao: '' }],
      [{ codproduto: 'A' }, { codproduto: 'B' }],
    )
    expect(xml.match(/\[produto\]/g)).toHaveLength(2)
    expect(xml).toContain('[obs]Entregar as 8h[/obs]')
    expect(xml).toContain('[financeiro][parcela][cobranca]1[/cobranca]')
    expect(xml).not.toMatch(/[<>]/)
  })
})

describe('sync SQL against the real schema', () => {
  it('PED_SQL only references existing columns', async () => {
    const SQL = await initSqlJs()
    const db = new SQL.Database()
    db.exec(SCHEMA_SQL)
    const { PED_SQL } = await import('./pedidos')
    expect(() => db.prepare(PED_SQL)).not.toThrow()
  })
})
