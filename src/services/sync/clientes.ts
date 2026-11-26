import { call } from './context'
import { childText, linhas, removechar, tag, trocachar } from './helpers'
import { clearTables, pullPaged } from './pull'
import { query, runBatch, type Comando } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'

const lic = () => useAuthStore().usuario!.codlic
const user = () => useAuthStore().usuario!.usuario
const versao = () => useAuthStore().usuario!.versao

// Mesma ordem e mesmos tratamentos do sincronizar.html legado.
const CLIENTE_FIELDS = [
  'razao','fantasia','bairro','cep','estado','cidade','cj','contato','ddd','email',
  'endereco','fax','inscricao','numero','tel1','cnpj','emailnfe','simples','tippess',
  'obs','codigo','final','regiao',
]
const SANITIZE = new Set(['razao', 'fantasia', 'obs'])

export function clientesPayload(rows: any[]): string {
  return '[clientes]' + rows.map((c) =>
    '[cliente]' +
    CLIENTE_FIELDS.map((f) => tag(f, SANITIZE.has(f) ? removechar(c[f]) : c[f])).join('') +
    '[/cliente]'
  ).join('') + '[/clientes]'
}

export async function pushClientes(): Promise<void> {
  const rows = await query<any>('SELECT * FROM clifor WHERE enviado IS NULL OR enviado <> ?', ['S'])
  if (rows.length === 0) return
  const doc = await call(`P_CLIWEB:EXEC("${lic()}","${user()}", "${clientesPayload(rows)}")`)
  await runBatch(linhas(doc, 'clientes', 'cnpj').map((r) => ({
    statement: 'UPDATE clifor SET codigo = ?, enviado = ? WHERE cnpj = ?',
    values: [childText(r, 'codigo'), 'S', childText(r, 'cnpj')],
  })))
}

export async function pullClientes(): Promise<void> {
  await clearTables(['clifor', 'tabela_cliente', 'condicao_cliente', 'cobranca_cliente', 'sucata_cliente'])
  await pullPaged(300, async (offset) => {
    const doc = await call(`P_CWEB:EXEC("${lic()}","${user()}", "${versao()}", 300, ${offset})`)
    const rows = linhas(doc, 'clientes', 'codigo')
    if (rows.length === 0) return false
    // A página inteira vai numa só transação, como o INSERT de várias linhas do app legado.
    const cmds: Comando[] = []
    for (const r of rows) {
      const codigo = childText(r, 'codigo')
      const s = (t: string) => trocachar(childText(r, t))
      cmds.push({
        statement: `INSERT INTO clifor(fantasia,razao,bairro,cep,cidade,cj,contato,ddd,email,endereco,estado,fax,inscricao,numero,tel1,cnpj,emailnfe,simples,tippess,obs,enviado,codigo,inativo,tabela,saldo,limcred,credito,comissao,final,regiao)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'S',?,?,?,?,?,?,?,?,?)`,
        values: [
          s('fantasia'), s('razao'), s('bairro'), s('cep'), s('cidade'), s('cj'), s('contato'),
          s('ddd'), s('email'), s('endereco'), s('estado'), s('fax'), s('inscricao'), s('numero'),
          s('tel1'), s('cnpj'), s('emailnfe'), s('simples'), s('tippess'), s('obs'), codigo,
          s('inativo'), s('tabela'), s('saldo'), s('limcred'), s('credito'), s('comissao'), s('final'), s('regiao'),
        ],
      })
      const condicoes = r.getElementsByTagName('condicoes')[0]
      if (condicoes) for (const c of Array.from(condicoes.children)) {
        cmds.push({ statement: 'INSERT INTO condicao_cliente(condicao, cliente) VALUES (?,?)', values: [childText(c, 'codcond'), codigo] })
      }
      const cobrancas = r.getElementsByTagName('cobrancas')[0]
      if (cobrancas) for (const c of Array.from(cobrancas.children)) {
        cmds.push({ statement: 'INSERT INTO cobranca_cliente(cobranca, cliente) VALUES (?,?)', values: [childText(c, 'codcob'), codigo] })
      }
      const tabelas = r.getElementsByTagName('tabelas')[0]
      if (tabelas) for (const t of Array.from(tabelas.children)) {
        cmds.push({ statement: 'INSERT INTO tabela_cliente(tabela, cliente) VALUES (?,?)', values: [childText(t, 'codpre'), codigo] })
      }
      const sucatas = r.getElementsByTagName('sucatas')[0]
      if (sucatas) for (const s2 of Array.from(sucatas.children)) {
        cmds.push({
          statement: 'INSERT INTO sucata_cliente(cliente, empresa, saldo) VALUES (?,?,?)',
          values: [codigo, childText(s2, 'empresa'), childText(s2, 'saldo')],
        })
      }
    }
    await runBatch(cmds)
    return true
  })
}
