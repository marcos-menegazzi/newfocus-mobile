import { validaSync, finalizeSync } from './gate'
import { useSyncStore } from '../../stores/sync'
import { syncOperacao, syncCondicao, syncCobrancas, syncComissao, syncCarga, syncHistoricoAgenda, syncEmpresas, syncRegiao, syncVendedores, syncGrupos } from './catalog'
import { syncProdutos, syncEstoque, syncTabelaPreco } from './produtos'
import { pushClientes, pullClientes } from './clientes'
import { pushPedidos, pullPedidoStatus } from './pedidos'
import { syncTitulos } from './titulos'
import { syncHistorico } from './historico'
import { pullAgenda, pushVisitas } from './agenda'

type Step = { label: string; fn: () => Promise<void> }

export async function sincronizar(): Promise<void> {
  const store = useSyncStore()
  store.running = true
  store.error = null
  store.setProgress(0, 'Iniciando')

  const steps: Step[] = [
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
    { label: 'Clientes (envio)', fn: pushClientes },
    { label: 'Clientes (download)', fn: pullClientes },
    { label: 'Produtos', fn: syncProdutos },
    { label: 'Estoque', fn: syncEstoque },
    { label: 'Tabelas de preço', fn: syncTabelaPreco },
    { label: 'Grupos', fn: syncGrupos },
    { label: 'Pedidos (envio)', fn: pushPedidos },
    { label: 'Títulos', fn: syncTitulos },
    { label: 'Histórico de vendas', fn: syncHistorico },
    { label: 'Visitas (envio)', fn: pushVisitas },
    { label: 'Agenda (download)', fn: pullAgenda },
    { label: 'Status dos pedidos', fn: pullPedidoStatus },
    { label: 'Finalizando', fn: finalizeSync },
  ]

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
