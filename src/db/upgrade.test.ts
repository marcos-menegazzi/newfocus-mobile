import { describe, it, expect, beforeAll } from 'vitest'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { parseTable, missingColumnStatements, upgradeSchema } from './upgrade'
import { TABLES, SCHEMA_SQL } from './schema'

let SQL: SqlJsStatic

beforeAll(async () => {
  SQL = await initSqlJs()
})

describe('parseTable', () => {
  it('extracts table name and column definitions, keeping commas inside types', () => {
    const t = parseTable(
      'CREATE TABLE IF NOT EXISTS ped (idpedido INTEGER NOT NULL PRIMARY KEY, valor_frete DOUBLE(14,2) DEFAULT 0, obs BLOB)',
    )
    expect(t.name).toBe('ped')
    expect(t.columns).toEqual([
      { name: 'idpedido', def: 'idpedido INTEGER NOT NULL PRIMARY KEY' },
      { name: 'valor_frete', def: 'valor_frete DOUBLE(14,2) DEFAULT 0' },
      { name: 'obs', def: 'obs BLOB' },
    ])
  })

  it('parses every table of the schema', () => {
    for (const sql of TABLES) {
      const t = parseTable(sql)
      expect(t.name).toMatch(/^\w+$/)
      expect(t.columns.length).toBeGreaterThan(1)
    }
  })
})

describe('missingColumnStatements', () => {
  it('returns ALTER TABLE for columns absent from the existing table (case-insensitive)', () => {
    const sql = 'CREATE TABLE IF NOT EXISTS ped (idpedido INTEGER NOT NULL PRIMARY KEY, total DOUBLE(14,2), valor_frete DOUBLE(14,2) DEFAULT 0)'
    expect(missingColumnStatements(sql, ['IDPEDIDO', 'total'])).toEqual([
      'ALTER TABLE ped ADD COLUMN valor_frete DOUBLE(14,2) DEFAULT 0',
    ])
  })

  it('returns nothing when the table does not exist yet', () => {
    expect(missingColumnStatements(TABLES[0], [])).toEqual([])
  })
})

describe('upgradeSchema', () => {
  it('brings a legacy database up to the current schema, preserving rows', async () => {
    const db = new SQL.Database()
    // Shape of an old app version: ped without valor_frete/cliente_nome/cliente_cpf/vendedor,
    // usuario without snos/altcli/obscli/finped, and no regiao/vendedores/sucata_cliente tables.
    db.run(`CREATE TABLE ped (idpedido INTEGER NOT NULL PRIMARY KEY, numpedido CHAR(10), total DOUBLE(14,2), status CHAR(1))`)
    db.run(`INSERT INTO ped (numpedido, total, status) VALUES ('123', 10.5, 'F')`)
    db.run(`CREATE TABLE usuario (iduser INTEGER NOT NULL PRIMARY KEY, codlic DOUBLE(10,0), usuario CHAR(10), versao CHAR(8))`)
    db.run(`INSERT INTO usuario (codlic, usuario, versao) VALUES (7, 'JOAO', '141025')`)

    const q = async <T,>(sql: string): Promise<T[]> => {
      const res = db.exec(sql)
      if (!res.length) return []
      const { columns, values } = res[0]
      return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]]))) as T[]
    }
    const exec = async (sql: string) => {
      db.run(sql)
    }

    // Same order as initDb: create missing tables, then add missing columns.
    db.exec(SCHEMA_SQL)
    const added = await upgradeSchema(q, exec)
    expect(added).toContain('ALTER TABLE ped ADD COLUMN valor_frete DOUBLE(14,2) DEFAULT 0')

    for (const sql of TABLES) {
      const t = parseTable(sql)
      const cols = (await q<{ name: string }>(`PRAGMA table_info(${t.name})`)).map((c) => c.name)
      expect(cols.sort()).toEqual(t.columns.map((c) => c.name).sort())
    }

    const [ped] = await q<{ numpedido: string; total: number; valor_frete: number }>('SELECT * FROM ped')
    expect(ped).toMatchObject({ numpedido: '123', total: 10.5, valor_frete: 0 })
    const [u] = await q<{ usuario: string }>('SELECT * FROM usuario')
    expect(u.usuario).toBe('JOAO')

    // Idempotent: nothing left to add on a second run.
    expect(await upgradeSchema(q, exec)).toEqual([])
  })
})
