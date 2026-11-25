import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { abrirBanco, inserir, query } from '../../test/sqlite'

const comandos: string[] = []
let respostas: Record<string, string> = {}
let horario: () => Promise<unknown>

vi.mock('../../db/connection', () => import('../../test/sqlite'))
vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ usuario: { codlic: 3, usuario: 'M', versao: '1' } }) }))
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { get: () => horario() } }))
vi.mock('./context', () => ({
  call: vi.fn(async (c: string) => {
    comandos.push(c)
    const nome = /^P_[A-Z]+\d*/.exec(c)![0]
    const xml = respostas[nome] ?? '<String><retorno><result>false</result></retorno></String>'
    if (xml === 'ERRO') throw new Error('sem rede')
    return new DOMParser().parseFromString(xml, 'text/xml')
  }),
}))

import { sincronizar } from './index'
import { pullAgenda } from './agenda'
import { pullPedidoStatus, pushPedidos } from './pedidos'
import { syncEstoque } from './produtos'
import { syncCondicao, syncEmpresas, syncRegiao, syncVendedores } from './catalog'
import { buscarClientes } from '../clientes'
import { syncTitulos } from './titulos'
import { syncHistorico } from './historico'
import { servidorOcupado } from './gate'

const base = {
  P_VDCWEB: '<String><retorno><status>ok</status></retorno></String>',
  P_FLXWEB01: '<String><retorno><saldo>1</saldo></retorno></String>',
}
const nada = { clientes: false, produtos: false, pedidos: false, titulos: false, historico: false, agenda: false }
const chamou = (nome: string) => comandos.some((c) => c.startsWith(nome + ':'))

beforeEach(async () => {
  setActivePinia(createPinia())
  comandos.length = 0
  respostas = { ...base }
  horario = async () => ({ data: { time: '10:30:00' } })
  await abrirBanco()
  await inserir('usuario', { usuario: 'M' })
})

describe('sincronização seletiva', () => {
  it('sem grupos baixa só os cadastros básicos', async () => {
    await sincronizar(nada)
    expect(chamou('P_OPWEB')).toBe(true)
    for (const c of ['P_CWEB', 'P_PRODWEB', 'P_TWEB', 'P_HISTWEB', 'P_AGWEB']) expect(chamou(c)).toBe(false)
  })
  it('pedidos também sincroniza clientes', async () => {
    await sincronizar({ ...nada, pedidos: true })
    expect(chamou('P_CWEB')).toBe(true)
    expect(chamou('P_PRODWEB')).toBe(false)
  })
  it('por padrão sincroniza tudo', async () => {
    await sincronizar()
    for (const c of ['P_CWEB', 'P_PRODWEB', 'P_EWEB', 'P_TBPWEB', 'P_GPWEB', 'P_TWEB', 'P_HISTWEB', 'P_AGWEB']) expect(chamou(c)).toBe(true)
  })
})

describe('horário do servidor', () => {
  it('reconhece a virada da hora', async () => {
    horario = async () => ({ data: { time: '10:59:30' } })
    expect(await servidorOcupado()).toBe(true)
    horario = async () => ({ data: { time: '11:00:30' } })
    expect(await servidorOcupado()).toBe(true)
    horario = async () => ({ data: { time: '11:01:30' } })
    expect(await servidorOcupado()).toBe(false)
  })
  it('API fora do ar não impede a sincronização', async () => {
    horario = async () => { throw new Error('fora do ar') }
    await expect(sincronizar(nada)).resolves.toBeUndefined()
  })
})

it('pedido sincronizado passa a faturado', async () => {
  await inserir('ped', { numpedido: '1', idunico: 'abc', status: 'S' })
  respostas.P_VPEDW = '<String><retorno><pedido><numero>1</numero><status>Z</status><sefaz>100</sefaz><chave>x.pdf</chave><lancto>9</lancto><idunico>abc</idunico></pedido></retorno></String>'
  await pullPedidoStatus()
  expect(await query('SELECT status, sefaz, file, lancto FROM ped')).toEqual([{ status: 'Z', sefaz: '100', file: 'x.pdf', lancto: 9 }])
})

