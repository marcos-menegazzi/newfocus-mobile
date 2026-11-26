import { call } from './context'
import { childText, linhas } from './helpers'
import { clearTables } from './pull'
import { runBatch } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'

export async function syncTitulos(): Promise<void> {
  const u = useAuthStore().usuario!
  const doc = await call(`P_TWEB:EXEC("${u.codlic}","${u.usuario}")`)
  await clearTables(['titulos'])
  await runBatch(linhas(doc, 'retorno', 'numero').map((r) => {
    const obs = childText(r, 'obs') === 'sem_dados' ? '' : childText(r, 'obs')
    return {
      statement: 'INSERT INTO titulos(numero, clifor, valor, emissao, vencimento, obs, tipo, cobranca, empresa) VALUES (?,?,?,?,?,?,?,?,?)',
      values: [
        childText(r, 'numero'), childText(r, 'clifor'), childText(r, 'valor'),
        childText(r, 'dtemis'), childText(r, 'dtvenc'), obs, childText(r, 'tipo'),
        childText(r, 'cobranca'), childText(r, 'empresa'),
      ],
    }
  }))
}
