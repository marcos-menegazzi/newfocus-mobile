import { createPinia } from 'pinia'
import { createApp, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { abrirBanco, inserir } from '../test/sqlite'
import { routes } from '../router'

vi.mock('../components/Sidebar.vue', () => ({ default: { render: () => null } }))
vi.mock('../db/connection', () => import('../test/sqlite'))

beforeEach(abrirBanco)

it.each(['A/1', 'A#1', 'A?1', '50%', 'A%2F1'])('abre o detalhe do produto de código %s', async (codigo) => {
  await inserir('produtos', { codigo, descricao: 'Bateria', descred: 'Bateria', barras: '789' })
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/produtos')
  const host = document.createElement('div')
  const app = createApp({ render: () => h(RouterView) }).use(createPinia()).use(router)
  app.mount(host)
  await vi.waitFor(() => expect(host.querySelector('main li a')).toBeTruthy())
  host.querySelector<HTMLAnchorElement>('main li a')!.click()
  await vi.waitFor(() => expect(host.textContent).toContain('Código de barras'))
  app.unmount()
})
