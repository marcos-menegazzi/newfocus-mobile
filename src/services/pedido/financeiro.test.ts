import { beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBanco, inserir, query } from '../../test/sqlite'
import { incluirParcela, validarFinanceiro } from './financeiro'

vi.mock('../../db/connection', () => import('../../test/sqlite'))

beforeEach(abrirBanco)

const parcela = (valor: number) => inserir('financeiro', { pedido: '1', cobranca: '01', condicao: 1, valor })

describe('validarFinanceiro', () => {
  it('é opcional: sem parcelas não valida nada', async () => {
    expect(await validarFinanceiro('1', 100, false, [9], ['09'])).toEqual({ ok: true })
  })

  it('sem parcelas é recusado só quando o usuário exige financeiro (finped)', async () => {
    expect((await validarFinanceiro('1', 100, true, [], [])).msg).toBe('Obrigatório informar o financeiro do pedido.')
  })

  it.each([60, 140])('com parcela (R$ %d), o total precisa bater com o pedido', async (valor) => {
    await parcela(valor)
    expect((await validarFinanceiro('1', 100, false, [], [])).ok).toBe(false)
  })

  it('aceita parcelas que somam o total do pedido', async () => {
    await parcela(100)
    expect(await validarFinanceiro('1', 100, false, [], [])).toEqual({ ok: true })
  })
})

describe('incluirParcela', () => {
  it('aceita o total exato quando a soma dos itens tem resíduo de ponto flutuante', async () => {
    await incluirParcela('1', '01', 1, 30.3, '', 10.1 + 20.2)
    expect(await query('SELECT valor FROM financeiro')).toEqual([{ valor: 30.3 }])
  })

  it('recusa valor acima do total', async () => {
    await expect(incluirParcela('1', '01', 1, 30.31, '', 10.1 + 20.2)).rejects.toThrow('não pode ser maior')
  })
})
