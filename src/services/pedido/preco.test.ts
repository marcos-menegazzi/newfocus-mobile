import { describe, it, expect } from 'vitest'
import { retvalflex, calcPreco } from './preco'

describe('retvalflex', () => {
  const tabelas = [{ codigo: 1, flex: 10 }, { codigo: 2, flex: 5 }]
  it('returns flex % of valortab*qtd*fator when valorvend === valortab', () => {
    expect(retvalflex(tabelas, 1, 2, 10, 10, 1, 0, 'N')).toBe(2)
  })
  it('returns 0 when valorvend is below valortab', () => {
    expect(retvalflex(tabelas, 1, 2, 10, 9, 1, 0, 'N')).toBe(0)
  })
  it('returns 0 for unknown tabela', () => {
    expect(retvalflex(tabelas, 99, 2, 10, 10, 1, 0, 'N')).toBe(0)
  })
})

describe('calcPreco', () => {
  it('computes the known case', () => {
    const res = calcPreco({
      venda: 10, maximo: 12, minimo: 8, descinc: 0,
      quantidade: 2, fator: 1, desconto: 0, descper: 'N',
      tabela: 1, tabelas: [{ codigo: 1, flex: 10 }],
    })
    expect(res.vlunbase).toBe(10)
    expect(res.vlunit).toBe(10)
    expect(res.total).toBe(20)
  })
})
