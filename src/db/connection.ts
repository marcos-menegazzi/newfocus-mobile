import { Capacitor } from '@capacitor/core'
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite'
import { DB_NAME, SCHEMA_SQL, TABLES } from './schema'
import { VERSAO_COMPILACAO } from '../lib/appInfo'
import { importLegacyDatabase, legacyDatabasePendente } from './legacy'
import { parseTable, upgradeSchema } from './upgrade'

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

let initPromise: Promise<void> | null = null

export function initDb(): Promise<void> {
  // Uma única inicialização mesmo com chamadas concorrentes (evita importar/abrir duas vezes).
  if (!initPromise) {
    initPromise = doInitDb().catch((e) => {
      initPromise = null
      throw e
    })
  }
  return initPromise
}

async function abrir(conn: SQLiteConnection): Promise<SQLiteDBConnection> {
  const consistent = await conn.checkConnectionsConsistency()
  const exists = (await conn.isConnection(DB_NAME, false)).result

  const d = consistent.result && exists
    ? await conn.retrieveConnection(DB_NAME, false)
    : await conn.createConnection(DB_NAME, false, 'no-encryption', 1, false)
  await d.open()
  await d.execute(SCHEMA_SQL)
  await upgradeSchema(
    async <T>(sql: string) => ((await d.query(sql)).values ?? []) as T[],
    async (sql: string) => {
      await d.execute(sql)
    },
  )
  return d
}

/** Sem usuário, pedido nem cliente: banco recém-criado, nada a perder. */
async function bancoVazio(d: SQLiteDBConnection): Promise<boolean> {
  for (const tabela of ['usuario', 'ped', 'clifor']) {
    const r = await d.query(`SELECT 1 FROM ${tabela} LIMIT 1`)
    if ((r.values ?? []).length > 0) return false
  }
  return true
}

async function doInitDb(): Promise<void> {
  const conn = await connection()
  // Instalado por cima do app Cordova antigo: traz o banco dele antes da primeira conexão.
  const imported = await importLegacyDatabase()

  let d = await abrir(conn)
  // Uma importação anterior falhou e o app seguiu com um banco vazio: sem isso os pedidos
  // do app antigo nunca mais seriam trazidos. Tenta de novo, substituindo o banco vazio.
  if (!imported && (await legacyDatabasePendente()) && (await bancoVazio(d))) {
    await conn.closeConnection(DB_NAME, false)
    await importLegacyDatabase({ substituir: true })
    d = await abrir(conn)
  }
  // A versão gravada é a enviada na validação da sincronização: passa a ser a desta
  // compilação também para quem já estava logado (no app antigo ou numa versão anterior).
  await d.run('UPDATE usuario SET versao = ?', [VERSAO_COMPILACAO])
  db = d
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

export interface Comando {
  statement: string
  values: unknown[]
}

// Limita o JSON que atravessa a bridge numa só chamada.
const LOTE_MAX = 2000

/**
 * Executa vários comandos numa única chamada nativa e numa única transação por lote.
 * Um `run()` por linha custa uma ida à bridge e um BEGIN/COMMIT (fsync) cada, o que
 * deixa a carga de milhares de registros na sincronização muito lenta.
 */
export async function runBatch(comandos: Comando[]): Promise<void> {
  if (comandos.length === 0) return
  const d = await getDb()
  for (let i = 0; i < comandos.length; i += LOTE_MAX) {
    const lote = comandos.slice(i, i + LOTE_MAX).map((c) => ({
      statement: c.statement,
      values: c.values.map((v) => (v === undefined ? null : v)),
    }))
    await d.executeSet(lote, true)
  }
}

export async function query<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  const d = await getDb()
  const r = await d.query(sql, values)
  return (r.values ?? []) as T[]
}

export async function saveWebDb(): Promise<void> {
  if (Capacitor.getPlatform() === 'web') {
    const conn = await connection()
    await conn.saveToStore(DB_NAME)
  }
}

export async function execute(sql: string): Promise<void> {
  const d = await getDb()
  await d.execute(sql)
}

/** Apaga todas as tabelas e recria o schema vazio. */
export async function resetDb(): Promise<void> {
  await execute(TABLES.map((sql) => `DROP TABLE IF EXISTS ${parseTable(sql).name}`).join(';\n'))
  await execute(SCHEMA_SQL)
  await saveWebDb()
}
