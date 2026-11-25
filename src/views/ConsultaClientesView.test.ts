import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { abrirBanco, inserir } from '../test/sqlite'
import ConsultaClientesView from './ConsultaClientesView.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({}),
  useRouter: () => ({}),
  RouterLink: { props: ['to'], template: '<a><slot /></a>', render() { return (this as any).$slots.default?.() } },
}))
vi.mock('../components/Sidebar.vue', () => ({ default: { render: () => null } }))
vi.mock('../db/connection', () => import('../test/sqlite'))

beforeEach(abrirBanco)

it('destaca só os clientes com título em aberto', async () => {
  await inserir('clifor', { codigo: 1, fantasia: 'Alfa' })
  await inserir('clifor', { codigo: 2, fantasia: 'Beta' })
  await inserir('titulos', { clifor: 1, numero: '1', valor: 10 })
  const host = document.createElement('div')
  const app = createApp(ConsultaClientesView).use(createPinia())
  app.mount(host)
  await vi.waitFor(() => expect(host.textContent).toContain('Beta'))
  const marcados = [...host.querySelectorAll('[data-titulos]')]
  expect(marcados).toHaveLength(1)
  expect(marcados[0].textContent).toContain('Alfa')
  expect(marcados[0].textContent).toContain('1 título em aberto')
  expect(marcados[0].className).toContain('bg-sun-100')
  app.unmount()
})

it('distingue clientes positivados e não positivados', async () => {
  await inserir('clifor', { codigo: 1, fantasia: 'Alfa' })
  await inserir('clifor', { codigo: 2, fantasia: 'Beta' })
  const hoje = new Date()
  const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  await inserir('histvenda', { clifor: 1, lancto: 1, pedido: 1, data })
  await inserir('histitens', { lancto: 1, pedido: 1, produto: 'A', faturamento: 'S' })
  const host = document.createElement('div')
  const app = createApp(ConsultaClientesView).use(createPinia())
  app.mount(host)
  await vi.waitFor(() => expect(host.textContent).toContain('Beta'))
  const situacao = [...host.querySelectorAll('[data-positivado]')].map((e) => e.textContent?.trim())
  expect(situacao).toEqual(['Positivado', 'Não positivado'])
  app.unmount()
})
