import { query, run } from '../../db/connection'
import { getfator } from './calc'
import { calcPreco, type PrecoResult, type TabelaFlex } from './preco'

export interface ItemArgs {
  numpedido: string | number
  codproduto: string
  quantidade: number
  venda: number
  maximo: number
  minimo: number
  /** Valor unitário digitado, por unidade padrão. */
  unitario?: number
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

export interface ItemGravado {
  /** Vendido abaixo do mínimo por usuário liberado: a tela deve avisar. */
  abaixoMinimo: boolean
}

function validar(args: ItemArgs, preco: PrecoResult, fator: number): void {
  if (args.quantidade <= 0) throw new Error('Informe uma quantidade maior que Zero.')
  if (preco.vlunit <= 0) throw new Error('Informe um Valor Unitário maior que Zero.')
  if (preco.acimaMaximo) throw new Error('O Valor Unitário não pode ser maior que o Valor Máximo do Produto.')
  if (preco.total <= 0) throw new Error('O Valor Total deve ser maior que Zero.')
  if (preco.abaixoMinimo && !args.libmin) {
    throw new Error('O Valor Unitário não pode ser menor que o Valor Mínimo do Produto.')
  }
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

/** Inclusão rápida: preço de tabela, sem descontos. */
export function incluirItem(args: ItemArgs): Promise<ItemGravado> {
  return gravarItem({ ...args, unitario: undefined, descinc: 0, desconto: 0, descper: 'N' })
}

export async function gravarItem(args: ItemArgs): Promise<ItemGravado> {
  const fator = getfator(args.fatores, args.codproduto, args.unidade)
  const preco = calcPreco({
    venda: args.venda, maximo: args.maximo, minimo: args.minimo, unitario: args.unitario,
    descinc: args.descinc, quantidade: args.quantidade, fator,
    desconto: args.desconto, descper: args.descper as 'S' | 'N',
    tabela: args.tabela, tabelas: args.tabelas,
  })
  validar(args, preco, fator)
  const { vlunit, vlunbase, total, flex } = preco

  if (await itemExists(args.numpedido, args.codproduto, args.tabela)) {
    await run(
      'UPDATE mped SET qtd=?, vlunit=?, descto=?, vltotal=?, descinc=?, vlunbase=?, vlbruto=?, operacao=?, condicao=?, descper=?, comissao=?, fator=?, unidade=?, flex=? WHERE codproduto=? AND numpedido=? AND tabela=?',
      [args.quantidade, vlunit, args.desconto, total, args.descinc, vlunbase, vlunit, args.operacao, args.condicao, args.descper, args.comissao, fator, args.unidade, flex, args.codproduto, args.numpedido, args.tabela],
    )
  } else {
    await run(
      'INSERT INTO mped(numpedido, codproduto, qtd, vlunit, descto, vltotal, descinc, vlunbase, vlbruto, operacao, condicao, descper, comissao, tabela, fator, unidade, flex) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [args.numpedido, args.codproduto, args.quantidade, vlunit, args.desconto, total, args.descinc, vlunbase, vlunit, args.operacao, args.condicao, args.descper, args.comissao, args.tabela, fator, args.unidade, flex],
    )
  }
  return { abaixoMinimo: preco.abaixoMinimo }
}

export async function excluirItem(numpedido: string | number, codproduto: string, tabela: string | number): Promise<void> {
  await run('DELETE FROM mped WHERE numpedido=? AND codproduto=? AND tabela=?', [numpedido, codproduto, tabela])
}

export interface HistoricoProduto {
  pedido: number
  data: string
  quant: number
  vlunit: number
  condicao: string
  tabela: string
}

/** Vendas anteriores do produto, de todos os clientes ou só do informado. */
export async function historicoProduto(codproduto: string, cliente?: number | string): Promise<HistoricoProduto[]> {
  const params: unknown[] = [codproduto]
  if (cliente) params.push(cliente)
  return query<HistoricoProduto>(
    `SELECT p.pedido, p.data, i.quant, SUM(i.vlunit) AS vlunit,
            CASE WHEN p.condicao = 'S/C' THEN '' ELSE p.condicao END AS condicao, i.tabela
     FROM histvenda p, histitens i
     WHERE p.lancto = i.lancto AND p.pedido = i.pedido AND i.produto = ?${cliente ? ' AND p.clifor = ?' : ''}
     GROUP BY p.pedido ORDER BY p.data DESC, p.pedido DESC`,
    params,
  )
}
