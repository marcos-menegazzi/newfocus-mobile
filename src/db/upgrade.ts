import { TABLES } from './schema'

export interface ParsedTable {
  name: string
  columns: { name: string; def: string }[]
}

/** Lê um `CREATE TABLE` do schema e devolve o nome da tabela e a definição de cada coluna. */
export function parseTable(createSql: string): ParsedTable {
  const m = /CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)\s*\(/i.exec(createSql)
  if (!m) throw new Error(`CREATE TABLE inválido: ${createSql.slice(0, 60)}`)
  const body = createSql.slice(m.index + m[0].length, createSql.lastIndexOf(')'))

  // Divide nas vírgulas de nível 0 (tipos como DOUBLE(14,2) têm vírgula interna).
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of body) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  parts.push(cur)

  const columns = parts
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((def) => ({ name: def.split(' ')[0], def }))
  return { name: m[1], columns }
}

/**
 * `ALTER TABLE ... ADD COLUMN` para as colunas do schema que a tabela existente não tem.
 * Lista vazia se a tabela ainda não existe (o `CREATE TABLE IF NOT EXISTS` cuida dela).
 */
export function missingColumnStatements(createSql: string, existing: string[]): string[] {
  if (existing.length === 0) return []
  const have = new Set(existing.map((c) => c.toLowerCase()))
  const t = parseTable(createSql)
  return t.columns
    .filter((c) => !have.has(c.name.toLowerCase()) && !/PRIMARY KEY/i.test(c.def))
    .map((c) => `ALTER TABLE ${t.name} ADD COLUMN ${c.def}`)
}

/**
 * Acrescenta às tabelas existentes as colunas que faltam em relação ao schema atual.
 * Necessário para bancos herdados do app Cordova, que podem estar em qualquer versão
 * anterior (o app antigo só aplicava o ALTER da própria versão). Idempotente.
 */
export async function upgradeSchema(
  query: <T>(sql: string) => Promise<T[]>,
  execute: (sql: string) => Promise<void>,
): Promise<string[]> {
  const applied: string[] = []
  for (const sql of TABLES) {
    const { name } = parseTable(sql)
    const cols = await query<{ name: string }>(`PRAGMA table_info(${name})`)
    for (const stmt of missingColumnStatements(sql, cols.map((c) => c.name))) {
      await execute(stmt)
      applied.push(stmt)
    }
  }
  return applied
}
