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

describe('calcPreco com unidade de fator', () => {
  const base = {
    venda: 10, maximo: 20, minimo: 9, descinc: 0, quantidade: 1, fator: 6,
    desconto: 0, descper: 'N' as const, tabela: 1, tabelas: [{ codigo: 1, flex: 10 }],
  }
  it('aplica o fator uma única vez no total', () => {
    const r = calcPreco(base)
    expect(r.vlunit).toBe(60)
    expect(r.total).toBe(60)
  })
  it('aplica o fator uma única vez no flex', () => {
    expect(calcPreco(base).flex).toBe(6)
    expect(calcPreco({ ...base, unitario: 11 }).flex).toBe(6)
  })
  it('compara mínimo e máximo na mesma unidade do item', () => {
    const r = calcPreco(base)
    expect(r.abaixoMinimo).toBe(false)
    expect(r.acimaMaximo).toBe(false)
  })
})

describe('calcPreco com valor unitário digitado', () => {
  const base = {
    venda: 10, maximo: 20, minimo: 9, descinc: 0, quantidade: 2, fator: 1,
    desconto: 0, descper: 'N' as const, tabela: 1, tabelas: [{ codigo: 1, flex: 0 }],
  }
  it('usa o valor digitado', () => {
    expect(calcPreco({ ...base, unitario: 12.5 })).toMatchObject({ vlunit: 12.5, total: 25, flex: 5 })
  })
  it('desconto incluso recalcula a partir da tabela e ignora o valor digitado', () => {
    expect(calcPreco({ ...base, unitario: 12.5, descinc: 10 })).toMatchObject({ vlunit: 9, total: 18 })
  })
  it('desconto que derruba o valor líquido abaixo do mínimo é sinalizado', () => {
    expect(calcPreco({ ...base, desconto: 50, descper: 'S' }).abaixoMinimo).toBe(true)
  })
  it('valor digitado acima do máximo é sinalizado mesmo com desconto', () => {
    expect(calcPreco({ ...base, unitario: 21, desconto: 10, descper: 'S' }).acimaMaximo).toBe(true)
  })
})
