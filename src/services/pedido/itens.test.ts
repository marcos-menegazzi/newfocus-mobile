import { beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBanco, inserir, query } from '../../test/sqlite'

vi.mock('../../db/connection', () => import('../../test/sqlite'))

import { gravarItem, historicoProduto, incluirItem, type ItemArgs } from './itens'
import { aplicarAcrescimo, aplicarDesconto } from './desconto'

const item: ItemArgs = {
  numpedido: '1', codproduto: 'A', quantidade: 2, venda: 10, maximo: 20, minimo: 9,
  descinc: 0, desconto: 0, descper: 'N', operacao: 'VENDA', condicao: 1, comissao: 1,
  tabela: 1, unidade: '', fatores: [['A', 'CX', 6]], tabelas: [], estoque: 0, cEstoque: 'N', libmin: false,
}

beforeEach(abrirBanco)

describe('preço mínimo', () => {
  it('bloqueia desconto que deixa o item abaixo do mínimo', async () => {
    await expect(gravarItem({ ...item, desconto: 50, descper: 'S' })).rejects.toThrow('Valor Mínimo')
    expect(await query('SELECT * FROM mped')).toHaveLength(0)
  })
  it('usuário liberado grava e recebe o aviso', async () => {
    const r = await gravarItem({ ...item, desconto: 50, descper: 'S', libmin: true })
    expect(r.abaixoMinimo).toBe(true)
    expect(await query('SELECT * FROM mped')).toHaveLength(1)
  })
  it('sem desconto não avisa', async () => {
    expect((await incluirItem(item)).abaixoMinimo).toBe(false)
  })
})

it('grava o valor unitário digitado', async () => {
  await gravarItem({ ...item, unitario: 15 })
  expect(await query('SELECT vlunit, vltotal, vlbruto FROM mped')).toEqual([{ vlunit: 15, vltotal: 30, vlbruto: 15 }])
})

it('grava item em caixa com o fator aplicado uma vez', async () => {
  await incluirItem({ ...item, quantidade: 1, unidade: 'CX' })
  expect(await query('SELECT vlunit, vltotal, fator FROM mped')).toEqual([{ vlunit: 60, vltotal: 60, fator: 6 }])
})

describe('desconto e acréscimo do pedido em item com fator', () => {
  beforeEach(async () => {
    await inserir('produtos', { codigo: 'A', descricao: 'Produto', peso: 1 })
    await inserir('tpreco', { codigo: 1, descricao: 'T', flex: 0 })
    await inserir('mvtpreco', { tabela_codigo: 1, produto: 'A', venda: 10, maximo: 20, minimo: 9 })
    await inserir('ped', { numpedido: '1', tabela: 1, status: 'A' })
    await incluirItem({ ...item, quantidade: 1, unidade: 'CX' })
  })
  it('o mínimo considera o fator', async () => {
    await expect(aplicarDesconto('1', { aplicar: true, valor: 20, porItem: false })).rejects.toThrow('abaixo do minimo')
  })
  it('o máximo considera o fator', async () => {
    await aplicarAcrescimo('1', { aplicar: true, vlquilo: 0, vlunidade: 5, snquilo: 'N', snunidade: 'S' })
    expect(await query('SELECT vltotal FROM mped')).toEqual([{ vltotal: 65 }])
  })
})

describe('historicoProduto', () => {
  beforeEach(async () => {
    for (const [pedido, clifor] of [[10, 1], [11, 2]]) {
      await inserir('histvenda', { pedido, clifor, data: '2026-11-01', lancto: pedido, condicao: 'S/C' })
      await inserir('histitens', { pedido, produto: 'A', quant: 3, vlunit: 9, lancto: pedido, tabela: 'VAREJO' })
    }
  })
  it('lista as vendas do produto', async () => {
    expect(await historicoProduto('A')).toHaveLength(2)
  })
  it('restringe ao cliente e omite condição S/C', async () => {
    expect(await historicoProduto('A', 2)).toEqual([
      { pedido: 11, data: '2026-11-01', quant: 3, vlunit: 9, condicao: '', tabela: 'VAREJO' },
    ])
  })
})
