import { call } from './context'
import { childText, linhas } from './helpers'
import { clearTables } from './pull'
import { runBatch, type Comando } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'

// Cada venda traz 7 campos de cabeçalho e, em seguida, um elemento por item.
const CAMPOS_CABECALHO = 7

export async function syncHistorico(): Promise<void> {
  const u = useAuthStore().usuario!
  const doc = await call(`P_HISTWEB:EXEC("${u.codlic}","${u.usuario}")`)
  await clearTables(['histvenda', 'histitens'])
  const cmds: Comando[] = []
  for (const r of linhas(doc, 'retorno', 'numpedido')) {
    const pedido = childText(r, 'numpedido')
    // O item não traz lançamento: vale o da venda, que é o que liga as duas tabelas.
    const lancto = childText(r, 'lancto')
    cmds.push({
      statement: 'INSERT INTO histvenda(pedido, data, clifor, total, quantidade, lancto, condicao) VALUES (?,?,?,?,?,?,?)',
      values: [
        pedido, childText(r, 'data'), childText(r, 'clifor'), childText(r, 'total'),
        childText(r, 'quantidade'), lancto, childText(r, 'condicao'),
      ],
    })
    for (const it of Array.from(r.children).slice(CAMPOS_CABECALHO)) {
      cmds.push({
        statement: 'INSERT INTO histitens(pedido, produto, faturamento, quant, vlunit, vldescto, vltotal, descricao, lancto, sequencia, tabela) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        values: [
          pedido, childText(it, 'produto'), childText(it, 'faturamento'), childText(it, 'quant'),
          childText(it, 'vlunit'), childText(it, 'descto'), childText(it, 'totitem'),
          childText(it, 'descricao'), lancto, childText(it, 'sequencia'), childText(it, 'tabela'),
        ],
      })
    }
  }
  await runBatch(cmds)
}
