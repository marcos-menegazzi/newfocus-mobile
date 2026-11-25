import { beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBanco, inserir } from '../../test/sqlite'

vi.mock('../../db/connection', () => import('../../test/sqlite'))

import {
  creditoDisponivel, escolherCliente, opcoesDoCliente, sucataEmAberto, situacaoTitulos, tituloVencido, ultrapassaCredito,
} from './cliente'

beforeEach(abrirBanco)

describe('crédito', () => {
  const cliente = { limcred: 1000, credito: 300 }
  const regra = { limcred: 'S', libera: 'N', tipo: 'S', avista: false }
  it('disponível é o limite menos o já usado', () => {
    expect(creditoDisponivel(cliente)).toBe(700)
  })
  it('bloqueia só acima do disponível', () => {
    expect(ultrapassaCredito(cliente, 700, regra)).toBe(false)
    expect(ultrapassaCredito(cliente, 700.01, regra)).toBe(true)
  })
  it('não se aplica a entrada, cliente sem limite, usuário sem controle ou à vista liberado', () => {
    expect(ultrapassaCredito(cliente, 5000, { ...regra, tipo: 'E' })).toBe(false)
    expect(ultrapassaCredito({ limcred: 0, credito: 0 }, 5000, regra)).toBe(false)
    expect(ultrapassaCredito(cliente, 5000, { ...regra, limcred: 'N' })).toBe(false)
    expect(ultrapassaCredito(cliente, 5000, { ...regra, libera: 'S', avista: true })).toBe(false)
    expect(ultrapassaCredito(cliente, 5000, { ...regra, avista: true })).toBe(true)
  })
})

describe('títulos vencidos', () => {
  const hoje = new Date(2026, 10, 25)
  const usuario = { bloqueia: 'S', libera: 'N', bloqemp: 'N', dias: 5 }

  async function situacao(u: Partial<typeof usuario> = {}, tipo = 'S', empresa = 1) {
    const regra = { ...usuario, ...u }
    return situacaoTitulos(await tituloVencido(1, empresa, regra, hoje), regra, tipo, hoje)
  }
  const titulo = (vencimento: string, empresa = 1) => inserir('titulos', { clifor: 1, numero: '1', vencimento, empresa, valor: 1 })

  it('sem título vencido está liberado', async () => {
    await titulo('2026-11-21')
    expect(await situacao()).toBe('ok')
  })
  it('dentro da tolerância exata só avisa', async () => {
    await titulo('2026-11-20')
    expect(await situacao()).toBe('aviso')
  })
  it('além da tolerância bloqueia', async () => {
    await titulo('2026-11-19')
    expect(await situacao()).toBe('bloqueado')
  })
  it('usuário com liberação só vende à vista', async () => {
    await titulo('2026-11-19')
    expect(await situacao({ libera: 'S' })).toBe('somente-avista')
  })
  it('usuário sem bloqueio e pedido de entrada só avisam', async () => {
    await titulo('2026-11-19')
    expect(await situacao({ bloqueia: 'N' })).toBe('aviso')
    expect(await situacao({}, 'E')).toBe('aviso')
  })
  it('bloqueio por empresa ignora títulos de outra empresa', async () => {
    await titulo('2026-11-19', 2)
    expect(await situacao({ bloqemp: 'S' })).toBe('ok')
    expect(await situacao({ bloqemp: 'S' }, 'S', 2)).toBe('bloqueado')
  })
})

describe('sucata em aberto', () => {
  it('é o saldo negativo na empresa do pedido', async () => {
    await inserir('sucata_cliente', { cliente: 1, empresa: 1, saldo: -10 })
    await inserir('sucata_cliente', { cliente: 1, empresa: 2, saldo: 10 })
    expect(await sucataEmAberto(1, 1)).toBe(true)
    expect(await sucataEmAberto(1, 2)).toBe(false)
    expect(await sucataEmAberto(9, 1)).toBe(false)
  })
})

describe('opcoesDoCliente', () => {
  beforeEach(async () => {
    await inserir('condicao', { codigo: 1, descr: 'À vista', avista: 'S', inativo: 'N' })
    await inserir('condicao', { codigo: 2, descr: '30 dias', avista: 'N', inativo: 'N' })
    await inserir('condicao', { codigo: 3, descr: 'Antiga', avista: 'N', inativo: 'S' })
    await inserir('cobrancas', { codigo: 'B', descr: 'Boleto' })
    await inserir('cobrancas', { codigo: 'D', descr: 'Dinheiro' })
    await inserir('tpreco', { codigo: 1, descricao: 'Geral', usa_cliente: 'N' })
    await inserir('tpreco', { codigo: 2, descricao: 'Exclusiva', usa_cliente: 'S' })
  })
  const codigos = (l: { codigo: unknown }[]) => l.map((x) => x.codigo)

  it('sem restrição traz tudo, menos inativas e tabelas exclusivas', async () => {
    const o = await opcoesDoCliente(1)
    expect(codigos(o.condicoes)).toEqual([1, 2])
    expect(codigos(o.cobrancas)).toEqual(['B', 'D'])
    expect(codigos(o.tabelas)).toEqual([1])
  })
  it('com restrição traz só o permitido, inclusive tabela exclusiva', async () => {
    await inserir('condicao_cliente', { cliente: 1, condicao: 2 })
    await inserir('cobranca_cliente', { cliente: 1, cobranca: 'D' })
    await inserir('tabela_cliente', { cliente: 1, tabela: 2 })
    const o = await opcoesDoCliente(1)
    expect(codigos(o.condicoes)).toEqual([2])
    expect(codigos(o.cobrancas)).toEqual(['D'])
    expect(codigos(o.tabelas)).toEqual([2])
    expect(codigos((await opcoesDoCliente(2)).tabelas)).toEqual([1])
  })
})

