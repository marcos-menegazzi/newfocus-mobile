import { query } from '../../db/connection'
import { isoDate } from '../../lib/periodo'

// Regras que o cliente escolhido impõe ao pedido.

export interface CreditoCliente {
  limcred: number | string | null
  /** Crédito já utilizado. */
  credito: number | string | null
}

export function creditoDisponivel(c: CreditoCliente): number {
  return (Number(c.limcred) || 0) - (Number(c.credito) || 0)
}

export interface RegraCredito {
  limcred?: string
  libera?: string
  tipo: string
  avista: boolean
}

export function ultrapassaCredito(c: CreditoCliente, total: number, regra: RegraCredito): boolean {
  if (regra.limcred !== 'S' || regra.tipo === 'E' || !(Number(c.limcred) > 0)) return false
  if (regra.libera === 'S' && regra.avista) return false
  return Math.round((creditoDisponivel(c) - total) * 100) < 0
}

export interface RegraTitulos {
  bloqueia?: string
  libera?: string
  bloqemp?: string
  dias?: number
}

export type SituacaoTitulos = 'ok' | 'aviso' | 'somente-avista' | 'bloqueado'

function limiteTolerancia(regra: RegraTitulos, hoje: Date): string {
  return isoDate(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (Number(regra.dias) || 0)))
}

/** Título mais antigo fora da tolerância do usuário. */
export async function tituloVencido(
  cliente: number | string,
  empresa: number | string | null | undefined,
  regra: RegraTitulos,
  hoje = new Date(),
): Promise<{ vencimento: string } | null> {
  const porEmpresa = regra.bloqemp === 'S'
  const params: unknown[] = [cliente, limiteTolerancia(regra, hoje)]
  if (porEmpresa) params.push(empresa ?? '')
  const rows = await query<{ vencimento: string }>(
    `SELECT vencimento FROM titulos WHERE clifor = ? AND vencimento <= ?${porEmpresa ? ' AND empresa = ?' : ''} ORDER BY vencimento LIMIT 1`,
    params,
  )
  return rows[0] ?? null
}

export function situacaoTitulos(
  titulo: { vencimento: string } | null,
  regra: RegraTitulos,
  tipo: string,
  hoje = new Date(),
): SituacaoTitulos {
  if (!titulo) return 'ok'
  if (titulo.vencimento.slice(0, 10) >= limiteTolerancia(regra, hoje)) return 'aviso'
  if (regra.bloqueia !== 'S' || tipo === 'E') return 'aviso'
  return regra.libera === 'S' ? 'somente-avista' : 'bloqueado'
}

export async function sucataEmAberto(cliente: number | string, empresa: number | string | null | undefined): Promise<boolean> {
  const rows = await query<{ saldo: number }>(
    'SELECT saldo FROM sucata_cliente WHERE cliente = ? AND empresa = ?',
    [cliente, empresa ?? ''],
  )
  return Number(rows[0]?.saldo ?? 0) < 0
}

export interface OpcoesCliente {
  condicoes: { codigo: number; descr: string; avista: string }[]
  cobrancas: { codigo: string; descr: string }[]
  tabelas: { codigo: number; descricao: string }[]
}

/** Condições, cobranças e tabelas que o cliente pode usar; sem restrição cadastrada, todas. */
export async function opcoesDoCliente(cliente: number | string | null | undefined): Promise<OpcoesCliente> {
  const c = cliente ?? 0
  const [cond, cob, tab] = await Promise.all([
    query<OpcoesCliente['condicoes'][number]>(
      "SELECT DISTINCT d.codigo, d.descr, d.avista FROM condicao_cliente c INNER JOIN condicao d ON d.codigo = c.condicao WHERE c.cliente = ? AND d.inativo = 'N'",
      [c],
    ),
    query<OpcoesCliente['cobrancas'][number]>(
      'SELECT DISTINCT d.codigo, d.descr FROM cobranca_cliente c INNER JOIN cobrancas d ON d.codigo = c.cobranca WHERE c.cliente = ?',
      [c],
    ),
    query<OpcoesCliente['tabelas'][number]>(
      'SELECT DISTINCT t.codigo, t.descricao FROM tabela_cliente c INNER JOIN tpreco t ON t.codigo = c.tabela WHERE c.cliente = ?',
      [c],
    ),
  ])
  return {
    condicoes: cond.length ? cond : await query("SELECT codigo, descr, avista FROM condicao WHERE inativo = 'N'"),
    cobrancas: cob.length ? cob : await query('SELECT codigo, descr FROM cobrancas'),
    tabelas: tab.length ? tab : await query("SELECT codigo, descricao FROM tpreco WHERE usa_cliente = 'N'"),
  }
}

