import { childText, rowChildren } from './helpers'
import { call } from './context'
import { clearTables } from './pull'
import { run } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'

const lic = () => useAuthStore().usuario!.codlic
const user = () => useAuthStore().usuario!.usuario

export async function syncOperacao(): Promise<void> {
  await clearTables(['operacao'])
  const doc = await call(`P_OPWEB:EXEC("${lic()}","${user()}")`)
  for (const r of rowChildren(doc, 'retorno')) {
    let cob = childText(r, 'cobranca')
    if (cob === 'SC') cob = ''
    await run(
      'INSERT INTO operacao(operacao, empresa, cobranca, estoque, local) VALUES (?,?,?,?,?)',
      [childText(r, 'operacao'), childText(r, 'empresa'), cob, childText(r, 'estoque'), childText(r, 'local')],
    )
  }
}

export async function syncCondicao(): Promise<void> {
  await clearTables(['condicao'])
  const doc = await call(`P_CONDWEB:EXEC("${lic()}","${user()}")`)
  for (const r of rowChildren(doc, 'retorno')) {
    await run('INSERT INTO condicao(codigo, descr, parcelas, avista, inativo) VALUES (?,?,?,?,?)', [
      childText(r, 'codigo'), childText(r, 'descricao'), childText(r, 'parcelas'),
      childText(r, 'avista'), childText(r, 'inativo'),
    ])
  }
}

export async function syncCobrancas(): Promise<void> {
  await clearTables(['cobrancas'])
  const doc = await call(`P_COBWEB:EXEC("${lic()}","${user()}")`)
  for (const r of rowChildren(doc, 'retorno')) {
    await run('INSERT INTO cobrancas(codigo, descr) VALUES (?,?)', [childText(r, 'codigo'), childText(r, 'descricao')])
  }
}

export async function syncComissao(): Promise<void> {
  await clearTables(['comissao'])
  const doc = await call(`P_TBWEB:EXEC("${lic()}","${user()}")`)
  for (const r of rowChildren(doc, 'retorno')) {
    await run('INSERT INTO comissao(codigo, descricao) VALUES (?,?)', [childText(r, 'codigo'), childText(r, 'descr')])
  }
}

export async function syncCarga(): Promise<void> {
  await clearTables(['carga'])
  const doc = await call(`P_CGWEB:EXEC("${lic()}", "${user()}", "01/01/1901")`)
  for (const r of rowChildren(doc, 'retorno')) {
    await run('INSERT INTO carga(codigo, descricao, dataalt, inativo) VALUES (?,?,?,?)', [
      childText(r, 'codigo'), childText(r, 'descricao'), childText(r, 'dataalt'), childText(r, 'inativo'),
    ])
  }
}

export async function syncHistoricoAgenda(): Promise<void> {
  await clearTables(['historico_agenda'])
  const doc = await call(`P_HAGEWEB:EXEC("${lic()}", "${user()}", "")`)
  for (const r of rowChildren(doc, 'retorno')) {
    await run('INSERT INTO historico_agenda(codigo, descricao, data, inativo) VALUES (?,?,?,?)', [
      childText(r, 'codigo'), childText(r, 'descricao'), childText(r, 'data'), childText(r, 'inativo'),
    ])
  }
}

export async function syncEmpresas(): Promise<void> {
  await clearTables(['empresas'])
  const doc = await call(`P_EMPWEB:EXEC("${lic()}","${user()}")`)
  for (const r of rowChildren(doc, 'retorno')) {
    await run('INSERT INTO empresas(empresa, fantasia) VALUES (?,?)', [childText(r, 'codigo'), childText(r, 'fantasia')])
  }
}

export async function syncRegiao(): Promise<void> {
  await clearTables(['regiao'])
  const doc = await call(`P_REGMOB02:EXEC(${lic()})`)
  for (const r of rowChildren(doc, 'retorno')) {
    await run('INSERT INTO regiao(regiao, descricao) VALUES (?,?)', [childText(r, 'codigo'), childText(r, 'descricao')])
  }
}

export async function syncVendedores(): Promise<void> {
  await clearTables(['vendedores'])
  const doc = await call('P_VENDWEB:EXEC()')
  for (const r of rowChildren(doc, 'vendedores')) {
    await run('INSERT INTO vendedores(codigo, nome) VALUES (?,?)', [childText(r, 'codigo'), childText(r, 'nome')])
  }
}

export async function syncGrupos(): Promise<void> {
  await clearTables(['grupos'])
  const doc = await call(`P_GPWEB:EXEC("${lic()}","${user()}")`)
  for (const r of rowChildren(doc, 'grupos')) {
    await run('INSERT INTO grupos(codigo, descricao) VALUES (?,?)', [childText(r, 'codigo'), childText(r, 'descricao')])
  }
}
