import { call } from './context'
import { childText, rowChildren, trocachar } from './helpers'
import { clearTables, pullPaged } from './pull'
import { run } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'

const lic = () => useAuthStore().usuario!.codlic
const user = () => useAuthStore().usuario!.usuario

export async function syncProdutos(): Promise<void> {
  await clearTables(['produtos', 'fatores'])
  await pullPaged(300, async (offset) => {
    const doc = await call(`P_PRODWEB:EXEC("${lic()}","${user()}", 300, ${offset})`)
    const rows = rowChildren(doc, 'retorno')
    if (rows.length === 0) return false
    for (const r of rows) {
      const codigo = childText(r, 'codigo')
      await run(
        'INSERT INTO produtos(codigo, descricao, grupo, descred, peso, barras, link, comprado, observacao) VALUES (?,?,?,?,?,?,?,?,?)',
        [
          codigo, trocachar(childText(r, 'descricao')), childText(r, 'grupo'), trocachar(childText(r, 'descred')),
          childText(r, 'peso'), childText(r, 'barras'), childText(r, 'link'), childText(r, 'comprado'),
          childText(r, 'observacao'),
        ],
      )
      const fatores = r.getElementsByTagName('fatores')[0]
      if (fatores) {
        for (const f of Array.from(fatores.children)) {
          await run('INSERT INTO fatores(produto, unidade, fator) VALUES (?,?,?)', [
            codigo, childText(f, 'unidade'), childText(f, 'fator'),
          ])
        }
      }
    }
    return true
  })
  await run("UPDATE usuario SET prodsinc = 'S'")
}

export async function syncEstoque(): Promise<void> {
  await clearTables(['estoque'])
  await pullPaged(300, async (offset) => {
    const doc = await call(`P_EWEB:EXEC("${lic()}","${user()}", 300, ${offset})`)
    const rows = rowChildren(doc, 'retorno')
    if (rows.length === 0) return false
    for (const r of rows) {
      await run('INSERT INTO estoque(codigo, empresa, estoque, centralizado, local) VALUES (?,?,?,?,?)', [
        childText(r, 'produto'), childText(r, 'empresa'), childText(r, 'saldo'),
        childText(r, 'centralizado'), childText(r, 'local'),
      ])
    }
    return true
  })
}

export async function syncTabelaPreco(): Promise<void> {
  await clearTables(['tpreco', 'mvtpreco'])
  const doc = await call(`P_TBPWEB:EXEC(${lic()},"${user()}")`)
  for (const r of rowChildren(doc, 'tabelas')) {
    const codigo = childText(r, 'codigo')
    await run('INSERT INTO tpreco(codigo, descricao, flex, flex_pos, flex_max, flex_min, usa_cliente) VALUES (?,?,?,?,?,?,?)', [
      codigo, childText(r, 'descricao'), childText(r, 'flex'), childText(r, 'flex_pos'),
      childText(r, 'flex_max'), childText(r, 'flex_min'), childText(r, 'tabela_cliente'),
    ])
    const itens = r.getElementsByTagName('itens')[0]
    if (itens) {
      for (const i of Array.from(itens.children)) {
        await run('INSERT INTO mvtpreco(tabela_codigo, produto, venda, maximo, minimo) VALUES (?,?,?,?,?)', [
          codigo, childText(i, 'produto'), childText(i, 'venda'), childText(i, 'maximo'), childText(i, 'minimo'),
        ])
      }
    }
  }
}
