import { query, run } from '../../db/connection'
import { salvarCabecalho } from './pedido'

export interface FinalizarOpts {
  cEstoque: string
  empresa: string | number
  local: string | number
  nfe?: string
}

export async function testarEstoque(
  numpedido: string | number,
  empresa: string | number,
  _local: string | number,
): Promise<void> {
  const itens = await query<any>(
    'SELECT m.codproduto, m.qtd, m.operacao FROM mped m, produtos p WHERE m.numpedido=? AND m.codproduto=p.codigo GROUP BY m.idpedido',
    [numpedido],
  )
  for (const i of itens) {
    const est = await query<any>(
      'SELECT e.* FROM estoque e, operacao o WHERE e.codigo=? AND e.empresa=o.empresa AND e.local=o.local AND e.empresa=? AND o.operacao=?',
      [i.codproduto, empresa, i.operacao],
    )
    if (Number(i.qtd) > Number(est[0]?.estoque ?? 0)) {
      throw new Error(`O Produto ${i.codproduto} não possuí estoque suficiente.`)
    }
  }
}

export async function ajustarEstoque(
  produto: string,
  qtd: number,
  tipo: string,
  empresa: string | number,
  local: string | number,
): Promise<void> {
  const op = tipo === 'S' ? '-' : '+'
  await run(
    `UPDATE estoque SET estoque = estoque ${op} ? WHERE codigo=? AND empresa=? AND local=?`,
    [qtd, produto, empresa, local],
  )
}

async function salvarCabecalhoFinal(numpedido: string | number): Promise<void> {
  const rows = await query<any>('SELECT * FROM ped WHERE numpedido = ?', [numpedido])
  if (!rows[0]) throw new Error('Pedido não encontrado')
  await salvarCabecalho({ ...rows[0], numpedido: String(rows[0].numpedido), status: 'F' })
}

export async function gravarEstoque(
  numpedido: string | number,
  empresa: string | number,
  local: string | number,
  _nfe?: string,
): Promise<void> {
  const itens = await query<{ codproduto: string; qtd: number }>(
    'SELECT codproduto, SUM(qtd) AS qtd FROM mped WHERE numpedido=? GROUP BY codproduto',
    [numpedido],
  )
  for (const i of itens) {
    await ajustarEstoque(i.codproduto, Number(i.qtd), 'S', empresa, local)
  }
  await salvarCabecalhoFinal(numpedido)
}

export async function finalizar(numpedido: string | number, opts: FinalizarOpts): Promise<void> {
  if (opts.cEstoque === 'S') {
    await testarEstoque(numpedido, opts.empresa, opts.local)
    await gravarEstoque(numpedido, opts.empresa, opts.local, opts.nfe)
  } else {
    await salvarCabecalhoFinal(numpedido)
  }
}
