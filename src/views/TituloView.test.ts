import { createPinia } from 'pinia'
import { createApp, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { abrirBanco, inserir } from '../test/sqlite'
import { routes } from '../router'

vi.mock('../components/Sidebar.vue', () => ({ default: { render: () => null } }))
vi.mock('../db/connection', () => import('../test/sqlite'))

beforeEach(abrirBanco)

async function abrirLista() {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/titulos/1')
  const host = document.createElement('div')
  const app = createApp({ render: () => h(RouterView) }).use(createPinia()).use(router)
  app.mount(host)
  await vi.waitFor(() => expect(host.querySelectorAll('li a').length).toBeGreaterThan(0))
  return { app, host, links: () => [...host.querySelectorAll<HTMLAnchorElement>('li a')] }
}

it('abre o detalhe de título com barra no número', async () => {
  await inserir('titulos', { clifor: 1, numero: '12345/1', valor: 10, obs: 'Parcela um' })
  const { app, host, links } = await abrirLista()
  links()[0].click()
  await vi.waitFor(() => expect(host.textContent).toContain('Parcela um'))
  expect(host.textContent).toContain('Título 12345/1')
  app.unmount()
})

it('abre o título escolhido quando o número se repete em outra empresa', async () => {
  await inserir('titulos', { clifor: 1, numero: '500', empresa: 1, valor: 10, obs: 'Da empresa um' })
  await inserir('titulos', { clifor: 1, numero: '500', empresa: 2, valor: 20, obs: 'Da empresa dois' })
  const { app, host, links } = await abrirLista()
  links()[1].click()
  await vi.waitFor(() => expect(host.textContent).toContain('Da empresa dois'))
  app.unmount()
})
