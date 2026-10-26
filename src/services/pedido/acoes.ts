// Regras de quando cada ação do pedido faz sentido. Cada função devolve o motivo
// do bloqueio (mostrado ao vendedor) ou null quando a ação está disponível.
// NF-e, boleto e termo dependem do lançamento que o servidor devolve na sincronização.

export interface PedidoSituacao {
  status: string
  itens: number
  tipo?: string | null
  lancto?: number | string | null
  sefaz?: string | null
  file?: string | null
}

const ENVIADO = ['S', 'Z']

function comItens(p: PedidoSituacao): string | null {
  if (p.status === 'C') return 'Pedido cancelado.'
  if (p.itens === 0) return 'Pedido sem itens.'
  return null
}

function integrado(p: PedidoSituacao): string | null {
  const m = comItens(p)
  if (m) return m
  if (Number(p.lancto) > 0) return null
  if (p.status === 'A') return 'Finalize e sincronize o pedido primeiro.'
  if (p.status === 'F') return 'Sincronize o pedido primeiro.'
  if (p.status === 'V') return 'Aguardando confirmação do servidor.'
  return 'Pedido ainda não integrado.'
}

export function danfeEmitida(p: PedidoSituacao): boolean {
  return p.sefaz === '100' && !!p.file && ENVIADO.includes(p.status)
}

export function motivoNfe(p: PedidoSituacao): string | null {
  return integrado(p) ?? (ENVIADO.includes(p.status) ? null : 'Aguardando confirmação do servidor.')
}

/** Boleto e termo de responsabilidade. */
export const motivoBoleto = integrado

export function motivoImprimir(p: PedidoSituacao): string | null {
  return comItens(p)
}

export function motivoFinalizar(p: PedidoSituacao): string | null {
  if (p.status !== 'A') return 'Pedido não está aberto.'
  if (p.itens === 0) return 'Adicione itens para finalizar.'
  return null
}

export function motivoReabrir(p: PedidoSituacao): string | null {
  if (p.status === 'F') return null
  if (p.status === 'A') return 'O pedido já está aberto.'
  return 'Só pedidos finalizados podem ser reabertos.'
}

export function motivoTransformar(p: PedidoSituacao): string | null {
  if (p.tipo !== 'O') return 'Disponível apenas para orçamentos.'
  if (p.status === 'C') return 'Pedido cancelado.'
  if (p.status !== 'A' && p.status !== 'F') return 'Orçamento já enviado.'
  return null
}

export function motivoDuplicar(p: PedidoSituacao): string | null {
  return p.itens === 0 ? 'Pedido sem itens.' : null
}

export function motivoCancelar(p: PedidoSituacao): string | null {
  switch (p.status) {
    case 'C': return 'Pedido já cancelado.'
    case 'S': return 'Pedido sincronizado não pode ser cancelado.'
    case 'Z': return 'Pedido faturado não pode ser cancelado.'
    case 'V': return 'Aguardando confirmação do servidor.'
    default: return null
  }
}
