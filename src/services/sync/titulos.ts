import { call } from './context'
import { childText, rowChildren } from './helpers'
import { clearTables } from './pull'
import { run } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'

export async function syncTitulos(): Promise<void> {
  const u = useAuthStore().usuario!
  await clearTables(['titulos'])
  const doc = await call(`P_TWEB:EXEC("${u.codlic}","${u.usuario}")`)
  for (const r of rowChildren(doc, 'retorno')) {
    const obs = childText(r, 'obs') === 'sem_dados' ? '' : childText(r, 'obs')
    await run('INSERT INTO titulos(numero, clifor, valor, emissao, vencimento, obs, tipo, cobranca, empresa) VALUES (?,?,?,?,?,?,?,?,?)', [
      childText(r, 'numero'), childText(r, 'clifor'), childText(r, 'valor'),
      childText(r, 'dtemis'), childText(r, 'dtvenc'), obs, childText(r, 'tipo'),
      childText(r, 'cobranca'), childText(r, 'empresa'),
    ])
  }
}
