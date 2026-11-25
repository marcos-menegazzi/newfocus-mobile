import { call } from '../sync/context'
import { arquivoRetorno, childText, linhas, rowChildren } from '../sync/helpers'
import { openPdf, pdfUrl } from '../files'
import { useAuthStore } from '../../stores/auth'

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
  const file = arquivoRetorno(doc, 'Não localizado termo de responsabilidade.')
  await openPdf(pdfUrl(`termo/${file}`))
}

/** Impressão do pedido gerada pelo ERP. */
export async function imprimirErp(lancto: string | number): Promise<void> {
  const u = useAuthStore().usuario
  if (!u) throw new Error('sem usuário logado')
  const doc = await call(`P_IPWEB:EXEC("${lancto}", "${u.codlic}")`)
  const retorno = doc.getElementsByTagName('retorno')[0]
  const arquivo = childText(retorno, 'arquivo')
  if (childText(retorno, 'status') !== 'Ok' || !arquivo) throw new Error('Erro durante a emissão do relatório.')
  await openPdf(pdfUrl(`pedido/Licenciada${u.codlic}/${arquivo}`))
}

export async function saldoSucata(
  codlic: string | number,
  cliente: string | number,
): Promise<SaldoSucata[]> {
  const doc = await call(`P_SLDRSW:EXEC(${codlic},${cliente})`)
  return linhas(doc, 'retorno', 'referencia').map((r) => ({
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
