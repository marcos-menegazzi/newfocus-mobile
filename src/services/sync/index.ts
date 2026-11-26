import { validaSync, finalizeSync } from './gate'
import { useSyncStore } from '../../stores/sync'
import { syncOperacao, syncCondicao, syncCobrancas, syncComissao, syncCarga, syncHistoricoAgenda, syncEmpresas, syncRegiao, syncVendedores, syncGrupos } from './catalog'
import { syncProdutos, syncEstoque, syncTabelaPreco } from './produtos'
import { pushClientes, pullClientes } from './clientes'
import { pushPedidos, pullPedidoStatus } from './pedidos'
import { syncTitulos } from './titulos'
import { syncHistorico } from './historico'
import { pullAgenda, pushVisitas } from './agenda'

export type GrupoSync = 'clientes' | 'produtos' | 'pedidos' | 'titulos' | 'historico' | 'agenda'
export type OpcoesSync = Record<GrupoSync, boolean>

export const SYNC_TUDO: OpcoesSync = {
  clientes: true, produtos: true, pedidos: true, titulos: true, historico: true, agenda: true,
}

// Sem `quando`, o passo roda sempre.
type Step = { label: string; fn: () => Promise<void>; quando?: GrupoSync[] }
// Passos de uma trilha rodam em sequência; as trilhas de uma fase rodam em paralelo.
type Fase = Step[][]

const so = (s: Step): Step[] => [s]

/**
 * Cadastros básicos e status dos pedidos são sincronizados sempre; o resto conforme `opcoes`.
 *
 * Como no app legado, as consultas independentes vão em paralelo com a trilha principal
 * (clientes → produtos → estoque). O envio de pedidos espera tudo: lê clientes e condições.
 */
export async function sincronizar(opcoes: OpcoesSync = SYNC_TUDO): Promise<void> {
  const store = useSyncStore()
  store.running = true
  store.error = null
  store.setProgress(0, 'Iniciando')

  const todas: Fase[] = [
    [so({ label: 'Validando sincronização', fn: validaSync })],
    [
      [
        { label: 'Clientes (envio)', fn: pushClientes, quando: ['clientes', 'pedidos'] },
        { label: 'Clientes (download)', fn: pullClientes, quando: ['clientes', 'pedidos'] },
        { label: 'Produtos', fn: syncProdutos, quando: ['produtos'] },
        { label: 'Estoque', fn: syncEstoque, quando: ['produtos'] },
      ],
      so({ label: 'Operações', fn: syncOperacao }),
      so({ label: 'Condições de pagamento', fn: syncCondicao }),
      so({ label: 'Empresas', fn: syncEmpresas }),
      so({ label: 'Carga', fn: syncCarga }),
      so({ label: 'Comissões', fn: syncComissao }),
      so({ label: 'Cobranças', fn: syncCobrancas }),
      so({ label: 'Histórico de agenda', fn: syncHistoricoAgenda }),
      so({ label: 'Regiões', fn: syncRegiao }),
      so({ label: 'Vendedores', fn: syncVendedores }),
      so({ label: 'Tabelas de preço', fn: syncTabelaPreco, quando: ['produtos'] }),
      so({ label: 'Grupos', fn: syncGrupos, quando: ['produtos'] }),
      so({ label: 'Títulos', fn: syncTitulos, quando: ['titulos'] }),
      so({ label: 'Histórico de vendas', fn: syncHistorico, quando: ['historico'] }),
      [
        { label: 'Visitas (envio)', fn: pushVisitas, quando: ['agenda'] },
        { label: 'Agenda (download)', fn: pullAgenda, quando: ['agenda'] },
      ],
    ],
    [[
      { label: 'Pedidos (envio)', fn: () => pushPedidos(), quando: ['pedidos'] },
      { label: 'Status dos pedidos', fn: pullPedidoStatus },
      { label: 'Finalizando', fn: finalizeSync },
    ]],
  ]
  const ativo = (s: Step) => !s.quando || s.quando.some((g) => opcoes[g])
  const plano = todas
    .map((fase) => fase.map((trilha) => trilha.filter(ativo)).filter((t) => t.length > 0))
    .filter((fase) => fase.length > 0)

  const total = plano.flat(2).length
  let concluidos = 0
  const emAndamento: string[] = []
  const mostrar = () => store.setProgress(
    (concluidos / total) * 100,
    emAndamento[emAndamento.length - 1] ?? '',
  )

  const executarTrilha = async (trilha: Step[]) => {
    for (const s of trilha) {
      emAndamento.push(s.label)
      mostrar()
      try {
        await s.fn()
      } finally {
        emAndamento.splice(emAndamento.indexOf(s.label), 1)
      }
      concluidos++
      mostrar()
    }
  }

  try {
    for (const fase of plano) {
      // Espera todas as trilhas terminarem antes de falhar: nenhuma fica gravando depois do erro.
      const resultados = await Promise.allSettled(fase.map(executarTrilha))
      const falha = resultados.find((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (falha) throw falha.reason
    }
    store.setProgress(100, 'Concluído')
  } catch (e) {
    store.error = e instanceof Error ? e.message : String(e)
    throw e
  } finally {
    store.running = false
  }
}
