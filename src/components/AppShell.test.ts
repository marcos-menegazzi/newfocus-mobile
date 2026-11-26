import { createPinia } from 'pinia'
import { createApp, h, nextTick } from 'vue'
import { createRouter, createWebHashHistory, RouterView } from 'vue-router'
import { afterEach, expect, it, vi } from 'vitest'
import { ESTADO_VOLTA_AO_INICIO } from '../lib/navegacao'
import { useAuthStore } from '../stores/auth'
import AppShell from './AppShell.vue'

vi.mock('../db/connection', () => ({ query: vi.fn().mockResolvedValue([]), run: vi.fn() }))

let app: ReturnType<typeof createApp> | null = null
afterEach(() => app?.unmount())

async function montar() {
  const tela = { render: () => h(AppShell, { title: 'Tela', back: true }) }
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', name: 'home', component: tela },
      { path: '/pedidos', name: 'pedidos', component: tela },
      { path: '/pedidos/novo', name: 'pedido-novo', component: tela },
      { path: '/pedidos/:numpedido', name: 'pedido-edit', component: tela },
    ],
  })
  await router.push('/')
  const pinia = createPinia()
  useAuthStore(pinia).usuario = { snos: 'N' } as any
  const host = document.createElement('div')
  app = createApp({ render: () => h(RouterView) }).use(pinia).use(router)
  app.mount(host)
  await nextTick()
  const voltar = () => host.querySelector<HTMLButtonElement>('button[aria-label="Voltar"]')!.click()
  return { router, voltar }
}

it('o novo pedido aberto de dentro de um pedido volta ao início', async () => {
  const { router, voltar } = await montar()
  await router.push({ name: 'pedidos' })
  await router.push({ name: 'pedido-edit', params: { numpedido: '7' } })
  await router.replace({ name: 'pedido-novo', state: ESTADO_VOLTA_AO_INICIO })
  // Ao ganhar número, a URL passa a ser a do próprio pedido: o destino do Voltar não muda.
  await router.replace({ name: 'pedido-edit', params: { numpedido: '8' } })
  voltar()
  await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('home'))
})

it('um pedido aberto da lista volta para a lista', async () => {
  const { router, voltar } = await montar()
  await router.push({ name: 'pedidos' })
  await router.push({ name: 'pedido-edit', params: { numpedido: '7' } })
  voltar()
  await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('pedidos'))
})
