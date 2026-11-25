import { createPinia } from 'pinia'
import { createApp, nextTick } from 'vue'
import { expect, it, vi } from 'vitest'
import { run } from '../db/connection'
import { consultarCnpj } from '../services/receitaWs'
import { useAuthStore } from '../stores/auth'
import CadastroClienteView from './CadastroClienteView.vue'

vi.mock('vue-router', () => ({ useRoute: () => ({ params: {} }), useRouter: () => ({ replace: vi.fn() }), onBeforeRouteLeave: vi.fn() }))
vi.mock('../components/Sidebar.vue', () => ({ default: { render: () => null } }))
vi.mock('../db/connection', () => ({ query: vi.fn().mockResolvedValue([]), run: vi.fn() }))
vi.mock('../services/receitaWs', () => ({ consultarCnpj: vi.fn() }))

it('mascara CPF e CNPJ e habilita a consulta somente para um CNPJ válido', async () => {
  const host = document.createElement('div')
  const app = createApp(CadastroClienteView).use(createPinia())
  app.mount(host)
  const campo = host.querySelector<HTMLInputElement>('#cnpj')!
  const botao = campo.parentElement!.querySelector('button')!
  const buscar = vi.mocked(consultarCnpj).mockRejectedValue(new Error('Consulta simulada'))

  async function digitar(valor: string) {
    campo.value = valor
    campo.dispatchEvent(new Event('input'))
    await nextTick()
  }

  try {
    expect(botao.disabled).toBe(true)
    await digitar('52998224725')
    expect(campo.value).toBe('529.982.247-25')
    expect(botao.disabled).toBe(true)
    botao.click()
    expect(buscar).not.toHaveBeenCalled()

    await digitar('113781170001')
    expect(campo.value).toBe('11.378.117/0001')
    expect(botao.disabled).toBe(true)

    await digitar('11.378.117/0001-21')
    expect(botao.disabled).toBe(true)

    await digitar('11.378.117/0001-20')
    expect(campo.value).toBe('11.378.117/0001-20')
    expect(botao.disabled).toBe(false)
    botao.click()
    expect(buscar).toHaveBeenCalledExactlyOnceWith('11378117000120')
    await vi.waitFor(() => expect(host.querySelector('[role="alert"]')?.textContent).toContain('Consulta simulada'))
  } finally {
    app.unmount()
  }
})

it('aponta os campos obrigatórios e só grava quando estão válidos', async () => {
  const pinia = createPinia()
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(CadastroClienteView).use(pinia)
  useAuthStore(pinia).usuario = { codlic: 1, usuario: 'M', bloqcli: 'N', altcli: 'N' } as any
  app.mount(host)
  const gravar = vi.mocked(run).mockClear()
  await vi.waitFor(() => expect(host.querySelector('.btn-primary')).toBeTruthy())
  const salvar = async () => {
    host.querySelector<HTMLButtonElement>('.btn-primary')!.click()
    await nextTick()
    await nextTick()
  }
  try {
    await salvar()
    expect(gravar).not.toHaveBeenCalled()
    const resumo = host.querySelector('[role="alert"]')!
    expect(resumo.textContent).toContain('Faltam 12 campos')
    expect(document.activeElement).toBe(resumo)
    expect(host.querySelector('#razao')!.getAttribute('aria-describedby')).toBe('erro-razao')
    expect(host.querySelector('#erro-razao')!.textContent).toContain('Informe a razão social')

    const razao = host.querySelector<HTMLInputElement>('#razao')!
    razao.value = 'Empresa'
    razao.dispatchEvent(new Event('input'))
    await nextTick()
    await nextTick()
    expect(host.querySelector('#erro-razao')).toBeNull()
    expect(razao.hasAttribute('aria-invalid')).toBe(false)
  } finally {
    app.unmount()
    host.remove()
  }
})
