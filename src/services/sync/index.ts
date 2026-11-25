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

/** Cadastros básicos e status dos pedidos são sempre sincronizados; o resto conforme `opcoes`. */
export async function sincronizar(opcoes: OpcoesSync = SYNC_TUDO): Promise<void> {
  const store = useSyncStore()
  store.running = true
  store.error = null
  store.setProgress(0, 'Iniciando')

  const todos: Step[] = [
    { label: 'Validando sincronização', fn: validaSync },
    { label: 'Operações', fn: syncOperacao },
    { label: 'Condições de pagamento', fn: syncCondicao },
    { label: 'Empresas', fn: syncEmpresas },
    { label: 'Carga', fn: syncCarga },
    { label: 'Comissões', fn: syncComissao },
    { label: 'Cobranças', fn: syncCobrancas },
    { label: 'Histórico de agenda', fn: syncHistoricoAgenda },
    { label: 'Regiões', fn: syncRegiao },
    { label: 'Vendedores', fn: syncVendedores },
    { label: 'Clientes (envio)', fn: pushClientes, quando: ['clientes', 'pedidos'] },
    { label: 'Clientes (download)', fn: pullClientes, quando: ['clientes', 'pedidos'] },
    { label: 'Produtos', fn: syncProdutos, quando: ['produtos'] },
    { label: 'Estoque', fn: syncEstoque, quando: ['produtos'] },
    { label: 'Tabelas de preço', fn: syncTabelaPreco, quando: ['produtos'] },
    { label: 'Grupos', fn: syncGrupos, quando: ['produtos'] },
    { label: 'Pedidos (envio)', fn: () => pushPedidos(), quando: ['pedidos'] },
    { label: 'Títulos', fn: syncTitulos, quando: ['titulos'] },
    { label: 'Histórico de vendas', fn: syncHistorico, quando: ['historico'] },
    { label: 'Visitas (envio)', fn: pushVisitas, quando: ['agenda'] },
    { label: 'Agenda (download)', fn: pullAgenda, quando: ['agenda'] },
    { label: 'Status dos pedidos', fn: pullPedidoStatus },
    { label: 'Finalizando', fn: finalizeSync },
  ]
  const steps = todos.filter((s) => !s.quando || s.quando.some((g) => opcoes[g]))

  try {
    for (let i = 0; i < steps.length; i++) {
      store.setProgress(Math.round((i / steps.length) * 100), steps[i].label)
      await steps[i].fn()
    }
    store.setProgress(100, 'Concluído')
  } catch (e) {
    store.error = e instanceof Error ? e.message : String(e)
    throw e
  } finally {
    store.running = false
  }
}
