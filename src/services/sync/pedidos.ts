import { call } from './context'
import { childText, rowChildren, removechar, tag } from './helpers'
import { run, query } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'
import { useToast } from '../../composables/useToast'

export const PED_SQL = `SELECT p.numpedido, p.data, p.total, p.empresa, c.codigo AS cliente,
  p.operacao AS opeped, p.condpag AS condped, p.obsped, p.tabela AS tabped, p.carga, p.tipo,
  p.comissao AS comisped, p.complemento, p.idunico, p.numero AS numnota, p.snunidade,
  p.snquilo, p.valor_quilo, p.valor_unidade, p.valor_frete, p.retsuc, p.resolvido,
  p.cliente_nome, p.cliente_cpf, p.vendedor
  FROM ped p INNER JOIN clifor c ON p.clifor = c.codigo INNER JOIN condicao e ON p.condpag = e.codigo
  WHERE e.inativo = 'N' AND p.status = 'F' ORDER BY p.numpedido LIMIT 3`

// Mesmo formato de colchetes e mesmos tratamentos do sincronizar.html legado.
export function pedidoPayload(p: any, parcelas: any[], itens: any[]): string {
  return '[pedido]' +
    tag('numpedido', p.numpedido) + tag('data', p.data) + tag('total', p.total) +
    tag('empresa', p.empresa) + tag('clifor', p.cliente) + tag('operacao', p.opeped) +
    tag('condicao', p.condped) + tag('obs', removechar(p.obsped)) + tag('tabela', p.tabped) +
    tag('carga', p.carga) + tag('tipo', p.tipo) + tag('comissao', p.comisped) +
    tag('complemento', removechar(p.complemento)) + tag('idunico', p.idunico) + tag('numero', p.numnota) +
    tag('snunidade', p.snunidade) + tag('snquilo', p.snquilo) + tag('valor_quilo', p.valor_quilo) +
    tag('valor_unidade', p.valor_unidade) + tag('valor_frete', p.valor_frete ?? 0) +
    tag('retsuc', p.retsuc) + tag('resolvido', p.resolvido) +
    tag('cliente_nome', removechar(p.cliente_nome)) + tag('cliente_cpf', p.cliente_cpf) +
    tag('vendedor', p.vendedor) +
    '[financeiro]' + parcelas.map((pa) =>
      '[parcela]' + tag('cobranca', pa.cobranca) + tag('condicao', pa.condicao) +
      tag('valor', pa.valor) + tag('autorizacao', pa.autorizacao) + '[/parcela]'
    ).join('') + '[/financeiro]' +
    itens.map((i) =>
      '[produto]' +
      tag('codigo', i.codproduto) + tag('qtd', i.qtd) + tag('vlunit', i.vlunit) +
      tag('descto', i.descto ?? 0) + tag('descinc', i.descinc ?? 0) + tag('vltotal', i.vltotal) +
      tag('operacao', i.operacao) + tag('condicao', i.condicao) + tag('descper', i.descper) +
      tag('comissao', i.comissao) + tag('tabela', i.tabela) + tag('valor_negocia', i.valor_negocia) +
      tag('fator', i.fator) + tag('unidade', i.unidade) + tag('flex', i.flex) +
      '[/produto]'
    ).join('') +
    '[/pedido]'
}

export async function pushPedidos(): Promise<void> {
  const u = useAuthStore().usuario!
  while (true) {
    const peds = await query<any>(PED_SQL)
    if (peds.length === 0) break
    let xml = '[pedidos]'
    for (const p of peds) {
      const itens = await query<any>('SELECT * FROM mped WHERE numpedido = ? ORDER BY codproduto', [p.numpedido])
      const parcelas = await query<any>('SELECT valor, cobranca, condicao, autorizacao FROM financeiro WHERE pedido = ?', [p.numpedido])
      xml += pedidoPayload(p, parcelas, itens)
      await run("UPDATE ped SET status = 'V' WHERE numpedido = ?", [p.numpedido])
    }
    xml += '[/pedidos]'

    const doc = await call(`P_PWEB:EXEC("${xml}","${u.codlic}","${u.usuario}")`)
    const { notify } = useToast()
    for (const r of rowChildren(doc, 'pedidos')) {
      const numped = childText(r, 'numped')
      const msg = childText(r, 'msg')
      if (childText(r, 'status') === 'Ok') {
        await run("UPDATE ped SET lancto = ?, status = 'S' WHERE numpedido = ?", [
          childText(r, 'lancto'), numped,
        ])
        if (msg) notify(`Pedido ${numped}: ${msg}`)
      } else if (numped) {
        notify(`Pedido ${numped} não foi aceito: ${msg || 'sem detalhes do servidor'}`, 'error')
      }
    }
  }
}

export async function pullPedidoStatus(): Promise<void> {
  const u = useAuthStore().usuario!
  const rows = await query<any>("SELECT idunico FROM ped WHERE status = 'V'")
  if (rows.length === 0) return
  const xml = '[pedidos]' + rows.map((r) => `[pedido]${tag('numpedido', r.idunico)}[/pedido]`).join('') + '[/pedidos]'
  const doc = await call(`P_VPEDW:EXEC("${xml}","${u.usuario}","${u.codlic}")`)
  for (const r of rowChildren(doc, 'retorno')) {
    const status = childText(r, 'status')
    if (status === 'S' || status === 'Z') {
      await run('UPDATE ped SET status = ?, sefaz = ?, file = ?, lancto = ? WHERE idunico = ?', [
        status, childText(r, 'sefaz'), childText(r, 'chave'), childText(r, 'lancto'), childText(r, 'idunico'),
      ])
    }
  }
}
