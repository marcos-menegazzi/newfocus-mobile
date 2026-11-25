import { childText, linhas, trocachar } from './helpers'
import { call } from './context'
import { clearTables } from './pull'
import { run } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'

const lic = () => useAuthStore().usuario!.codlic
const user = () => useAuthStore().usuario!.usuario

export async function syncOperacao(): Promise<void> {
  const doc = await call(`P_OPWEB:EXEC("${lic()}","${user()}")`)
  await clearTables(['operacao'])
  for (const r of linhas(doc, 'retorno', 'operacao')) {
    let cob = childText(r, 'cobranca')
    if (cob === 'SC') cob = ''
    await run(
      'INSERT INTO operacao(operacao, empresa, cobranca, estoque, local) VALUES (?,?,?,?,?)',
      [childText(r, 'operacao'), childText(r, 'empresa'), cob, childText(r, 'estoque'), childText(r, 'local')],
    )
  }
}

export async function syncCondicao(): Promise<void> {
  const doc = await call(`P_CONDWEB:EXEC("${lic()}","${user()}")`)
  await clearTables(['condicao'])
  for (const r of linhas(doc, 'retorno', 'codigo')) {
    await run('INSERT INTO condicao(codigo, descr, parcelas, avista, inativo) VALUES (?,?,?,?,?)', [
      childText(r, 'codigo'), childText(r, 'descricao'), childText(r, 'parcelas'),
      childText(r, 'avista'), childText(r, 'inativo'),
    ])
  }
}

export async function syncCobrancas(): Promise<void> {
  const doc = await call(`P_COBWEB:EXEC("${lic()}","${user()}")`)
  await clearTables(['cobrancas'])
  for (const r of linhas(doc, 'retorno', 'codigo')) {
    await run('INSERT INTO cobrancas(codigo, descr) VALUES (?,?)', [childText(r, 'codigo'), childText(r, 'descricao')])
  }
}

export async function syncComissao(): Promise<void> {
  const doc = await call(`P_TBWEB:EXEC("${lic()}","${user()}")`)
  await clearTables(['comissao'])
  for (const r of linhas(doc, 'retorno', 'codigo')) {
    await run('INSERT INTO comissao(codigo, descricao) VALUES (?,?)', [childText(r, 'codigo'), childText(r, 'descr')])
  }
}

export async function syncCarga(): Promise<void> {
  const doc = await call(`P_CGWEB:EXEC("${lic()}", "${user()}", "01/01/1901")`)
  await clearTables(['carga'])
  for (const r of linhas(doc, 'retorno', 'codigo')) {
    await run('INSERT INTO carga(codigo, descricao, dataalt, inativo) VALUES (?,?,?,?)', [
      childText(r, 'codigo'), childText(r, 'descricao'), childText(r, 'dataalt'), childText(r, 'inativo'),
    ])
  }
}

export async function syncHistoricoAgenda(): Promise<void> {
  const doc = await call(`P_HAGEWEB:EXEC("${lic()}", "${user()}", "")`)
  await clearTables(['historico_agenda'])
  for (const r of linhas(doc, 'retorno', 'codigo')) {
    await run('INSERT INTO historico_agenda(codigo, descricao, data, inativo) VALUES (?,?,?,?)', [
      childText(r, 'codigo'), childText(r, 'descricao'), childText(r, 'data'), childText(r, 'inativo'),
    ])
  }
}

export async function syncEmpresas(): Promise<void> {
  const doc = await call(`P_EMPWEB:EXEC("${lic()}","${user()}")`)
  await clearTables(['empresas'])
  for (const r of linhas(doc, 'retorno', 'codigo')) {
    await run('INSERT INTO empresas(empresa, fantasia) VALUES (?,?)', [childText(r, 'codigo'), trocachar(childText(r, 'fantasia'))])
  }
}

export async function syncRegiao(): Promise<void> {
  const doc = await call(`P_REGMOB02:EXEC(${lic()})`)
  await clearTables(['regiao'])
  for (const r of linhas(doc, 'retorno', 'codigo')) {
    await run('INSERT INTO regiao(regiao, descricao) VALUES (?,?)', [childText(r, 'codigo'), trocachar(childText(r, 'descricao'))])
  }
}

export async function syncVendedores(): Promise<void> {
  const doc = await call('P_VENDWEB:EXEC()')
  await clearTables(['vendedores'])
  for (const r of linhas(doc, 'vendedores', 'codigo')) {
    await run('INSERT INTO vendedores(codigo, nome) VALUES (?,?)', [childText(r, 'codigo'), trocachar(childText(r, 'nome'))])
  }
}

export async function syncGrupos(): Promise<void> {
  const doc = await call(`P_GPWEB:EXEC("${lic()}","${user()}")`)
  await clearTables(['grupos'])
  for (const r of linhas(doc, 'grupos', 'codigo')) {
    await run('INSERT INTO grupos(codigo, descricao) VALUES (?,?)', [childText(r, 'codigo'), childText(r, 'descricao')])
  }
}