export const msgVencidos = (dias: number | string | undefined) =>
  `Cliente possui títulos vencidos há mais de ${Number(dias) || 0} dias.`

export interface ContextoPedido {
  empresa: number | string | null | undefined
  tipo: string
  condpag: number | string | null | undefined
  tabela: number | string | null | undefined
  usuario: RegraTitulos & { obscli?: string }
  hoje?: Date
}

export interface EscolhaCliente {
  /** Motivo que impede usar o cliente no pedido. */
  bloqueio: string | null
  avisos: string[]
  titulo: { vencimento: string } | null
  opcoes: OpcoesCliente
  cabecalho: {
    clifor: number
    tabela: number | string
    comissao: number | string
    condpag: number | string
    operacao: string
    cobranca: string
    cliente_nome: string
    cliente_cpf: string
  }
}

/** Aplica ao pedido as regras do cliente escolhido. */
export async function escolherCliente(row: any, ctx: ContextoPedido): Promise<EscolhaCliente> {
  const hoje = ctx.hoje ?? new Date()
  const codigo = Number(row.codigo) || 0
  const [opcoes, sucata, titulo, comissao] = await Promise.all([
    opcoesDoCliente(codigo),
    sucataEmAberto(codigo, ctx.empresa),
    tituloVencido(codigo, ctx.empresa, ctx.usuario, hoje),
    query('SELECT 1 FROM comissao WHERE codigo = ? LIMIT 1', [row.comissao]),
  ])
  const situacao = situacaoTitulos(titulo, ctx.usuario, ctx.tipo, hoje)

  let bloqueio: string | null = null
  if (codigo < 1) bloqueio = 'Cliente não sincronizado. Sincronize antes de fazer o pedido.'
  else if (sucata) bloqueio = 'Cliente com retorno de sucata em aberto, pedido bloqueado.'
  else if (situacao === 'bloqueado') bloqueio = msgVencidos(ctx.usuario.dias)

  const avisos: string[] = []
  if (situacao === 'aviso') avisos.push('Cliente possui títulos vencidos.')
  if (situacao === 'somente-avista') avisos.push(`${msgVencidos(ctx.usuario.dias)} Só é permitida condição à vista.`)
  if (ctx.usuario.obscli !== 'S' && row.obs?.trim()) avisos.push(row.obs.trim())

  const igual = (a: unknown) => (x: { codigo: unknown }) => String(x.codigo) === String(a)
  const condicao = opcoes.condicoes.find(igual(ctx.condpag))
  const condpag = condicao && (situacao !== 'somente-avista' || condicao.avista === 'S') ? condicao.codigo : ''
  // Cliente sem tabela padrão vem com 'ST': segue a tabela atual, se ele puder usá-la.
  const semTabela = !row.tabela || row.tabela === 'ST'
  const tabela = opcoes.tabelas.find(igual(semTabela ? ctx.tabela : row.tabela))?.codigo ?? ''

  return {
    bloqueio, avisos, titulo, opcoes,
    cabecalho: {
      clifor: codigo, tabela, condpag,
      comissao: comissao.length ? row.comissao : '',
      operacao: '', cobranca: '',
      cliente_nome: row.fantasia ?? '', cliente_cpf: row.cnpj ?? '',
    },
  }
}
