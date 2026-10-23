import { query, run } from '../../db/connection'
import { gerarIdUnico, pad } from './calc'

export interface CabecalhoInput {
  numpedido: string
  operacao: string
  clifor: number | string
  empresa: number | string
  condpag: number | string
  data: string
  status: string
  obsped: string
  tabela: number | string
  carga: number | string
  tipo: string
  comissao: number | string
  complemento: string
  numero: string
  cliente_nome: string
  cliente_cpf: string
  vendedor: number | string
  valor_frete: number | string
  resolvido: string
  retsuc: number | string
  peso_total: number | string
}

export async function novoNumeroPedido(): Promise<number> {
  const rows = await query<{ numped: number }>('SELECT * FROM numped')
  const num = (rows[0]?.numped ?? 0) + 1
  if (num === 1) {
    await run('INSERT INTO numped(numped) VALUES (?)', [num])
  } else {
    await run('UPDATE numped SET numped = ?', [num])
  }
  return num
}

async function totalPedido(numpedido: string): Promise<number> {
  const rows = await query<{ total: number }>(
    'SELECT COALESCE(SUM(vltotal), 0) AS total FROM mped WHERE numpedido = ?',
    [numpedido],
  )
  return Number(rows[0]?.total ?? 0)
}

async function pesoTotalPedido(numpedido: string): Promise<number> {
  const rows = await query<{ peso: number }>(
    'SELECT COALESCE(SUM(m.qtd * p.peso), 0) AS peso FROM mped m LEFT JOIN produtos p ON p.codigo = m.codproduto WHERE m.numpedido = ?',
    [numpedido],
  )
  return Number(rows[0]?.peso ?? 0)
}

export function assertEditable(status: string): void {
  if (status === 'S' || status === 'Z' || status === 'V') {
    throw new Error('Pedido não pode ser alterado neste status.')
  }
}

