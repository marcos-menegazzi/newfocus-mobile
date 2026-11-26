import { childText, linhas, trocachar } from './helpers'
import { call } from './context'
import { runBatch } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'

const lic = () => useAuthStore().usuario!.codlic
const user = () => useAuthStore().usuario!.usuario

/**
 * Substitui o conteúdo da tabela pelas linhas recebidas numa só transação: os passos
 * rodam em paralelo e quem lê a tabela (ex.: envio de pedidos) nunca a encontra vazia.
 */
async function substituir(
  tabela: string,
  statement: string,
  rows: Element[],
  valores: (r: Element) => unknown[],
): Promise<void> {
  await runBatch([
    { statement: `DELETE FROM ${tabela}`, values: [] },
    ...rows.map((r) => ({ statement, values: valores(r) })),
  ])
}

export async function syncOperacao(): Promise<void> {
  const doc = await call(`P_OPWEB:EXEC("${lic()}","${user()}")`)
  await substituir(
    'operacao',
    'INSERT INTO operacao(operacao, empresa, cobranca, estoque, local) VALUES (?,?,?,?,?)',
    linhas(doc, 'retorno', 'operacao'),
    (r) => {
      let cob = childText(r, 'cobranca')
      if (cob === 'SC') cob = ''
      return [childText(r, 'operacao'), childText(r, 'empresa'), cob, childText(r, 'estoque'), childText(r, 'local')]
    },
  )
}

export async function syncCondicao(): Promise<void> {
  const doc = await call(`P_CONDWEB:EXEC("${lic()}","${user()}")`)
  await substituir(
    'condicao',
    'INSERT INTO condicao(codigo, descr, parcelas, avista, inativo) VALUES (?,?,?,?,?)',
    linhas(doc, 'retorno', 'codigo'),
    (r) => [
      childText(r, 'codigo'), childText(r, 'descricao'), childText(r, 'parcelas'),
      childText(r, 'avista'), childText(r, 'inativo'),
    ],
  )
}

export async function syncCobrancas(): Promise<void> {
  const doc = await call(`P_COBWEB:EXEC("${lic()}","${user()}")`)
  await substituir('cobrancas', 'INSERT INTO cobrancas(codigo, descr) VALUES (?,?)', linhas(doc, 'retorno', 'codigo'),
    (r) => [childText(r, 'codigo'), childText(r, 'descricao')])
}

export async function syncComissao(): Promise<void> {
  const doc = await call(`P_TBWEB:EXEC("${lic()}","${user()}")`)
  await substituir('comissao', 'INSERT INTO comissao(codigo, descricao) VALUES (?,?)', linhas(doc, 'retorno', 'codigo'),
    (r) => [childText(r, 'codigo'), childText(r, 'descr')])
}

export async function syncCarga(): Promise<void> {
  const doc = await call(`P_CGWEB:EXEC("${lic()}", "${user()}", "01/01/1901")`)
  await substituir('carga', 'INSERT INTO carga(codigo, descricao, dataalt, inativo) VALUES (?,?,?,?)', linhas(doc, 'retorno', 'codigo'),
    (r) => [childText(r, 'codigo'), childText(r, 'descricao'), childText(r, 'dataalt'), childText(r, 'inativo')])
}

export async function syncHistoricoAgenda(): Promise<void> {
  const doc = await call(`P_HAGEWEB:EXEC("${lic()}", "${user()}", "")`)
  await substituir('historico_agenda', 'INSERT INTO historico_agenda(codigo, descricao, data, inativo) VALUES (?,?,?,?)', linhas(doc, 'retorno', 'codigo'),
    (r) => [childText(r, 'codigo'), childText(r, 'descricao'), childText(r, 'data'), childText(r, 'inativo')])
}

export async function syncEmpresas(): Promise<void> {
  const doc = await call(`P_EMPWEB:EXEC("${lic()}","${user()}")`)
  await substituir('empresas', 'INSERT INTO empresas(empresa, fantasia) VALUES (?,?)', linhas(doc, 'retorno', 'codigo'),
    (r) => [childText(r, 'codigo'), trocachar(childText(r, 'fantasia'))])
}

export async function syncRegiao(): Promise<void> {
  const doc = await call(`P_REGMOB02:EXEC(${lic()})`)
  await substituir('regiao', 'INSERT INTO regiao(regiao, descricao) VALUES (?,?)', linhas(doc, 'retorno', 'codigo'),
    (r) => [childText(r, 'codigo'), trocachar(childText(r, 'descricao'))])
}

export async function syncVendedores(): Promise<void> {
  const doc = await call('P_VENDWEB:EXEC()')
  await substituir('vendedores', 'INSERT INTO vendedores(codigo, nome) VALUES (?,?)', linhas(doc, 'vendedores', 'codigo'),
    (r) => [childText(r, 'codigo'), trocachar(childText(r, 'nome'))])
}

export async function syncGrupos(): Promise<void> {
  const doc = await call(`P_GPWEB:EXEC("${lic()}","${user()}")`)
  await substituir('grupos', 'INSERT INTO grupos(codigo, descricao) VALUES (?,?)', linhas(doc, 'grupos', 'codigo'),
    (r) => [childText(r, 'codigo'), childText(r, 'descricao')])
}
