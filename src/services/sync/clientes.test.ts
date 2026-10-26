import { describe, it, expect, vi, beforeEach } from 'vitest'

const runs: { sql: string; params: unknown[] }[] = []

vi.mock('../../db/connection', () => ({
  run: vi.fn(async (sql: string, params: unknown[] = []) => {
    runs.push({ sql, params })
    return { changes: 1 }
  }),
  query: vi.fn(async () => []),
}))

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({ usuario: { codlic: 3, usuario: 'MARCOS', versao: '1.0' } }),
}))

vi.mock('./pull', () => ({
  clearTables: vi.fn(async () => {}),
  pullPaged: vi.fn(async (_size: number, fn: (offset: number) => Promise<boolean>) => {
    await fn(0)
  }),
}))

const XML = `<retorno><clientes><cliente>
  <fantasia>Auto Pecas</fantasia><razao>AUTO PECAS LTDA</razao><codigo>1001</codigo>
  <cidade>CURITIBA</cidade><estado>PR</estado><inativo>N</inativo><tabela>1</tabela>
  <saldo>10</saldo><limcred>100</limcred><credito>90</credito><comissao>1</comissao>
  <final>N</final><regiao>01</regiao>
  <condicoes><c><codcond>5</codcond></c></condicoes>
</cliente></clientes></retorno>`

vi.mock('./context', () => ({
  call: vi.fn(async () => new DOMParser().parseFromString(XML, 'text/xml')),
}))

function insertShape(sql: string) {
  const m = sql.match(/INSERT INTO \w+\s*\(([^)]*)\)\s*VALUES\s*\(([^)]*)\)/s)
  if (!m) throw new Error(`not an insert: ${sql}`)
  const cols = m[1].split(',').map((c) => c.trim())
  const vals = m[2].split(',').map((v) => v.trim())
  return { cols, vals, placeholders: vals.filter((v) => v === '?').length }
}

describe('pullClientes', () => {
  beforeEach(() => {
    runs.length = 0
  })

  it('inserts each client with matching columns, values and params', async () => {
    const { pullClientes } = await import('./clientes')
    await pullClientes()

    const insert = runs.find((r) => /INSERT INTO clifor/.test(r.sql))
    expect(insert).toBeDefined()
    const { cols, vals, placeholders } = insertShape(insert!.sql)
    expect(vals.length).toBe(cols.length)
    expect(insert!.params.length).toBe(placeholders)
    expect(vals[cols.indexOf('enviado')]).toBe("'S'")
    expect(insert!.params[cols.indexOf('codigo') - 1]).toBe('1001')
    expect(insert!.params[cols.indexOf('regiao') - 1]).toBe('01')

    const cond = runs.find((r) => /INSERT INTO condicao_cliente/.test(r.sql))
    expect(cond?.params).toEqual(['5', '1001'])
  })
})
