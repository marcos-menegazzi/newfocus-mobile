import { query, run } from '../../db/connection'
import { round } from './calc'

async function totalFinanceiro(pedido: string | number): Promise<number> {
  const rows = await query<{ total: number }>(
    'SELECT COALESCE(SUM(valor), 0) AS total FROM financeiro WHERE pedido = ?',
    [pedido],
  )
  return Number(rows[0]?.total ?? 0)
}

export async function incluirParcela(
  pedido: string | number,
  cobranca: string,
  condicao: string | number,
  valor: number,
  autorizacao: string,
  totalPedido: number,
): Promise<void> {
  if (!cobranca) throw new Error('Informe uma Cobrança')
  if (!condicao) throw new Error('Informe uma Condição de Pagamento')
  if (valor <= 0) throw new Error('Informe um Valor Maior que Zero')

  const dup = await query<{ idfinanceiro: number }>(
    'SELECT idfinanceiro FROM financeiro WHERE pedido = ? AND cobranca = ? AND condicao = ? LIMIT 1',
    [pedido, cobranca, condicao],
  )
  if (dup.length > 0) throw new Error('Cobrança já incluída para o Pedido')

  const totalFin = await totalFinanceiro(pedido)
  if (round(valor + totalFin, 2) > totalPedido) {
    throw new Error('Valor Informado não pode ser maior que o Valor do Pedido.')
  }

  await run(
    'INSERT INTO financeiro (pedido, cobranca, condicao, valor, autorizacao) VALUES (?,?,?,?,?)',
    [pedido, cobranca, condicao, valor, autorizacao],
  )
}

export async function excluirParcela(idfinanceiro: number): Promise<void> {
  await run('DELETE FROM financeiro WHERE idfinanceiro = ?', [idfinanceiro])
}

export async function listarParcelas(pedido: string | number): Promise<{ rows: any[]; remaining: number }> {
  const rows = await query<any>(
    `SELECT f.valor, f.cobranca, f.condicao, c.descr AS cobdesc, d.descr AS condesc, f.idfinanceiro, f.autorizacao
     FROM financeiro f
     LEFT JOIN cobrancas c ON f.cobranca = c.codigo
     LEFT JOIN condicao d ON f.condicao = d.codigo
     WHERE f.pedido = ?
     ORDER BY f.cobranca, f.condicao`,
    [pedido],
  )
  const totalFin = rows.reduce((acc, r) => acc + Number(r.valor), 0)
  const ped = await query<{ total: number }>('SELECT total FROM ped WHERE numpedido = ?', [pedido])
  const totalPedido = Number(ped[0]?.total ?? 0)
  return { rows, remaining: round(totalPedido - totalFin, 2) }
}

export async function validarFinanceiro(
  pedido: string | number,
  totalPedido: number,
  finped: boolean,
  condicliente: (string | number)[],
  cobcliente: (string | number)[],
): Promise<{ ok: boolean; msg?: string }> {
  const rows = await query<any>('SELECT condicao, cobranca, valor FROM financeiro WHERE pedido = ?', [pedido])
  let totalFin = 0
  for (const p of rows) {
    totalFin += Number(p.valor)
    if (p.condicao != null && p.condicao !== '' && !condicliente.some((c) => String(c) === String(p.condicao))) {
      return { ok: false, msg: 'Condição não Permitida.' }
    }
    if (p.cobranca && !cobcliente.some((c) => String(c) === String(p.cobranca))) {
      return { ok: false, msg: 'Cobrança não Permitida.' }
    }
  }
  if (finped && totalFin <= 0) {
    return { ok: false, msg: 'Obrigatório informar o financeiro do pedido.' }
  }
  if (totalFin <= 0) return { ok: true }
  if (round(totalFin, 2) !== round(totalPedido, 2)) {
    return { ok: false, msg: 'Valor Finaneiro não pode ser diferente do Valor do Pedido.' }
  }
  return { ok: true }
}
