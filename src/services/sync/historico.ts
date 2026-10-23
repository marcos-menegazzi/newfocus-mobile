import { call } from './context'
import { childText, rowChildren } from './helpers'
import { clearTables } from './pull'
import { run } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'

export async function syncHistorico(): Promise<void> {
  const u = useAuthStore().usuario!
  await clearTables(['histvenda', 'histitens'])
  const doc = await call(`P_HISTWEB:EXEC("${u.codlic}","${u.usuario}")`)
  for (const r of rowChildren(doc, 'retorno')) {
    const pedido = childText(r, 'numpedido')
    await run('INSERT INTO histvenda(pedido, data, clifor, total, quantidade, lancto, condicao) VALUES (?,?,?,?,?,?,?)', [
      pedido, childText(r, 'data'), childText(r, 'clifor'), childText(r, 'total'),
      childText(r, 'quantidade'), childText(r, 'lancto'), childText(r, 'condicao'),
    ])
    const children = Array.from(r.children)
    for (let i = 7; i < children.length; i++) {
      const it = children[i]
      await run('INSERT INTO histitens(pedido, produto, faturamento, quant, vlunit, vldescto, vltotal, descricao, lancto, sequencia, tabela) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [
        pedido, childText(it, 'produto'), childText(it, 'faturamento'), childText(it, 'quant'),
        childText(it, 'vlunit'), childText(it, 'descto'), childText(it, 'totitem'),
        childText(it, 'descricao'), childText(it, 'lancto'), childText(it, 'sequencia'), childText(it, 'tabela'),
      ])
    }
  }
}
