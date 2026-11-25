import { App, type BackButtonListener } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { expect, it, vi } from 'vitest'
import { query, run } from '../db/connection'
import NovoPedidoView from './NovoPedidoView.vue'

const router = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'pedido-edit', params: { numpedido: '0000000001' } }),
  useRouter: () => router,
}))
vi.mock('../components/Sidebar.vue', () => ({ default: { render: () => null } }))
vi.mock('../db/connection', () => ({ query: vi.fn(), run: vi.fn(), saveWebDb: vi.fn() }))
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }))

it('volta pelas etapas com o botão do Android e sai diretamente pela seta do topo', async () => {
  const remove = vi.fn().mockResolvedValue(undefined)
  let voltarAndroid!: BackButtonListener
  vi.mocked(App.addListener).mockImplementation(async (evento, listener) => {
    expect(evento).toBe('backButton')
    voltarAndroid = listener as BackButtonListener
    return { remove }
  })
  vi.mocked(query).mockImplementation(async (sql) => sql.startsWith('SELECT p.*, c.inativo')
    ? [{ numpedido: '0000000001', etapa: 3, status: 'A', tabela: 1 }]
    : [])
  vi.mocked(run).mockResolvedValue({ changes: 1 })
  const plataforma = vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
  const rolar = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const historico = vi.spyOn(window.history, 'length', 'get').mockReturnValue(2)
  const host = document.createElement('div')
  const app = createApp(NovoPedidoView).use(createPinia())
  app.mount(host)

  const etapaAtual = () => host.querySelector('[aria-current="step"]')?.textContent
  try {
    await vi.waitFor(() => expect(etapaAtual()).toContain('Revisão'))

    host.querySelector<HTMLButtonElement>('header button[aria-label="Voltar"]')!.click()
    expect(router.back).toHaveBeenCalledOnce()
    expect(etapaAtual()).toContain('Revisão')
    router.back.mockClear()

    for (const [indice, etapa] of [[2, 'Pagamento'], [1, 'Produtos'], [0, 'Cliente']] as const) {
      await voltarAndroid({ canGoBack: true })
      expect(etapaAtual()).toContain(etapa)
      expect(run).toHaveBeenCalledWith('UPDATE ped SET etapa = ? WHERE numpedido = ?', [indice, '0000000001'])
      expect(router.back).not.toHaveBeenCalled()
    }

    await voltarAndroid({ canGoBack: true })
    expect(router.back).toHaveBeenCalledOnce()
  } finally {
    app.unmount()
    plataforma.mockRestore()
    rolar.mockRestore()
    historico.mockRestore()
  }
  await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce())
})

it.each(['F', 'V', 'S', 'Z', 'C'])('pedido %s: o botão do Android volta à tela anterior, em qualquer etapa', async (status) => {
  router.back.mockClear()
  let voltarAndroid!: BackButtonListener
  vi.mocked(App.addListener).mockImplementation(async (_, listener) => {
    voltarAndroid = listener as BackButtonListener
    return { remove: vi.fn().mockResolvedValue(undefined) }
  })
  vi.mocked(query).mockImplementation(async (sql) => sql.startsWith('SELECT p.*, c.inativo')
    ? [{ numpedido: '0000000001', etapa: 1, status, tabela: 1 }]
    : [])
  const plataforma = vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
  const rolar = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const host = document.createElement('div')
  const app = createApp(NovoPedidoView).use(createPinia())
  app.mount(host)

  const etapaAtual = () => host.querySelector('[aria-current="step"]')?.textContent
  try {
    await vi.waitFor(() => expect(etapaAtual()).toContain('Revisão'))
    await voltarAndroid({ canGoBack: true })
    expect(router.back).toHaveBeenCalledOnce()
    expect(etapaAtual()).toContain('Revisão')

    const produtos = [...host.querySelectorAll<HTMLButtonElement>('nav button')].find((b) => b.textContent?.includes('Produtos'))!
    produtos.click()
    await vi.waitFor(() => expect(etapaAtual()).toContain('Produtos'))
    await voltarAndroid({ canGoBack: true })
    expect(router.back).toHaveBeenCalledTimes(2)
    expect(etapaAtual()).toContain('Produtos')
  } finally {
    app.unmount()
    plataforma.mockRestore()
    rolar.mockRestore()
  }
})
