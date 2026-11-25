import { query } from '../db/connection'

export interface Indicadores {
  vendasTotal: number
  vendasQtd: number
  clientesPositivados: number
  totalClientes: number
  produtosPositivados: number
  totalProdutos: number
}

const FATURADO = `FROM histvenda h INNER JOIN histitens i ON h.lancto = i.lancto`
const NO_PERIODO = `WHERE h.data BETWEEN ? AND ? AND i.faturamento = 'S'`

/** Números da visão geral no período. */
export async function indicadores(periodo: [string, string]): Promise<Indicadores> {
  const um = async <T>(sql: string, params: unknown[] = []) => (await query<T>(sql, params))[0]
  const [c, cp, v, p, pp] = await Promise.all([
    um<{ total: number }>('SELECT COUNT(*) AS total FROM clifor'),
    um<{ total: number }>(`SELECT COUNT(DISTINCT h.clifor) AS total ${FATURADO} ${NO_PERIODO}`, periodo),
    um<{ total: number | null; quantidade: number }>(
      `SELECT SUM(x.total) AS total, COUNT(*) AS quantidade FROM (SELECT h.pedido, SUM(i.vltotal) AS total ${FATURADO} ${NO_PERIODO} GROUP BY h.pedido, h.total) x`,
      periodo,
    ),
    um<{ total: number }>('SELECT COUNT(DISTINCT codigo) AS total FROM produtos'),
    um<{ total: number }>(`SELECT COUNT(DISTINCT i.produto) AS total ${FATURADO} INNER JOIN produtos p ON p.codigo = i.produto ${NO_PERIODO}`, periodo),
  ])
  return {
    vendasTotal: v?.total ?? 0,
    vendasQtd: v?.quantidade ?? 0,
    clientesPositivados: cp?.total ?? 0,
    totalClientes: c?.total ?? 0,
    produtosPositivados: pp?.total ?? 0,
    totalProdutos: p?.total ?? 0,
  }
}
