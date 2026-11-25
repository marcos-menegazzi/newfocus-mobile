import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { abrirBanco, inserir } from '../test/sqlite'
import ConsultaProdutosView from './ConsultaProdutosView.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({}),
  useRouter: () => ({}),
  RouterLink: { props: ['to'], render() { return (this as any).$slots.default?.() } },
}))
vi.mock('../components/Sidebar.vue', () => ({ default: { render: () => null } }))
vi.mock('../db/connection', () => import('../test/sqlite'))

beforeEach(abrirBanco)

it('distingue produtos positivados e não positivados', async () => {
  for (const codigo of ['A', 'B']) await inserir('produtos', { codigo, descricao: codigo, descred: `Produto ${codigo}` })
  const hoje = new Date()
  const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  await inserir('histvenda', { clifor: 1, lancto: 1, pedido: 1, data })
  await inserir('histitens', { lancto: 1, pedido: 1, produto: 'A', faturamento: 'S' })
  const host = document.createElement('div')
  const app = createApp(ConsultaProdutosView).use(createPinia())
  app.mount(host)
  await vi.waitFor(() => expect(host.textContent).toContain('Produto B'))
  const situacao = [...host.querySelectorAll('[data-positivado]')].map((e) => e.textContent?.trim())
  expect(situacao).toEqual(['Positivado', 'Não positivado'])
  app.unmount()
})
