import { App as Aparelho, type BackButtonListener } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { createPinia } from 'pinia'
import { createApp, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { expect, it, vi } from 'vitest'
import App from './App.vue'
import { useConfirm } from './composables/useConfirm'
import { useAuthStore } from './stores/auth'

vi.mock('./db/connection', () => ({ query: vi.fn().mockResolvedValue([]), run: vi.fn() }))
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(), minimizeApp: vi.fn() } }))

it('Voltar do Android: fecha o que está aberto, volta de tela e só sai do app no início', async () => {
  let voltar!: BackButtonListener
  vi.mocked(Aparelho.addListener).mockImplementation((async (_: string, l: BackButtonListener) => {
    voltar = l
    return { remove: vi.fn().mockResolvedValue(undefined) }
  }) as any)
  const plataforma = vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
  const vazio = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['home', 'clientes', 'metas'].map((name) => ({ path: `/${name}`, name, component: vazio })),
  })
  await router.push('/home')
  await router.push('/clientes')
  const pinia = createPinia()
  useAuthStore(pinia).usuario = { snos: 'N' } as any
  const app = createApp(App).use(pinia).use(router)
  app.mount(document.createElement('div'))
  const tela = () => router.currentRoute.value.name

  try {
    const resposta = useConfirm().confirmar({ title: 'Sair?', confirmLabel: 'Sair' })
    await nextTick()
    await voltar({ canGoBack: true })
    await expect(resposta).resolves.toBe(false)
    expect(tela()).toBe('clientes')

    await voltar({ canGoBack: true })
    await vi.waitFor(() => expect(tela()).toBe('home'))
    expect(Aparelho.minimizeApp).not.toHaveBeenCalled()

    await voltar({ canGoBack: true })
    expect(Aparelho.minimizeApp).toHaveBeenCalledOnce()
    expect(tela()).toBe('home')

    await router.push('/metas')
    await voltar({ canGoBack: false })
    await vi.waitFor(() => expect(tela()).toBe('home'))
    expect(Aparelho.minimizeApp).toHaveBeenCalledOnce()
  } finally {
    app.unmount()
    plataforma.mockRestore()
  }
})