describe('escolherCliente', () => {
  const hoje = new Date(2026, 10, 25)
  const row = { clifor: 1, codigo: 1, fantasia: 'Alfa', razao: 'Alfa Ltda', cnpj: '123', obs: 'Só boleto', tabela: 1, comissao: 4, saldo: 0, limcred: 0, credito: 0 }
  const usuario = { bloqueia: 'S', libera: 'N', bloqemp: 'N', dias: 5, obscli: 'N' }
  const ctx = { empresa: 1, tipo: 'S', condpag: 2, tabela: 2, usuario, hoje }

  beforeEach(async () => {
    await inserir('condicao', { codigo: 1, descr: 'À vista', avista: 'S', inativo: 'N' })
    await inserir('condicao', { codigo: 2, descr: '30 dias', avista: 'N', inativo: 'N' })
    await inserir('tpreco', { codigo: 1, descricao: 'A', usa_cliente: 'N' })
    await inserir('tpreco', { codigo: 2, descricao: 'B', usa_cliente: 'N' })
    await inserir('comissao', { codigo: 4, descricao: 'Padrão' })
  })
  const vencido = () => inserir('titulos', { clifor: 1, numero: '1', vencimento: '2026-01-01', empresa: 1, valor: 1 })

  it('aplica tabela, comissão e dados do cliente e limpa a operação', async () => {
    const e = await escolherCliente(row, ctx)
    expect(e.bloqueio).toBeNull()
    expect(e.cabecalho).toEqual({
      clifor: 1, tabela: 1, comissao: 4, condpag: 2, operacao: '', cobranca: '', cliente_nome: 'Alfa', cliente_cpf: '123',
    })
  })
  it('sem tabela padrão (ST) mantém a atual se for permitida', async () => {
    expect((await escolherCliente({ ...row, tabela: 'ST' }, ctx)).cabecalho.tabela).toBe(2)
    await inserir('tabela_cliente', { cliente: 1, tabela: 1 })
    expect((await escolherCliente({ ...row, tabela: 'ST' }, ctx)).cabecalho.tabela).toBe('')
  })
  it('descarta condição não liberada para o cliente', async () => {
    await inserir('condicao_cliente', { cliente: 1, condicao: 1 })
    expect((await escolherCliente(row, ctx)).cabecalho.condpag).toBe('')
  })
  it('comissão inexistente fica em branco para o vendedor escolher', async () => {
    expect((await escolherCliente({ ...row, comissao: 0 }, ctx)).cabecalho.comissao).toBe('')
  })
  it('avisa a observação, salvo usuário que não a vê', async () => {
    expect((await escolherCliente(row, ctx)).avisos).toEqual(['Só boleto'])
    expect((await escolherCliente(row, { ...ctx, usuario: { ...usuario, obscli: 'S' } })).avisos).toEqual([])
  })
  it('bloqueia cliente ainda não sincronizado', async () => {
    expect((await escolherCliente({ ...row, codigo: 0 }, ctx)).bloqueio).toContain('não sincronizado')
  })
  it('bloqueia sucata em aberto', async () => {
    await inserir('sucata_cliente', { cliente: 1, empresa: 1, saldo: -1 })
    expect((await escolherCliente(row, ctx)).bloqueio).toContain('sucata')
  })
  it('bloqueia títulos vencidos', async () => {
    await vencido()
    expect((await escolherCliente(row, ctx)).bloqueio).toContain('vencidos há mais de 5 dias')
  })
  it('com liberação, aceita o cliente e exige condição à vista', async () => {
    await vencido()
    const lib = { ...ctx, usuario: { ...usuario, libera: 'S' } }
    const e = await escolherCliente(row, lib)
    expect(e.bloqueio).toBeNull()
    expect(e.avisos[0]).toContain('à vista')
    expect(e.cabecalho.condpag).toBe('')
    expect((await escolherCliente(row, { ...lib, condpag: 1 })).cabecalho.condpag).toBe(1)
  })
})
