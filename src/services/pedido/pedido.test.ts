import { beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBanco, inserir, query } from '../../test/sqlite'

vi.mock('../../db/connection', () => import('../../test/sqlite'))

import { carregarPedido, exigirProdutosSincronizados, salvarCabecalho, type CabecalhoInput } from './pedido'

const cab = {
  numpedido: '0000000001', operacao: 'V', clifor: 1, empresa: 1, condpag: 1, data: '2026-11-25', status: 'A',
  obsped: '', tabela: 1, carga: 1, tipo: 'S', comissao: 1, complemento: '', numero: '', cliente_nome: '',
  cliente_cpf: '', vendedor: 1, valor_frete: 0, resolvido: 'N', retsuc: 0, peso_total: 0,
} satisfies CabecalhoInput

beforeEach(async () => {
  await abrirBanco()
  await inserir('ped', { numpedido: cab.numpedido, status: 'A' })
})

describe('frete embutido', () => {
  it('precisa ser menor que o total', async () => {
    await inserir('mped', { numpedido: cab.numpedido, codproduto: 'A', qtd: 1, vltotal: 100 })
    await expect(salvarCabecalho({ ...cab, valor_frete: 100 })).rejects.toThrow('menor que o total')
    await salvarCabecalho({ ...cab, valor_frete: 99.99 })
    expect(await query('SELECT valor_frete FROM ped')).toEqual([{ valor_frete: 99.99 }])
  })
  it('zero é aceito em pedido ainda sem itens', async () => {
    await expect(salvarCabecalho(cab)).resolves.toBe(cab.numpedido)
  })
})

describe('exigirProdutosSincronizados', () => {
  beforeEach(() => inserir('usuario', { usuario: 'M', sincprod: 'S', prodsinc: 'S' }))

  it('consome a sincronização e bloqueia a próxima digitação', async () => {
    await exigirProdutosSincronizados()
    await expect(exigirProdutosSincronizados()).rejects.toThrow('Necessário sincronizar produtos')
  })
  it('pode só conferir, sem consumir', async () => {
    await exigirProdutosSincronizados({ consumir: false })
    await expect(exigirProdutosSincronizados()).resolves.toBeUndefined()
  })
  it('não se aplica a usuário sem a exigência', async () => {
    await query("UPDATE usuario SET sincprod = 'N', prodsinc = 'N'")
    await expect(exigirProdutosSincronizados()).resolves.toBeUndefined()
  })
})

it('carrega rascunho que ficou sem condição de pagamento', async () => {
  await query("UPDATE ped SET condpag = ''")
  expect(await carregarPedido(cab.numpedido)).toMatchObject({ numpedido: cab.numpedido })
})
