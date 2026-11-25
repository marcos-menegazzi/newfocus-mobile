import { query } from '../db/connection'

const COLUNAS: Record<string, string> = { descred: 'descred', descricao: 'descricao', codigo: 'codigo' }

// Buscando por código, a linha continua mostrando a descrição.
const descricaoDe = (col: string) => (col === 'descred' ? 'descred' : 'descricao')

export interface ProdutoRow {
  codigo: string
  estoque: number | null
  descvis: string
  /** Quantidade comprada (a receber). */
  comprado: number
  positivado: number
}

export interface FiltroProdutos {
  col: string
  termo: string
  positivado: string
  empresa: string
  soComEstoque: boolean
  periodo: [string, string]
  limit: number
  offset: number
}

export async function buscarProdutos(f: FiltroProdutos): Promise<ProdutoRow[]> {
  const params: unknown[] = [...f.periodo]
  const estoque = f.soComEstoque ? ' AND e.estoque > 0' : ''
  const centralizado = f.empresa ? '' : " AND e.centralizado <> 'S'"
  let where = ''
  if (f.empresa) {
    where += ' AND e.empresa = ?'
    params.push(f.empresa)
  }
  const termo = f.termo.trim()
  if (termo) {
    where += ` AND p.${COLUNAS[f.col]} LIKE ?`
    params.push(`%${termo}%`)
  }
  const select = `SELECT p.codigo, sum(e.estoque) AS estoque, p.${descricaoDe(f.col)} AS descvis, p.comprado,
    (SELECT COUNT(*) FROM histvenda h INNER JOIN histitens i ON h.lancto = i.lancto INNER JOIN produtos g ON g.codigo = i.produto
      WHERE h.data BETWEEN ? AND ? AND i.faturamento = 'S' AND i.produto = p.codigo) AS positivado
    FROM (SELECT * FROM produtos x GROUP BY x.codigo) p LEFT JOIN estoque e ON p.codigo = e.codigo${estoque}${centralizado}
    WHERE 1=1${where} GROUP BY p.codigo`
  const positivado =
    f.positivado === 'positivados' ? ' WHERE q.positivado > 0' : f.positivado === 'nao' ? ' WHERE q.positivado = 0' : ''
  return query<ProdutoRow>(`SELECT * FROM (${select}) q${positivado} ORDER BY q.descvis LIMIT ? OFFSET ?`, [
    ...params, f.limit, f.offset,
  ])
}

export interface FiltroProdutosPedido {
  col: string
  termo: string
  grupo?: string
  empresa: number | string | null | undefined
  local: number | string | null | undefined
  tabela: number | string
  limit: number
  offset: number
}

/** Produtos da tabela de preço do pedido, com o estoque da empresa e local. */
export async function buscarProdutosPedido(f: FiltroProdutosPedido): Promise<any[]> {
  const params: unknown[] = [f.empresa ?? '', f.local ?? '']
  if (f.grupo) params.push(f.grupo)
  params.push(f.tabela)
  let sql = `SELECT x.*, m.venda, m.maximo, m.minimo, t.codigo AS tabela
    FROM (SELECT p.*, e.estoque, p.${descricaoDe(f.col)} AS descvis
          FROM produtos p LEFT JOIN estoque e ON p.codigo = e.codigo AND e.empresa = ? AND e.local = ?
          ${f.grupo ? 'WHERE p.grupo = ?' : ''}) x,
         tpreco t, mvtpreco m
    WHERE t.codigo = m.tabela_codigo AND m.produto = x.codigo AND m.tabela_codigo = ?`
  const termo = f.termo.trim()
  if (termo) {
    sql += ` AND x.${COLUNAS[f.col]} LIKE ?`
    params.push(`%${termo}%`)
  }
  return query<any>(`${sql} ORDER BY descvis LIMIT ? OFFSET ?`, [...params, f.limit, f.offset])
}
