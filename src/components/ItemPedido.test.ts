import { createApp, h, nextTick } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import ItemPedido, { type DetalheItem } from './ItemPedido.vue'

let app: ReturnType<typeof createApp> | null = null
afterEach(() => app?.unmount())

const ITEM = { codproduto: '105FE', descricao: 'Bateria 105', qtd: 2, unidade: 'UN', vlunit: 110, vltotal: 220 }

async function montar(props: Record<string, unknown>) {
  const host = document.createElement('div')
  app = createApp({ render: () => h(ItemPedido, { item: ITEM, detalhes: [], ...props }) })
  app.mount(host)
  await nextTick()
  return host
}

it('mostra quantidade, unitário e total', async () => {
  const host = await montar({})
  expect(host.textContent).toContain('105FE - Bateria 105')
  expect(host.textContent).toContain('2 UN × R$ 110,00')
  expect(host.textContent).toContain('R$ 220,00')
})

it('mostra os descontos junto do preço', async () => {
  const host = await montar({ item: { ...ITEM, descto: 5, descper: 'S', descinc: 2 } })
  expect(host.textContent).toContain('desc. 5%, desc. inc. 2%')
})

it('o que difere do pedido é anunciado, não só colorido', async () => {
  const detalhes: DetalheItem[] = [
    { label: 'Operação', valor: 'VENDA BOLETO', diverge: true },
    { label: 'Tabela', valor: '79 - PADRAO', diverge: false },
  ]
  const host = await montar({ detalhes })
  const termos = [...host.querySelectorAll('dl > div')].map((d) =>
    [d.querySelector('dt'), d.querySelector('dd')].map((e) => e!.textContent!.replace(/\s+/g, ' ').trim()).join(' '),
  )
  expect(termos).toEqual(['Operação VENDA BOLETO (diferente do pedido)', 'Tabela 79 - PADRAO'])
})

it('só tem ações quando editável, e bloqueadas fora de aberto', async () => {
  expect((await montar({})).querySelectorAll('button')).toHaveLength(0)
  app!.unmount()

  const onEditar = vi.fn()
  const onExcluir = vi.fn()
  const host = await montar({ editavel: true, onEditar, onExcluir })
  host.querySelector<HTMLButtonElement>('[aria-label="Editar Bateria 105"]')!.click()
  host.querySelector<HTMLButtonElement>('[aria-label="Excluir Bateria 105"]')!.click()
  expect(onEditar).toHaveBeenCalledOnce()
  expect(onExcluir).toHaveBeenCalledOnce()
  app!.unmount()

  const bloqueado = await montar({ editavel: true, bloqueado: true })
  expect([...bloqueado.querySelectorAll('button')].every((b) => b.disabled)).toBe(true)
})
