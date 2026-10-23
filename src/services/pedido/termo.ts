import { call } from '../sync/context'
import { childText, rowChildren } from '../sync/helpers'
import { openPdf, pdfUrl } from '../files'

export interface SaldoSucata {
  referencia: string
  saldo: string
}

export interface SaldoFinanceiro {
  conta: string
  quan: string
  total: string
}

export async function termo(lancto: string | number): Promise<void> {
  const doc = await call(`P_TRW001:EXEC(${lancto})`)
  const file = rowChildren(doc, 'retorno')[1]?.textContent ?? ''
  await openPdf(pdfUrl(`termo/${file}`))
}

export async function saldoSucata(
  codlic: string | number,
  cliente: string | number,
): Promise<SaldoSucata[]> {
  const doc = await call(`P_SLDRSW:EXEC(${codlic},${cliente})`)
  return rowChildren(doc, 'retorno').map((r) => ({
    referencia: childText(r, 'referencia'),
    saldo: childText(r, 'saldo'),
  }))
}

export async function saldosFinanceiro(cliente: string | number): Promise<SaldoFinanceiro[]> {
  const doc = await call(`P_SLDWEB01:EXEC(${cliente})`)
  const retorno = doc.getElementsByTagName('retorno')[0]
  if (!retorno) throw new Error('Não foi possível ler o retorno da consulta de saldos')
  const status = childText(retorno, 'status').toUpperCase()
  if (status !== 'OK') {
    throw new Error(childText(retorno, 'msg') || 'Erro ao consultar saldos')
  }
  return rowChildren(doc, 'saldos').map((r) => ({
    conta: childText(r, 'conta'),
    quan: childText(r, 'quan'),
    total: childText(r, 'total'),
  }))
}
