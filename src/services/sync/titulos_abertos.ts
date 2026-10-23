import { call } from './context'
import { childText, rowChildren } from './helpers'
import { openPdf, pasta } from '../files'
import { useAuthStore } from '../../stores/auth'

export interface TituloAberto {
  numero: string
  cobranca: string
  dtvenc: string
  valor: string
  lancto: string
}

export async function titulosAbertos(cliente: string | number): Promise<TituloAberto[]> {
  const u = useAuthStore().usuario
  if (!u) throw new Error('sem usuário logado')
  const doc = await call(`P_TAWEB:EXEC("${u.usuario}", ${cliente})`)
  return rowChildren(doc, 'retorno').map((r) => ({
    numero: childText(r, 'numero'),
    cobranca: childText(r, 'cobranca'),
    dtvenc: childText(r, 'dtvenc'),
    valor: childText(r, 'valor'),
    lancto: childText(r, 'lancto'),
  }))
}

export async function duplicata(lancto: string | number): Promise<void> {
  const u = useAuthStore().usuario
  if (!u) throw new Error('sem usuário logado')
  const doc = await call(`P_DUPWEB01:EXEC(${lancto})`)
  const file = rowChildren(doc, 'retorno')[1]?.textContent ?? ''
  await openPdf(`https://${u.server}/${pasta()}/duplicata/${file}`)
}
