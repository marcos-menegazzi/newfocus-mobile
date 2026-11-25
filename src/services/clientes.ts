import { query } from '../db/connection'

const COLUNAS: Record<string, string> = {
  fantasia: 'c.fantasia',
  razao: 'c.razao',
  codigo: 'c.codigo',
  cnpj: 'c.cnpj',
  cidade: 'c.cidade',
  estado: 'c.estado',
}

export interface ClienteRow {
  clifor: number
  codigo: number
  fantasia: string
  razao: string
  ddd: string | null
  tel1: string | null
  endereco: string | null
  numero: string | null
  cidade: string | null
  estado: string | null
  enviado: string | null
  positivado: number
  /** Quantidade de títulos em aberto. */
  titulos: number
}

export interface FiltroClientes {
  col: string
  termo: string
  positivado: string
  titulos?: boolean
  periodo: [string, string]
}

export async function buscarClientes(f: FiltroClientes): Promise<ClienteRow[]> {
  const params: unknown[] = [...f.periodo]
  let sql = `SELECT c.*,
    (SELECT COUNT(*) FROM histvenda h INNER JOIN histitens i ON h.lancto = i.lancto
      WHERE h.data BETWEEN ? AND ? AND i.faturamento = 'S' AND h.clifor = c.codigo) AS positivado,
    (SELECT COUNT(*) FROM titulos t WHERE t.clifor = c.codigo) AS titulos
    FROM clifor c`
  const termo = f.termo.trim()
  if (termo) {
    sql += ` WHERE ${COLUNAS[f.col]} LIKE ?`
    params.push(`%${termo}%`)
  }
  const cond: string[] = []
  if (f.positivado === 'positivados') cond.push('q.positivado > 0')
  if (f.positivado === 'nao') cond.push('q.positivado = 0')
  if (f.titulos) cond.push('q.titulos > 0')
  if (cond.length) sql = `SELECT * FROM (${sql}) q WHERE ${cond.join(' AND ')}`
  return query<ClienteRow>(sql, params)
}
