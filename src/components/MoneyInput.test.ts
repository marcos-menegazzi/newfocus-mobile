import { createApp, h, nextTick, ref, type App } from 'vue'
import { afterEach, expect, it } from 'vitest'
import MoneyInput from './MoneyInput.vue'

const valor = ref<number | null | undefined>(null)
let app: App
let host: HTMLElement

function montar(inicial: number | null | undefined) {
  valor.value = inicial
  host = document.createElement('div')
  document.body.append(host)
  app = createApp({
    render: () => h(MoneyInput, { modelValue: valor.value, 'onUpdate:modelValue': (v: number | null) => { valor.value = v } }),
  })
  app.mount(host)
  return host.querySelector('input')!
}

afterEach(() => {
  app.unmount()
  host.remove()
})

/** Tecla a tecla, respeitando a seleção, como no teclado do celular. */
async function digitar(el: HTMLInputElement, texto: string) {
  for (const t of texto) {
    el.setRangeText(t, el.selectionStart!, el.selectionEnd!, 'end')
    el.dispatchEvent(new Event('input'))
    await nextTick()
  }
}

async function entrar(el: HTMLInputElement) {
  el.focus()
  await new Promise((r) => requestAnimationFrame(r))
  // O toque posiciona o cursor depois do foco e só então dispara o click.
  el.setSelectionRange(el.value.length, el.value.length)
  el.click()
  await new Promise((r) => requestAnimationFrame(r))
}

it.each([
  ['20730', 'R$ 207,30', 207.3],
  ['20', 'R$ 0,20', 0.2],
  ['2000', 'R$ 20,00', 20],
])('digitar %s mostra %s', async (teclas, texto, numero) => {
  const el = montar(null)
  await entrar(el)
  await digitar(el, teclas)
  expect(el.value).toBe(texto)
  expect(valor.value).toBe(numero)
})

it('ao entrar num campo preenchido, o que se digita substitui o valor', async () => {
  const el = montar(207.3)
  await entrar(el)
  await digitar(el, '2000')
  expect(el.value).toBe('R$ 20,00')
  expect(valor.value).toBe(20)
})

it('um segundo toque leva o cursor ao fim para continuar o valor', async () => {
  const el = montar(207.3)
  await entrar(el)
  el.click()
  await new Promise((r) => requestAnimationFrame(r))
  await digitar(el, '5')
  expect(valor.value).toBe(2073.05)
})

it('sem valor (campo que ainda não existe no pedido) fica vazio', () => {
  expect(montar(undefined).value).toBe('')
})
