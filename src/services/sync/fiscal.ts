import { call } from './context'
import { childText } from './helpers'
import { run } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'
import { openPdf, pasta } from '../files'

export async function emitirNfe(numpedido: string, lancto: string | number): Promise<void> {
  const u = useAuthStore().usuario
  if (!u) throw new Error('sem usuário logado')
  const doc = await call(
    `P_NFEWEB:EXEC("[pedidos][pedido][numpedido]${numpedido}[/numpedido][lancto]${lancto}[/lancto][/pedido][/pedidos]","${u.codlic}","${u.usuario}")`,
  )
  const retorno = doc.getElementsByTagName('retorno')[0]
  const pedido = childText(retorno, 'pedido')
  const status = childText(retorno, 'status')
  const danfe = childText(retorno, 'danfe')
  const statped = childText(retorno, 'statped')
  if (pedido === 'Erro') throw new Error(danfe)
  await run('UPDATE ped SET sefaz=?, file=?, status=? WHERE numpedido=?', [status, danfe, statped, numpedido])
  await openPdf(`https://${u.server}/${pasta()}/danfe/li${u.codlic}/${danfe}`)
}

export async function emitirBoleto(lancto: string | number): Promise<void> {
  const u = useAuthStore().usuario
  if (!u) throw new Error('sem usuário logado')
  const doc = await call(`P_BOLWEB:EXEC("${u.codlic}","${lancto}")`)
  const retorno = doc.getElementsByTagName('retorno')[0]
  const status = childText(retorno, 'status')
  const boleto = childText(retorno, 'boleto')
  if (status !== 'OK') throw new Error('Não foi possível gerar o boleto')
  if (boleto === 'erro.pdf') throw new Error('Não foi possível gerar o boleto')
  await openPdf(`https://${u.server}/${pasta()}/boleto/${boleto}`)
}

export async function reenviarPedido(numpedido: string): Promise<void> {
  await run("UPDATE ped SET status = 'F', lancto = 0, file = '', sefaz = '' WHERE numpedido = ?", [numpedido])
}
