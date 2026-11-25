// Banco em memória com o schema real. Nos testes:
//   vi.mock('<...>/db/connection', () => import('<...>/test/sqlite'))
import initSqlJs, { type Database, type SqlValue } from 'sql.js'
import { SCHEMA_SQL } from '../db/schema'

let db: Database

export async function abrirBanco(): Promise<void> {
  const SQL = await initSqlJs()
  db = new SQL.Database()
  db.exec(SCHEMA_SQL)
}

const bind = (values: unknown[]) => values.map((v) => (v === undefined ? null : v)) as SqlValue[]

export async function query<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  const st = db.prepare(sql)
  try {
    st.bind(bind(values))
    const rows: T[] = []
    while (st.step()) rows.push(st.getAsObject() as T)
    return rows
  } finally {
    st.free()
  }
}

export async function run(sql: string, values: unknown[] = []): Promise<{ changes: number }> {
  db.run(sql, bind(values))
  return { changes: db.getRowsModified() }
}

export async function execute(sql: string): Promise<void> {
  db.exec(sql)
}

export async function saveWebDb(): Promise<void> {}

/** Insere uma linha informando só as colunas que interessam ao teste. */
export async function inserir(tabela: string, linha: Record<string, unknown>): Promise<void> {
  const cols = Object.keys(linha)
  await run(`INSERT INTO ${tabela}(${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, Object.values(linha))
}
