import { createPinia } from 'pinia'
import { createApp, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, expect, it, vi } from 'vitest'
import { useAuthStore } from '../stores/auth'
import BottomNav from './BottomNav.vue'

vi.mock('../db/connection', () => ({ query: vi.fn().mockResolvedValue([]), run: vi.fn() }))

let app: ReturnType<typeof createApp> | null = null
afterEach(() => app?.unmount())

async function montar(inicio: string, os = false) {
  const vazio = { render: () => null }
  const nomes = ['home', 'pedidos', 'clientes', 'produtos', 'metas', 'os', 'os-despesas', 'os-diario', 'os-historico']
  const router = createRouter({ history: createMemoryHistory(), routes: nomes.map((name) => ({ path: `/${name}`, name, component: vazio })) })
  await router.push(`/${inicio}`)
  const pinia = createPinia()
  useAuthStore(pinia).usuario = { snos: os ? 'S' : 'N' } as any
  const onMenu = vi.fn()
  const host = document.createElement('div')
  app = createApp({ render: () => [h(RouterView), h(BottomNav, { menuAberto: false, onMenu })] }).use(pinia).use(router)
  app.mount(host)
  await nextTick()
  const itens = () => [...host.querySelectorAll<HTMLElement>('nav a, nav button')]
  const item = (t: string) => itens().find((e) => e.textContent?.trim() === t)!
  const atual = () => itens().filter((e) => e.getAttribute('aria-current') === 'page').map((e) => e.textContent?.trim())
  return { router, host, itens, item, atual, onMenu }
}

it('mostra os cinco destinos com rótulo e marca a aba atual', async () => {
  const { itens, atual } = await montar('clientes')
  expect(itens().map((e) => e.textContent?.trim())).toEqual(['Início', 'Pedidos', 'Clientes', 'Produtos', 'Menu'])
  expect(atual()).toEqual(['Clientes'])
})

it('o usuário de OS tem as próprias abas', async () => {
  const { itens, atual } = await montar('os-diario', true)
  expect(itens().map((e) => e.textContent?.trim())).toEqual(['Início', 'Despesas', 'Diário', 'Histórico', 'Menu'])
  expect(atual()).toEqual(['Diário'])
})

it('numa tela do menu, o item Menu fica marcado e abre o menu', async () => {
  const { item, atual, onMenu } = await montar('metas')
  expect(atual()).toEqual([])
  expect(item('Menu').hasAttribute('data-ativo')).toBe(true)
  item('Menu').click()
  expect(onMenu).toHaveBeenCalledOnce()
})

it('entre abas, voltar sempre leva ao início', async () => {
  const { router, item } = await montar('home')
  for (const aba of ['Pedidos', 'Clientes', 'Produtos']) {
    item(aba).click()
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe(aba.toLowerCase()))
    await nextTick()
  }
  router.back()
  await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('home'))
})

it('tocar na aba atual volta ao topo', async () => {
  const { item } = await montar('clientes')
  const rolar = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  item('Clientes').click()
  expect(rolar).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
  rolar.mockRestore()
})
