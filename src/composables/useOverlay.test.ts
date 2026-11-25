import { createApp, defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { afterEach, expect, it } from 'vitest'
import { fecharOverlay, useOverlay } from './useOverlay'

let app: ReturnType<typeof createApp> | null = null

function montar(estados: Ref<boolean>[]) {
  const Painel = defineComponent({
    props: { i: { type: Number, required: true } },
    setup(props) {
      const painel = ref<HTMLElement | null>(null)
      const aberto = estados[props.i]
      useOverlay(() => aberto.value, { painel, fechar: () => (aberto.value = false) })
      return () => aberto.value
        ? h('div', { ref: painel, tabindex: -1, id: `p${props.i}` }, [h('button', 'primeiro'), h('button', 'último')])
        : null
    },
  })
  const host = document.createElement('div')
  document.body.append(host)
  app = createApp({ render: () => [h('button', { id: 'origem' }, 'abrir'), ...estados.map((_, i) => h(Painel, { i }))] })
  app.mount(host)
}

const tecla = (key: string, shiftKey = false) =>
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }))

afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
})

it('Esc e Voltar fecham só o overlay do topo', async () => {
  const a = ref(false)
  const b = ref(false)
  montar([a, b])
  a.value = true
  await nextTick()
  b.value = true
  await nextTick()
  expect(document.body.style.overflow).toBe('hidden')

  tecla('Escape')
  await nextTick()
  expect([a.value, b.value]).toEqual([true, false])
  expect(document.body.style.overflow).toBe('hidden')

  expect(fecharOverlay()).toBe(true)
  await nextTick()
  expect(a.value).toBe(false)
  expect(document.body.style.overflow).toBe('')
  expect(fecharOverlay()).toBe(false)
})

it('prende o Tab no painel e devolve o foco a quem abriu', async () => {
  const a = ref(false)
  montar([a])
  const origem = document.querySelector<HTMLButtonElement>('#origem')!
  origem.focus()
  a.value = true
  await nextTick()
  await nextTick()
  expect(document.activeElement?.id).toBe('p0')

  const [primeiro, ultimo] = document.querySelectorAll<HTMLButtonElement>('#p0 button')
  ultimo.focus()
  tecla('Tab')
  expect(document.activeElement).toBe(primeiro)
  tecla('Tab', true)
  expect(document.activeElement).toBe(ultimo)

  a.value = false
  await nextTick()
  expect(document.activeElement).toBe(origem)
})

it('libera a rolagem quando o componente é desmontado aberto', async () => {
  const a = ref(true)
  montar([a])
  await nextTick()
  expect(document.body.style.overflow).toBe('hidden')
  app!.unmount()
  app = null
  expect(document.body.style.overflow).toBe('')
})