it('envia só o pedido informado', async () => {
  await inserir('clifor', { codigo: 1, fantasia: 'C' })
  await inserir('condicao', { codigo: 1, inativo: 'N' })
  for (const numpedido of ['1', '2']) await inserir('ped', { numpedido, clifor: 1, condpag: 1, status: 'F' })
  respostas.P_PWEB = '<String><pedidos><pedido><numped>2</numped><lancto>5</lancto><status>Ok</status><msg/></pedido></pedidos></String>'
  await pushPedidos('2')
  expect(await query('SELECT numpedido, status FROM ped ORDER BY numpedido')).toEqual([
    { numpedido: '1', status: 'F' }, { numpedido: '2', status: 'S' },
  ])
})

describe('resposta "result false" no lugar da lista', () => {
  it('encerra a paginação do estoque', async () => {
    await syncEstoque()
    expect(comandos).toHaveLength(1)
    expect(await query('SELECT * FROM estoque')).toEqual([])
  })
  it('não grava registros vazios', async () => {
    await syncCondicao()
    await syncTitulos()
    await syncHistorico()
    for (const t of ['condicao', 'titulos', 'histvenda']) expect(await query(`SELECT * FROM ${t}`)).toEqual([])
  })
})

describe('agenda pendente', () => {
  beforeEach(() => inserir('agenda', { clifor: 1, data_base: '2026-11-25', dia: '4', hora: '09:00', dias: 0, snvis: 'N' }))

  it('não se perde quando o envio falha', async () => {
    respostas.P_AGWEB = 'ERRO'
    await expect(pullAgenda()).rejects.toThrow('sem rede')
    expect(await query('SELECT snvis FROM agenda')).toEqual([{ snvis: 'N' }])
  })
  it('é substituída pela agenda do servidor', async () => {
    respostas.P_AGWEB = '<String><retorno><agenda><cliente>7</cliente><dtuvisita>2026-11-26</dtuvisita><diavisita>5</diavisita><hrvisita>10:00</hrvisita><dias>7</dias></agenda></retorno></String>'
    await pullAgenda()
    expect(await query('SELECT clifor, snvis FROM agenda')).toEqual([{ clifor: 7, snvis: 'S' }])
  })
})

describe('títulos sincronizados', () => {
  const titulo = '<String><retorno><titulo><numero>1</numero><clifor>7</clifor><dtemis>2026-01-01</dtemis><dtvenc>2026-02-01</dtvenc><obs>sem_dados</obs><valor>10</valor><tipo>D</tipo><cobranca>BOLETO</cobranca><empresa>1</empresa></titulo></retorno></String>'

  it('marcam o cliente com título em aberto', async () => {
    await inserir('clifor', { codigo: 7, fantasia: 'Alfa' })
    respostas.P_TWEB = titulo
    await syncTitulos()
    const [c] = await buscarClientes({ col: 'fantasia', termo: '', positivado: 'todos', periodo: ['2026-11-01', '2026-11-30'] })
    expect(c.titulos).toBe(1)
  })
  it('não se perdem quando a rede falha', async () => {
    respostas.P_TWEB = titulo
    await syncTitulos()
    respostas.P_TWEB = 'ERRO'
    await expect(syncTitulos()).rejects.toThrow('sem rede')
    expect(await query('SELECT * FROM titulos')).toHaveLength(1)
  })
})

it('decodifica o & nos nomes de empresa, região e vendedor', async () => {
  const lista = (raiz: string, campo: string) => `<String><${raiz}><x><codigo>1</codigo><${campo}>A_1eB</${campo}></x></${raiz}></String>`
  respostas.P_EMPWEB = lista('retorno', 'fantasia')
  respostas.P_REGMOB02 = lista('retorno', 'descricao')
  respostas.P_VENDWEB = lista('vendedores', 'nome')
  await syncEmpresas()
  await syncRegiao()
  await syncVendedores()
  expect(await query('SELECT fantasia FROM empresas')).toEqual([{ fantasia: 'A&B' }])
  expect(await query('SELECT descricao FROM regiao')).toEqual([{ descricao: 'A&B' }])
  expect(await query('SELECT nome FROM vendedores')).toEqual([{ nome: 'A&B' }])
})
