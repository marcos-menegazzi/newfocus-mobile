import { query, run } from '../../db/connection'
import { round, getfator } from './calc'
import { calcPreco, type TabelaFlex } from './preco'

export interface ItemArgs {
  numpedido: string | number
  codproduto: string
  quantidade: number
  venda: number
  maximo: number
  minimo: number
  descinc: number
  desconto: number
  descper: string
  operacao: string
  condicao: string | number
  comissao: string | number
  tabela: string | number
  unidade: string
  fatores: [string, string, number][]
  tabelas: TabelaFlex[]
  estoque: number
  cEstoque: string
  libmin: boolean
}

export interface ListarItensResult {
  rows: any[]
  pesopedido: number
  flex: number
  total: number
}

function validar(
  args: ItemArgs,
  unitario: number,
  total: number,
  fator: number,
  maximo: number,
  minimo: number,
): void {
  if (args.quantidade <= 0) throw new Error('Informe uma quantidade maior que Zero.')
  if (unitario <= 0) throw new Error('Informe um Valor Unitário maior que Zero.')
  if (unitario > maximo) throw new Error('O Valor Unitário não pode ser maior que o Valor Máximo do Produto.')
  if (unitario < minimo) {
    if (!args.libmin) throw new Error('O Valor Unitário não pode ser menor que o Valor Mínimo do Produto.')
    console.warn('Produto está sendo vendido abaixo do Valor Mínimo')
  }
  if (total <= 0) throw new Error('O Valor Total deve ser maior que Zero.')
  if (args.cEstoque === 'S' && args.estoque < args.quantidade * fator) {
    throw new Error('Quantidade de Estoque Indisponível')
  }
}

async function itemExists(numpedido: string | number, codproduto: string, tabela: string | number): Promise<boolean> {
  const rows = await query<{ idpedido: number }>(
    'SELECT idpedido FROM mped WHERE numpedido = ? AND codproduto = ? AND tabela = ? LIMIT 1',
    [numpedido, codproduto, tabela],
  )
  return rows.length > 0
}

export async function listarItens(numpedido: string | number): Promise<ListarItensResult> {
  const rows = await query<any>(
    `SELECT m.*, p.descricao, p.peso, c.descr AS dcond
     FROM mped m, produtos p, condicao c
     WHERE m.numpedido = ? AND m.codproduto = p.codigo AND m.condicao = c.codigo
     GROUP BY m.idpedido`,
    [numpedido],
  )
  let pesopedido = 0
  let flex = 0
  let total = 0
  for (const row of rows) {
    pesopedido += row.qtd * row.peso
    flex += row.flex
    total += row.vltotal
  }
  return { rows, pesopedido, flex, total }
}

export async function incluirItem(args: ItemArgs): Promise<void> {
  const fator = getfator(args.fatores, args.codproduto, args.unidade)
  const preco = calcPreco({
    venda: args.venda, maximo: args.maximo, minimo: args.minimo,
    descinc: 0, quantidade: args.quantidade, fator,
    desconto: 0, descper: 'N', tabela: args.tabela, tabelas: args.tabelas,
  })
  const unitario = preco.vlunit
  const vlunbase = preco.vlunbase
  const total = preco.total
  const flex = preco.flex
  validar(args, unitario, total, fator, round(args.maximo * fator, 2), round(args.minimo * fator, 2))

  if (await itemExists(args.numpedido, args.codproduto, args.tabela)) {
    await run(
      'UPDATE mped SET qtd=?, vlunit=?, vltotal=?, vlunbase=?, vlbruto=?, operacao=?, condicao=?, descper=?, comissao=?, fator=?, unidade=?, flex=? WHERE numpedido=? AND codproduto=? AND tabela=?',
      [args.quantidade, unitario, total, vlunbase, unitario, args.operacao, args.condicao, 'N', args.comissao, fator, args.unidade, flex, args.numpedido, args.codproduto, args.tabela],
    )
  } else {
    await run(
      'INSERT INTO mped(numpedido, codproduto, qtd, vlunit, descto, vltotal, descinc, vlunbase, vlbruto, operacao, condicao, descper, comissao, tabela, fator, unidade, flex) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [args.numpedido, args.codproduto, args.quantidade, unitario, 0, total, 0, vlunbase, unitario, args.operacao, args.condicao, 'N', args.comissao, args.tabela, fator, args.unidade, flex],
    )
  }
}

export async function gravarItem(args: ItemArgs): Promise<void> {
  const fator = getfator(args.fatores, args.codproduto, args.unidade)
  const preco = calcPreco({
    venda: args.venda, maximo: args.maximo, minimo: args.minimo,
    descinc: args.descinc, quantidade: args.quantidade, fator,
    desconto: args.desconto, descper: args.descper as 'S' | 'N',
    tabela: args.tabela, tabelas: args.tabelas,
  })
  const unitario = preco.vlunit
  const vlunbase = preco.vlunbase
  const total = preco.total
  const flex = preco.flex
  validar(args, unitario, total, fator, round(args.maximo * fator, 2), round(args.minimo * fator, 2))

  if (await itemExists(args.numpedido, args.codproduto, args.tabela)) {
    await run(
      'UPDATE mped SET qtd=?, vlunit=?, descto=?, vltotal=?, descinc=?, vlunbase=?, vlbruto=?, operacao=?, condicao=?, descper=?, comissao=?, fator=?, unidade=?, flex=? WHERE codproduto=? AND numpedido=? AND tabela=?',
      [args.quantidade, unitario, args.desconto, total, args.descinc, vlunbase, unitario, args.operacao, args.condicao, args.descper, args.comissao, fator, args.unidade, flex, args.codproduto, args.numpedido, args.tabela],
    )
  } else {
    await run(
      'INSERT INTO mped(numpedido, codproduto, qtd, vlunit, descto, vltotal, descinc, vlunbase, vlbruto, operacao, condicao, descper, comissao, tabela, fator, unidade, flex) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [args.numpedido, args.codproduto, args.quantidade, unitario, args.desconto, total, args.descinc, vlunbase, unitario, args.operacao, args.condicao, args.descper, args.comissao, args.tabela, fator, args.unidade, flex],
    )
  }
}

export async function excluirItem(numpedido: string | number, codproduto: string, tabela: string | number): Promise<void> {
  await run('DELETE FROM mped WHERE numpedido=? AND codproduto=? AND tabela=?', [numpedido, codproduto, tabela])
}
