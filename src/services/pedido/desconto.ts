import { query, run } from '../../db/connection'
import { round } from './calc'

export interface DescontoOpts {
  aplicar: boolean
  valor: number
  porItem: boolean
}

export interface AcrescimoOpts {
  aplicar: boolean
  vlquilo: number
  vlunidade: number
  snquilo: string
  snunidade: string
}

const DESCONTO_SELECT = `
  SELECT m.*, p.descricao, mt.venda, mt.maximo, mt.minimo
  FROM mped m, produtos p, tpreco t, mvtpreco mt
  WHERE m.numpedido = ? AND m.codproduto = p.codigo
    AND m.codproduto = mt.produto AND m.tabela = mt.tabela_codigo AND m.tabela = t.codigo
  GROUP BY m.idpedido`

const ACRESCIMO_SELECT = `
  SELECT m.*, p.descricao, mt.venda, mt.maximo, mt.minimo, p.peso
  FROM mped m, produtos p, tpreco t, mvtpreco mt
  WHERE m.numpedido = ? AND m.codproduto = p.codigo
    AND m.codproduto = mt.produto AND m.tabela = mt.tabela_codigo AND m.tabela = t.codigo AND m.tabela = ?
  GROUP BY m.idpedido`

export async function aplicarDesconto(numpedido: string | number, opts: DescontoOpts): Promise<void> {
  const { aplicar, valor, porItem } = opts
  const rows = await query<any>(DESCONTO_SELECT, [numpedido])

  const updates: { desconto: number; total: number; descper: string; idpedido: number }[] = []
  for (const row of rows) {
    const quantidade = row.qtd
    const vlbase = row.vlbruto
    let desconto = row.descto
    if (aplicar) {
      desconto = valor
      if (desconto <= 0) throw new Error('Desconto deve ser maior que zero.')
    } else {
      desconto = 0
    }
    const vlrunitario = vlbase
    let total = round(quantidade * vlrunitario, 2)
    let desc: number
    let descper: string
    if (porItem) {
      desc = round(valor / rows.length, 2)
      desconto = desc
      descper = 'N'
    } else {
      desc = round((total * desconto) / 100, 2)
      descper = 'S'
    }
    total = round(total - desc, 2)
    if (round(total / quantidade, 2) < row.minimo) {
      throw new Error(`Produto ${row.codproduto} ficará com Valor abaixo do minimo. Desconto não será aplicado.`)
    }
    updates.push({ desconto, total, descper, idpedido: row.idpedido })
  }

  for (const u of updates) {
    await run(
      'UPDATE mped SET descto = ?, vltotal = ?, descper = ? WHERE numpedido = ? AND idpedido = ?',
      [u.desconto, u.total, u.descper, numpedido, u.idpedido],
    )
  }
}

export async function aplicarAcrescimo(numpedido: string | number, opts: AcrescimoOpts): Promise<void> {
  const { vlquilo, vlunidade, snquilo, snunidade } = opts
  const ped = await query<any>('SELECT tabela FROM ped WHERE numpedido = ?', [numpedido])
  const tabela = ped[0]?.tabela ?? 0
  const rows = await query<any>(ACRESCIMO_SELECT, [numpedido, tabela])

  const updates: { vlnegocia: number; vlrunitario: number; total: number; idpedido: number }[] = []
  for (const row of rows) {
    const quantidade = row.qtd
    const vlbase = row.vlbruto
    const vldesconto = row.descto
    let vlnegocia = 0
    let vlrunitario = row.vlunit
    if (vlquilo > 0) {
      vlnegocia = vlquilo * quantidade * row.peso
      vlrunitario = vlbase + vlquilo * row.peso
    }
    if (vlunidade > 0) {
      vlnegocia = vlunidade * quantidade
      vlrunitario = vlbase + vlunidade
    }
    if (vlquilo <= 0 && vlunidade <= 0) {
      vlrunitario = vlbase
    }
    let total = round(quantidade * vlrunitario, 2)
    const desc = row.descper !== 'S' ? vldesconto : round(quantidade * vlbase * vldesconto / 100, 2)
    total = round(total - desc, 2)
    if (round(total / quantidade, 2) > row.maximo) {
      throw new Error(`Produto ${row.codproduto} ficará com Valor Acima do máximo. Acréscimo não será aplicado.`)
    }
    updates.push({ vlnegocia, vlrunitario, total, idpedido: row.idpedido })
  }

  await run(
    'UPDATE ped SET snunidade = ?, snquilo = ?, valor_quilo = ?, valor_unidade = ? WHERE numpedido = ?',
    [snunidade, snquilo, vlquilo, vlunidade, numpedido],
  )
  for (const u of updates) {
    await run(
      'UPDATE mped SET valor_negocia = ?, vlunit = ?, vltotal = ? WHERE numpedido = ? AND idpedido = ?',
      [u.vlnegocia, u.vlrunitario, u.total, numpedido, u.idpedido],
    )
  }
}
