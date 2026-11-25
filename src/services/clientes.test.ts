import { beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBanco, inserir } from '../test/sqlite'

vi.mock('../db/connection', () => import('../test/sqlite'))

import { buscarClientes } from './clientes'

beforeEach(async () => {
  await abrirBanco()
  await inserir('clifor', { codigo: 1, fantasia: 'Alfa', razao: 'Alfa Ltda', ddd: '49', tel1: '3521-0000', endereco: 'Rua A' })
  await inserir('clifor', { codigo: 2, fantasia: 'Beta', razao: 'Beta SA' })
  for (const numero of ['1', '2']) await inserir('titulos', { clifor: 1, numero, valor: 10 })
  await inserir('histvenda', { clifor: 2, lancto: 1, pedido: 1, data: '2026-11-10' })
  await inserir('histitens', { lancto: 1, pedido: 1, produto: 'A', faturamento: 'S' })
})

const periodo: [string, string] = ['2026-11-01', '2026-11-30']
const filtro = { col: 'fantasia', termo: '', positivado: 'todos', periodo }

it('informa quantos títulos em aberto cada cliente tem', async () => {
  const r = await buscarClientes(filtro)
  expect(r.map((c) => [c.fantasia, c.titulos])).toEqual([['Alfa', 2], ['Beta', 0]])
})
it('filtra por título em aberto', async () => {
  expect((await buscarClientes({ ...filtro, titulos: true })).map((c) => c.codigo)).toEqual([1])
})

describe('demais filtros', () => {
  it('busca pelo campo escolhido', async () => {
    expect((await buscarClientes({ ...filtro, col: 'razao', termo: 'SA' })).map((c) => c.codigo)).toEqual([2])
  })
  it('positivação no período', async () => {
    expect((await buscarClientes({ ...filtro, positivado: 'positivados' })).map((c) => c.codigo)).toEqual([2])
    expect((await buscarClientes({ ...filtro, positivado: 'nao' })).map((c) => c.codigo)).toEqual([1])
  })
})
