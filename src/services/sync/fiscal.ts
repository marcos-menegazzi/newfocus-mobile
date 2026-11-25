import { call } from './context'
import { childText } from './helpers'
import { run } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'
import { openPdf, pdfUrl } from '../files'

/** O servidor devolve este nome quando a nota foi emitida mas não há DANFE para baixar. */
const SEM_DANFE = '9999999999'
const ERRO_NFE = 'Erro durante a emissão da NF-e.'
const ERRO_BOLETO = 'Erro durante a emissão do boleto.'

/** Abre a DANFE. Devolve `false` quando a nota não tem arquivo. */
export async function abrirDanfe(file: string): Promise<boolean> {
  if (file === SEM_DANFE) return false
  const u = useAuthStore().usuario
  if (!u) throw new Error('sem usuário logado')
  await openPdf(pdfUrl(`danfe/li${u.codlic}/${file}`))
  return true
}

/** Emite a NF-e e abre a DANFE. Devolve `false` quando a nota não tem arquivo. */
export async function emitirNfe(numpedido: string, lancto: string | number): Promise<boolean> {
  const u = useAuthStore().usuario
  if (!u) throw new Error('sem usuário logado')
  const doc = await call(
    `P_NFEWEB:EXEC("[pedidos][pedido][numpedido]${numpedido}[/numpedido][lancto]${lancto}[/lancto][/pedido][/pedidos]","${u.codlic}","${u.usuario}")`,
  )
  const retorno = doc.getElementsByTagName('retorno')[0]
  const pedido = childText(retorno, 'pedido')
  const status = childText(retorno, 'status')
  const danfe = childText(retorno, 'danfe')
  if (!pedido) throw new Error(ERRO_NFE)
  if (pedido === 'Erro') throw new Error(status === '999' && danfe ? danfe : ERRO_NFE)
  await run('UPDATE ped SET sefaz=?, file=?, status=? WHERE numpedido=?', [status, danfe, childText(retorno, 'statped'), numpedido])
  return abrirDanfe(danfe)
}

export async function emitirBoleto(lancto: string | number): Promise<void> {
  const u = useAuthStore().usuario
  if (!u) throw new Error('sem usuário logado')
  if (!(Number(lancto) > 0)) throw new Error('NF-e ainda não foi emitida.')
  const doc = await call(`P_BOLWEB:EXEC("${u.codlic}","${lancto}")`)
  const retorno = doc.getElementsByTagName('retorno')[0]
  const status = childText(retorno, 'status')
  const boleto = childText(retorno, 'boleto').toLowerCase()
  if (status === 'NFIN') throw new Error('Pedido não faturado, ou a série do pedido não gera financeiro.')
  if (status !== 'OK' || !boleto || boleto === 'erro.pdf') throw new Error(ERRO_BOLETO)
  await openPdf(pdfUrl(`boleto/li${u.codlic}/${boleto}`))
}

export async function reenviarPedido(numpedido: string): Promise<void> {
  await run("UPDATE ped SET status = 'F', lancto = 0, file = '', sefaz = '' WHERE numpedido = ?", [numpedido])
}
