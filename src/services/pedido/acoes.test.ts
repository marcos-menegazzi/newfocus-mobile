import { describe, it, expect } from 'vitest'
import {
  danfeEmitida, motivoBoleto, motivoCancelar, motivoDuplicar, motivoFinalizar,
  motivoImprimir, motivoNfe, motivoNfePedido, motivoReabrir, motivoReenviar, motivoTransformar,
} from './acoes'

const rascunho = { status: 'A', itens: 0 }
const aberto = { status: 'A', itens: 2 }
const finalizado = { status: 'F', itens: 2 }
const sincronizado = { status: 'S', itens: 2, lancto: 123 }

describe('NF-e, boleto e termo', () => {
  it('bloqueia sem itens ou antes da sincronização', () => {
    expect(motivoNfe(rascunho)).toBe('Pedido sem itens.')
    expect(motivoNfe(aberto)).toMatch(/Finalize/)
    expect(motivoNfe(finalizado)).toMatch(/Sincronize/)
    expect(motivoBoleto({ status: 'V', itens: 2 })).toMatch(/Aguardando/)
    expect(motivoNfe({ ...sincronizado, status: 'C' })).toBe('Pedido cancelado.')
  })
  it('libera com lançamento', () => {
    expect(motivoNfe(sincronizado)).toBeNull()
    expect(motivoNfe({ ...sincronizado, status: 'Z' })).toBeNull()
    expect(motivoBoleto(sincronizado)).toBeNull()
  })
  it('reconhece DANFE já emitida', () => {
    expect(danfeEmitida({ ...sincronizado, sefaz: '100', file: 'x.pdf' })).toBe(true)
    expect(danfeEmitida({ ...sincronizado, sefaz: '', file: '' })).toBe(false)
  })
})

describe('demais ações', () => {
  it('finalizar e imprimir exigem itens', () => {
    expect(motivoFinalizar(rascunho)).toMatch(/Adicione itens/)
    expect(motivoFinalizar(aberto)).toBeNull()
    expect(motivoFinalizar(finalizado)).toMatch(/não está aberto/)
    expect(motivoImprimir(rascunho)).not.toBeNull()
    expect(motivoImprimir(finalizado)).toBeNull()
    expect(motivoDuplicar(rascunho)).not.toBeNull()
  })
  it('reabrir só para finalizado', () => {
    expect(motivoReabrir(finalizado)).toBeNull()
    expect(motivoReabrir(aberto)).not.toBeNull()
    expect(motivoReabrir(sincronizado)).not.toBeNull()
  })
  it('transformar só para orçamento não enviado', () => {
    expect(motivoTransformar({ ...aberto, tipo: 'O' })).toBeNull()
    expect(motivoTransformar({ ...aberto, tipo: 'S' })).not.toBeNull()
    expect(motivoTransformar({ ...sincronizado, tipo: 'O' })).not.toBeNull()
  })
  it('cancelar bloqueia pedidos enviados', () => {
    expect(motivoCancelar(rascunho)).toBeNull()
    expect(motivoCancelar(finalizado)).toBeNull()
    for (const status of ['C', 'S', 'Z', 'V']) expect(motivoCancelar({ status, itens: 1 })).not.toBeNull()
  })
})

describe('NF-e direto da tela do pedido', () => {
  it('aceita pedido aberto ou finalizado com itens', () => {
    expect(motivoNfePedido(aberto)).toBeNull()
    expect(motivoNfePedido(finalizado)).toBeNull()
    expect(motivoNfePedido(sincronizado)).toBeNull()
  })
  it('bloqueia rascunho, aguardando confirmação e orçamento', () => {
    expect(motivoNfePedido(rascunho)).not.toBeNull()
    expect(motivoNfePedido({ status: 'V', itens: 1 })).toMatch(/Aguardando/)
    expect(motivoNfePedido({ ...aberto, tipo: 'O' })).toMatch(/orçamento/)
  })
})

it('reenviar só para pedido aguardando confirmação', () => {
  expect(motivoReenviar({ status: 'V', itens: 1 })).toBeNull()
  expect(motivoReenviar(sincronizado)).not.toBeNull()
})