export async function salvarCabecalho(args: CabecalhoInput): Promise<string> {
  const obsped = String(args.obsped ?? '').replace(/["']/g, '')
  const complemento = String(args.complemento ?? '').replace(/["']/g, '')
  const valorFrete = Number(args.valor_frete) || 0
  const total = await totalPedido(args.numpedido)

  if (valorFrete < 0 || valorFrete > 999999999999.99) throw new Error('valor_frete inválido')
  if (valorFrete > total) throw new Error('valor_frete maior que o total do pedido')

  if (!args.numpedido) {
    const numpedido = pad(await novoNumeroPedido(), 10)
    await run(
      `INSERT INTO ped(operacao, numpedido, clifor, empresa, condpag, total, data, status, obsped, tabela, carga, tipo, comissao, complemento, idunico, numero, peso_total, retsuc, resolvido, cliente_nome, cliente_cpf, vendedor, valor_frete)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [args.operacao, numpedido, args.clifor, args.empresa, args.condpag, total, args.data,
        args.status, obsped, args.tabela, args.carga, args.tipo, args.comissao, complemento,
        gerarIdUnico(), args.numero, 0, args.retsuc, args.resolvido,
        args.cliente_nome, args.cliente_cpf, args.vendedor, valorFrete],
    )
    return numpedido
  } else {
    const atual = await query<{ status: string }>('SELECT status FROM ped WHERE numpedido = ?', [args.numpedido])
    assertEditable(atual[0]?.status ?? '')
    const pesoTotal = await pesoTotalPedido(args.numpedido)
    await run(
      `UPDATE ped SET operacao=?, clifor=?, empresa=?, condpag=?, total=?, data=?, status=?, obsped=?, tabela=?, carga=?, tipo=?, comissao=?, complemento=?, numero=?, peso_total=?, retsuc=?, resolvido=?, cliente_nome=?, cliente_cpf=?, vendedor=?, valor_frete = CASE WHEN status = 'A' THEN ? ELSE valor_frete END WHERE numpedido = ?`,
      [args.operacao, args.clifor, args.empresa, args.condpag, total, args.data, args.status,
        obsped, args.tabela, args.carga, args.tipo, args.comissao, complemento, args.numero,
        pesoTotal, args.retsuc, args.resolvido, args.cliente_nome, args.cliente_cpf,
        args.vendedor, valorFrete, args.numpedido],
    )
    return pad(Number(args.numpedido), 10)
  }
}

export async function carregarPedido(numpedido: string): Promise<any | null> {
  const rows = await query<any>(
    'SELECT p.*, c.inativo FROM ped p, condicao c WHERE p.condpag = c.codigo AND p.numpedido = ?',
    [numpedido],
  )
  return rows[0] ?? null
}

export async function novopedidoPrefill(): Promise<any> {
  const rows = await query<any>(
    `SELECT p.*, c.descricao AS cargadesc, o.cobranca, o.estoque, o.local
     FROM ped p, carga c, operacao o
     WHERE p.status <> 'C' AND p.carga = c.codigo AND p.operacao = o.operacao AND c.inativo = 'N'
     ORDER BY p.numpedido DESC LIMIT 1`,
  )
  return rows[0] ?? {}
}

export async function duplicarPedido(origem: string): Promise<string> {
  const ped = await query<any>('SELECT * FROM ped WHERE numpedido = ?', [origem])
  if (ped.length === 0) throw new Error('pedido não encontrado')
  const p = ped[0]
  const numpedido = pad(await novoNumeroPedido(), 10)
  await run(
    `INSERT INTO ped(operacao, numpedido, clifor, empresa, condpag, total, data, status, obsped, tabela, carga, tipo, comissao, complemento, idunico, numero, peso_total, retsuc, resolvido, cliente_nome, cliente_cpf)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.operacao, numpedido, p.clifor, p.empresa, p.condpag, p.total, p.data, 'A', p.obsped,
      p.tabela, p.carga, p.tipo, p.comissao, p.complemento, p.idunico, p.numero, p.peso_total,
      p.retsuc, p.resolvido, p.cliente_nome, p.cliente_cpf],
  )
  const itens = await query<any>('SELECT * FROM mped WHERE numpedido = ?', [origem])
  for (const i of itens) {
    await run(
      `INSERT INTO mped(numpedido, codproduto, qtd, vlunit, descto, vltotal, descinc, vlunbase, vlbruto, operacao, condicao, descper, comissao, tabela, fator, unidade, flex)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numpedido, i.codproduto, i.qtd, i.vlunit, i.descto, i.vltotal, i.descinc,
        i.vlunbase, i.vlbruto, i.operacao, i.condicao, i.descper, i.comissao, i.tabela,
        i.fator, i.unidade, i.flex],
    )
  }
  return numpedido
}

export async function cancelarPedido(
  numpedido: string,
  opts: { cEstoque: string; empresa: number | string; local: number | string },
): Promise<void> {
  const ped = await query<any>('SELECT status FROM ped WHERE numpedido = ?', [numpedido])
  if (ped[0]?.status === 'F' && opts.cEstoque === 'S') {
    const itens = await query<any>('SELECT codproduto, qtd FROM mped WHERE numpedido = ?', [numpedido])
    for (const i of itens) {
      await run('UPDATE estoque SET estoque = estoque + ? WHERE codigo = ? AND empresa = ? AND local = ?', [
        i.qtd, i.codproduto, opts.empresa, opts.local,
      ])
    }
  }
  await run("UPDATE ped SET status = 'C' WHERE numpedido = ?", [numpedido])
}

export async function reabrirPedido(numpedido: string): Promise<void> {
  await run("UPDATE ped SET status = 'A' WHERE numpedido = ?", [numpedido])
}

export async function orcamentoToPedido(numpedido: string): Promise<void> {
  await run("UPDATE ped SET status = 'A', tipo = 'S' WHERE numpedido = ?", [numpedido])
}

export async function reenviarPedido(numpedido: string): Promise<void> {
  await run("UPDATE ped SET status = 'F' WHERE numpedido = ?", [numpedido])
}
