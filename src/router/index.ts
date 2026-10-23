import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/config', name: 'config', component: () => import('../views/ConfigView.vue') },
  { path: '/clientes', name: 'clientes', component: () => import('../views/ConsultaClientesView.vue') },
  { path: '/clientes/novo', name: 'cliente-novo', component: () => import('../views/CadastroClienteView.vue') },
  { path: '/clientes/:idcliente', name: 'cliente-edit', component: () => import('../views/CadastroClienteView.vue') },
  { path: '/produtos', name: 'produtos', component: () => import('../views/ConsultaProdutosView.vue') },
  { path: '/produtos/:codigo', name: 'produto', component: () => import('../views/ProdutoView.vue') },
  { path: '/pedidos', name: 'pedidos', component: () => import('../views/ConsultaPedidosView.vue') },
  { path: '/pedidos/novo', name: 'pedido-novo', component: () => import('../views/NovoPedidoView.vue') },
  { path: '/pedidos/:numpedido', name: 'pedido-edit', component: () => import('../views/NovoPedidoView.vue') },
  { path: '/titulos/:idcliente', name: 'titulos', component: () => import('../views/ConsultaTitulosView.vue') },
  { path: '/titulo/:numero', name: 'titulo', component: () => import('../views/TituloView.vue') },
  { path: '/venda/:pedido', name: 'venda', component: () => import('../views/VendaView.vue') },
  { path: '/historico-vendas', name: 'historico-vendas', component: () => import('../views/HistoricoVendasView.vue') },
  { path: '/agenda', name: 'agenda', component: () => import('../views/AgendaView.vue') },
  { path: '/metas', name: 'metas', component: () => import('../views/MetasView.vue') },
  { path: '/os', name: 'os', component: () => import('../views/OsView.vue') },
  { path: '/os/despesas', name: 'os-despesas', component: () => import('../views/DespesasView.vue') },
  { path: '/os/diario', name: 'os-diario', component: () => import('../views/DiarioView.vue') },
  { path: '/os/historico', name: 'os-historico', component: () => import('../views/OsHistoricoView.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.loggedIn) {
    const ok = await auth.loadSession()
    if (!ok && to.name !== 'login') return { name: 'login' }
  }
  if (to.name === 'login' && auth.loggedIn) return { name: 'home' }
  return true
})

export default router
