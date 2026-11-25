import { beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBanco, inserir, query } from '../../test/sqlite'

let resposta: () => string
vi.mock('../../db/connection', () => import('../../test/sqlite'))
vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ usuario: { codlic: 3, usuario: 'M' } }) }))
vi.mock('./context', () => ({ call: vi.fn(async () => new DOMParser().parseFromString(resposta(), 'text/xml')) }))

import { syncHistorico } from './historico'
import { buscarClientes } from '../clientes'
import { buscarProdutos } from '../produtos'
import { indicadores } from '../indicadores'

// Como o sincronizar.html original lê: 7 campos de cabeçalho e depois um elemento por item,
// sem `lancto` no item (o do cabeçalho vale para todos).
const item = (produto: string, total: number, faturamento = 'S') =>
  `<item><produto>${produto}</produto><quant>2</quant><vlunit>10</vlunit><descto>0</descto><totitem>${total}</totitem><descricao>P ${produto}</descricao><faturamento>${faturamento}</faturamento><sequencia>1</sequencia><tabela>VAREJO</tabela></item>`
const venda = (numero: number, clifor: number, itens: string, data = '2026-11-10') =>
  `<historico><numpedido>${numero}</numpedido><data>${data}</data><clifor>${clifor}</clifor><total>50</total><quantidade>2</quantidade><lancto>9${numero}</lancto><condicao>30 DIAS</condicao>${itens}</historico>`
const xml = (...v: string[]) => `<String><retorno>${v.join('')}</retorno></String>`

const periodo: [string, string] = ['2026-11-01', '2026-11-30']

beforeEach(async () => {
  await abrirBanco()
  await inserir('clifor', { codigo: 1, fantasia: 'Alfa' })
  await inserir('clifor', { codigo: 2, fantasia: 'Beta' })
  for (const codigo of ['A', 'B', 'C']) await inserir('produtos', { codigo, descricao: codigo, descred: codigo })
  resposta = () => xml(venda(1, 1, item('A', 30) + item('B', 20)), venda(2, 1, item('A', 15)), venda(3, 2, item('C', 99, 'N')))
})

describe('histórico sincronizado', () => {
  beforeEach(syncHistorico)

  it('os itens herdam o lançamento da venda', async () => {
    expect(await query('SELECT pedido, produto, lancto FROM histitens ORDER BY pedido, produto')).toEqual([
      { pedido: 1, produto: 'A', lancto: 91 }, { pedido: 1, produto: 'B', lancto: 91 },
      { pedido: 2, produto: 'A', lancto: 92 }, { pedido: 3, produto: 'C', lancto: 93 },
    ])
  })
  it('alimenta a visão geral', async () => {
    expect(await indicadores(periodo)).toEqual({
      vendasTotal: 65, vendasQtd: 2,
      clientesPositivados: 1, totalClientes: 2,
      produtosPositivados: 2, totalProdutos: 3,
    })
  })
  it('positiva os clientes', async () => {
    const r = await buscarClientes({ col: 'fantasia', termo: '', positivado: 'todos', periodo })
    expect(r.map((c) => [c.fantasia, c.positivado > 0])).toEqual([['Alfa', true], ['Beta', false]])
  })
  it('positiva os produtos', async () => {
    const base = { col: 'descricao', termo: '', empresa: '', soComEstoque: false, periodo, limit: 10, offset: 0 }
    expect((await buscarProdutos({ ...base, positivado: 'positivados' })).map((p) => p.codigo)).toEqual(['A', 'B'])
    expect((await buscarProdutos({ ...base, positivado: 'nao' })).map((p) => p.codigo)).toEqual(['C'])
  })
})

it('falha na rede não apaga o histórico que já estava no aparelho', async () => {
  await syncHistorico()
  resposta = () => { throw new Error('sem rede') }
  await expect(syncHistorico()).rejects.toThrow('sem rede')
  expect(await query('SELECT * FROM histvenda')).toHaveLength(3)
})
