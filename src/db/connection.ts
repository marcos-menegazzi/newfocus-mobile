import { Capacitor } from '@capacitor/core'
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite'
import { DB_NAME, SCHEMA_SQL } from './schema'

let sqlite: SQLiteConnection | null = null
let db: SQLiteDBConnection | null = null

async function connection(): Promise<SQLiteConnection> {
  if (!sqlite) {
    sqlite = new SQLiteConnection(CapacitorSQLite)
  }
  if (Capacitor.getPlatform() === 'web') {
    if (!document.querySelector('jeep-sqlite')) {
      document.body.appendChild(document.createElement('jeep-sqlite'))
    }
    await customElements.whenDefined('jeep-sqlite')
    await sqlite.initWebStore()
  }
  return sqlite
}

export async function initDb(): Promise<void> {
  const conn = await connection()
  const consistent = await conn.checkConnectionsConsistency()
  const exists = (await conn.isConnection(DB_NAME, false)).result

  if (consistent.result && exists) {
    db = await conn.retrieveConnection(DB_NAME, false)
  } else {
    db = await conn.createConnection(DB_NAME, false, 'no-encryption', 1, false)
  }
  await db.open()
  await db.execute(SCHEMA_SQL)
}

export async function getDb(): Promise<SQLiteDBConnection> {
  if (!db) await initDb()
  return db as SQLiteDBConnection
}

export async function run(
  sql: string,
  values: unknown[] = [],
): Promise<{ changes: number; lastId?: number }> {
  const d = await getDb()
  const r = await d.run(sql, values)
  const changes = r.changes?.changes ?? 0
  const lastId = r.changes?.lastId
  return { changes, lastId }
}

export async function query<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  const d = await getDb()
  const r = await d.query(sql, values)
  return (r.values ?? []) as T[]
}

export async function execute(sql: string): Promise<void> {
  const d = await getDb()
  await d.execute(sql)
}
