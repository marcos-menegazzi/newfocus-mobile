import { createApp, h, nextTick, ref } from 'vue'
import { expect, it } from 'vitest'
import Segmented from './Segmented.vue'

it('tem um só ponto de Tab e troca de opção pelas setas', async () => {
  const valor = ref('b')
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({
    render: () => h(Segmented as any, {
      modelValue: valor.value,
      'onUpdate:modelValue': (v: string) => { valor.value = v },
      options: ['a', 'b', 'c'].map((v) => ({ value: v, label: v.toUpperCase() })),
    }),
  })
  app.mount(host)
  const botoes = () => [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
  const seta = (i: number, key: string) => botoes()[i].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  expect(botoes().map((b) => b.tabIndex)).toEqual([-1, 0, -1])

  seta(1, 'ArrowRight')
  await nextTick()
  expect(valor.value).toBe('c')
  expect(document.activeElement).toBe(botoes()[2])

  seta(2, 'ArrowRight')
  await nextTick()
  expect(valor.value).toBe('a')
  seta(0, 'ArrowLeft')
  await nextTick()
  expect(valor.value).toBe('c')
  app.unmount()
  host.remove()
})
