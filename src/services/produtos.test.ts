import { beforeEach, expect, it, vi } from 'vitest'
import { abrirBanco, inserir } from '../test/sqlite'

vi.mock('../db/connection', () => import('../test/sqlite'))

import { buscarProdutos, buscarProdutosPedido } from './produtos'

beforeEach(async () => {
  await abrirBanco()
  await inserir('produtos', { codigo: '100', descricao: 'Bateria 60', descred: 'BAT60', grupo: 'G1', comprado: 5, observacao: 'a;b' })
  await inserir('produtos', { codigo: '200', descricao: 'Óleo', descred: 'OLEO', grupo: 'G2', comprado: 0, observacao: '' })
  for (const codigo of ['100', '200']) {
    await inserir('estoque', { codigo, empresa: 1, local: 1, estoque: 10, centralizado: 'N' })
    await inserir('mvtpreco', { tabela_codigo: 1, produto: codigo, venda: 10, maximo: 20, minimo: 9 })
  }
  await inserir('tpreco', { codigo: 1, descricao: 'T' })
})

it('busca por código mostra a descrição do produto', async () => {
  const r = await buscarProdutos({ col: 'codigo', termo: '100', positivado: 'todos', empresa: '', soComEstoque: false, periodo: ['2026-11-01', '2026-11-30'], limit: 10, offset: 0 })
  expect(r).toMatchObject([{ codigo: '100', descvis: 'Bateria 60', comprado: 5, estoque: 10 }])
})

it('busca do pedido filtra por grupo', async () => {
  const base = { col: 'descricao', termo: '', empresa: 1, local: 1, tabela: 1, limit: 10, offset: 0 }
  expect((await buscarProdutosPedido(base)).map((p) => p.codigo)).toEqual(['100', '200'])
  expect(await buscarProdutosPedido({ ...base, grupo: 'G1' })).toMatchObject([
    { codigo: '100', descvis: 'Bateria 60', venda: 10, minimo: 9, estoque: 10, comprado: 5, observacao: 'a;b', tabela: 1 },
  ])
})
