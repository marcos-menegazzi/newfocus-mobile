import { beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBanco, inserir, query } from '../../test/sqlite'

let resposta = ''
const abertos: string[] = []

vi.mock('../../db/connection', () => import('../../test/sqlite'))
vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ usuario: { codlic: 3, usuario: 'M', server: 'srv', id: 'emp' } }) }))
vi.mock('./context', () => ({ call: vi.fn(async () => new DOMParser().parseFromString(resposta, 'text/xml')) }))
vi.mock('../files', () => ({ pdfUrl: (p: string) => p, openPdf: vi.fn(async (u: string) => { abertos.push(u) }) }))

import { abrirDanfe, emitirBoleto, emitirNfe } from './fiscal'

beforeEach(async () => {
  abertos.length = 0
  await abrirBanco()
  await inserir('ped', { numpedido: '1', status: 'S', sefaz: '', file: '' })
})

const ret = (xml: string) => `<String><retorno>${xml}</retorno></String>`

describe('emitirBoleto', () => {
  it('abre o arquivo da pasta da licenciada em minúsculas', async () => {
    resposta = ret('<status>OK</status><boleto>BOL_1.PDF</boleto>')
    await emitirBoleto(10)
    expect(abertos).toEqual(['boleto/li3/bol_1.pdf'])
  })
  it('explica pedido não faturado', async () => {
    resposta = ret('<status>NFIN</status>')
    await expect(emitirBoleto(10)).rejects.toThrow('não faturado')
  })
  it('trata ERRO.PDF em qualquer caixa', async () => {
    resposta = ret('<status>OK</status><boleto>ERRO.PDF</boleto>')
    await expect(emitirBoleto(10)).rejects.toThrow('boleto')
    expect(abertos).toEqual([])
  })
  it('exige lançamento', async () => {
    await expect(emitirBoleto(0)).rejects.toThrow('NF-e ainda não foi emitida')
  })
})

describe('emitirNfe', () => {
  it('grava o retorno e abre a DANFE', async () => {
    resposta = ret('<pedido>1</pedido><status>100</status><danfe>x.pdf</danfe><statped>Z</statped>')
    expect(await emitirNfe('1', 10)).toBe(true)
    expect(abertos).toEqual(['danfe/li3/x.pdf'])
    expect(await query('SELECT status, sefaz, file FROM ped')).toEqual([{ status: 'Z', sefaz: '100', file: 'x.pdf' }])
  })
  it('9999999999 é emissão sem DANFE: grava e não abre arquivo', async () => {
    resposta = ret('<pedido>1</pedido><status>100</status><danfe>9999999999</danfe><statped>Z</statped>')
    expect(await emitirNfe('1', 10)).toBe(false)
    expect(abertos).toEqual([])
    expect(await query('SELECT status FROM ped')).toEqual([{ status: 'Z' }])
  })
  it('mostra a mensagem do servidor só no status 999', async () => {
    resposta = ret('<pedido>Erro</pedido><status>999</status><danfe>CFOP inválido</danfe>')
    await expect(emitirNfe('1', 10)).rejects.toThrow('CFOP inválido')
    resposta = ret('<pedido>Erro</pedido><status>500</status><danfe>x9</danfe>')
    await expect(emitirNfe('1', 10)).rejects.toThrow('Erro durante a emissão da NF-e')
  })
  it('resposta vazia não apaga os dados do pedido', async () => {
    resposta = '<String/>'
    await expect(emitirNfe('1', 10)).rejects.toThrow('Erro durante a emissão da NF-e')
    expect(await query('SELECT status FROM ped')).toEqual([{ status: 'S' }])
  })
})

it('abrirDanfe não abre o marcador 9999999999', async () => {
  expect(await abrirDanfe('9999999999')).toBe(false)
  expect(await abrirDanfe('a.pdf')).toBe(true)
  expect(abertos).toEqual(['danfe/li3/a.pdf'])
})
