import { call } from './context'
import { childText, linhas, trocachar } from './helpers'
import { clearTables, pullPaged } from './pull'
import { run, runBatch, type Comando } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'

const lic = () => useAuthStore().usuario!.codlic
const user = () => useAuthStore().usuario!.usuario

export async function syncProdutos(): Promise<void> {
  await clearTables(['produtos', 'fatores'])
  await pullPaged(300, async (offset) => {
    const doc = await call(`P_PRODWEB:EXEC("${lic()}","${user()}", 300, ${offset})`)
    const rows = linhas(doc, 'retorno', 'codigo')
    if (rows.length === 0) return false
    const cmds: Comando[] = []
    for (const r of rows) {
      const codigo = childText(r, 'codigo')
      cmds.push({
        statement: 'INSERT INTO produtos(codigo, descricao, grupo, descred, peso, barras, link, comprado, observacao) VALUES (?,?,?,?,?,?,?,?,?)',
        values: [
          codigo, trocachar(childText(r, 'descricao')), childText(r, 'grupo'), trocachar(childText(r, 'descred')),
          childText(r, 'peso'), childText(r, 'barras'), childText(r, 'link'), childText(r, 'comprado'),
          childText(r, 'observacao'),
        ],
      })
      const fatores = r.getElementsByTagName('fatores')[0]
      if (fatores) {
        for (const f of Array.from(fatores.children)) {
          cmds.push({
            statement: 'INSERT INTO fatores(produto, unidade, fator) VALUES (?,?,?)',
            values: [codigo, childText(f, 'unidade'), childText(f, 'fator')],
          })
        }
      }
    }
    await runBatch(cmds)
    return true
  })
  await run("UPDATE usuario SET prodsinc = 'S'")
}

export async function syncEstoque(): Promise<void> {
  await clearTables(['estoque'])
  await pullPaged(300, async (offset) => {
    const doc = await call(`P_EWEB:EXEC("${lic()}","${user()}", 300, ${offset})`)
    const rows = linhas(doc, 'retorno', 'produto')
    if (rows.length === 0) return false
    await runBatch(rows.map((r) => ({
      statement: 'INSERT INTO estoque(codigo, empresa, estoque, centralizado, local) VALUES (?,?,?,?,?)',
      values: [
        childText(r, 'produto'), childText(r, 'empresa'), childText(r, 'saldo'),
        childText(r, 'centralizado'), childText(r, 'local'),
      ],
    })))
    return true
  })
}

export async function syncTabelaPreco(): Promise<void> {
  await clearTables(['tpreco', 'mvtpreco'])
  const doc = await call(`P_TBPWEB:EXEC(${lic()},"${user()}")`)
  const cmds: Comando[] = []
  for (const r of linhas(doc, 'tabelas', 'codigo')) {
    const codigo = childText(r, 'codigo')
    cmds.push({
      statement: 'INSERT INTO tpreco(codigo, descricao, flex, flex_pos, flex_max, flex_min, usa_cliente) VALUES (?,?,?,?,?,?,?)',
      values: [
        codigo, childText(r, 'descricao'), childText(r, 'flex'), childText(r, 'flex_pos'),
        childText(r, 'flex_max'), childText(r, 'flex_min'), childText(r, 'tabela_cliente'),
      ],
    })
    const itens = r.getElementsByTagName('itens')[0]
    if (itens) {
      for (const i of Array.from(itens.children)) {
        cmds.push({
          statement: 'INSERT INTO mvtpreco(tabela_codigo, produto, venda, maximo, minimo) VALUES (?,?,?,?,?)',
          values: [codigo, childText(i, 'produto'), childText(i, 'venda'), childText(i, 'maximo'), childText(i, 'minimo')],
        })
      }
    }
  }
  await runBatch(cmds)
}
