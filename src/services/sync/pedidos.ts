import { call } from './context'
import { childText, rowChildren, removechar } from './helpers'
import { run, query } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'

const PED_SQL = `SELECT p.numpedido, p.data, p.total, p.empresa, c.codigo AS cliente,
  p.operacao AS opeped, p.condpag AS condped, p.obs, p.tabela AS tabped, p.carga, p.tipo,
  p.comissao AS comisped, p.complemento, p.idunico, p.numero AS numnota, p.snunidade,
  p.snquilo, p.valor_quilo, p.valor_unidade, p.valor_frete, p.retsuc, p.resolvido,
  p.cliente_nome, p.cliente_cpf, p.vendedor
  FROM ped p INNER JOIN clifor c ON p.clifor = c.codigo INNER JOIN condicao e ON p.condpag = e.codigo
  WHERE e.inativo = 'N' AND p.status = 'F' ORDER BY p.numpedido LIMIT 3`

function t(v: unknown): string {
  return v == null ? '' : String(v)
}

function field(name: string, v: unknown): string {
  return `<${name}>${removechar(t(v))}</${name}>`
}

export async function pushPedidos(): Promise<void> {
  const u = useAuthStore().usuario!
  while (true) {
    const peds = await query<any>(PED_SQL)
    if (peds.length === 0) break
    for (const p of peds) {
      const itens = await query<any>('SELECT * FROM mped WHERE numpedido = ? ORDER BY codproduto', [p.numpedido])
      const parcelas = await query<any>('SELECT valor, cobranca, condicao, autorizacao FROM financeiro WHERE pedido = ?', [p.numpedido])

      const pedXml =
        field('numpedido', p.numpedido) + field('data', p.data) + field('total', p.total) +
        field('empresa', p.empresa) + field('clifor', p.cliente) + field('operacao', p.opeped) +
        field('condicao', p.condped) + field('obs', p.obs) + field('tabela', p.tabped) +
        field('carga', p.carga) + field('tipo', p.tipo) + field('comissao', p.comisped) +
        field('complemento', p.complemento) + field('idunico', p.idunico) + field('numero', p.numnota) +
        field('snunidade', p.snunidade) + field('snquilo', p.snquilo) + field('valor_quilo', p.valor_quilo) +
        field('valor_unidade', p.valor_unidade) + field('valor_frete', p.valor_frete ?? 0) +
        field('retsuc', p.retsuc) + field('resolvido', p.resolvido) +
        field('cliente_nome', p.cliente_nome) + field('cliente_cpf', p.cliente_cpf) +
        field('vendedor', p.vendedor)

      const finXml = '<financeiro>' + parcelas.map((pa) =>
        '<parcela>' + field('cobranca', pa.cobranca) + field('condicao', pa.condicao) +
        field('valor', pa.valor) + field('autorizacao', pa.autorizacao) + '</parcela>'
      ).join('') + '</financeiro>'

      const prodXml = '<produto>' + itens.map((i) =>
        field('codigo', i.codproduto) + field('qtd', i.qtd) + field('vlunit', i.vlunit) +
        field('descto', i.descto ?? 0) + field('descinc', i.descinc ?? 0) + field('vltotal', i.vltotal) +
        field('operacao', i.operacao) + field('condicao', i.condicao) + field('descper', i.descper) +
        field('comissao', i.comissao) + field('tabela', i.tabela) + field('valor_negocia', i.valor_negocia) +
        field('fator', i.fator) + field('unidade', i.unidade) + field('flex', i.flex)
      ).join('') + '</produto>'

      const xml = `<pedidos><pedido>${pedXml}${finXml}${prodXml}</pedido></pedidos>`

      await run("UPDATE ped SET status = 'V' WHERE numpedido = ?", [p.numpedido])

      const doc = await call(`P_PWEB:EXEC("${xml}","${u.codlic}","${u.usuario}")`)
      for (const r of rowChildren(doc, 'pedidos')) {
        if (childText(r, 'status') === 'Ok') {
          await run("UPDATE ped SET lancto = ?, status = 'S' WHERE numpedido = ?", [
            childText(r, 'lancto'), childText(r, 'numped'),
          ])
        }
      }
    }
  }
}

export async function pullPedidoStatus(): Promise<void> {
  const u = useAuthStore().usuario!
  const rows = await query<any>("SELECT idunico FROM ped WHERE status = 'V'")
  if (rows.length === 0) return
  const xml = '<pedidos>' + rows.map((r) => `<pedido><numpedido>${r.idunico}</numpedido></pedido>`).join('') + '</pedidos>'
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
