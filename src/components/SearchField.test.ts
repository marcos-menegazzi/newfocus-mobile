import { createApp, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SearchField from './SearchField.vue'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

function montar(props: Record<string, unknown> = {}) {
  const busca = ref('')
  const submit = vi.fn()
  const host = document.createElement('div')
  const app = createApp({
    render: () => h(SearchField, { modelValue: busca.value, 'onUpdate:modelValue': (v: string) => { busca.value = v }, onSubmit: submit, ...props }),
  })
  app.mount(host)
  const digitar = async (v: string) => {
    const el = host.querySelector('input')!
    el.value = v
    el.dispatchEvent(new Event('input'))
    await nextTick()
  }
  return { app, host, submit, digitar }
}

it('busca uma vez só quando a digitação para', async () => {
  const { app, submit, digitar } = montar()
  await digitar('ba')
  vi.advanceTimersByTime(200)
  await digitar('bat')
  vi.advanceTimersByTime(349)
  expect(submit).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(submit).toHaveBeenCalledOnce()
  app.unmount()
})

it('enviar pelo teclado cancela a busca pendente', async () => {
  const { app, host, submit, digitar } = montar()
  await digitar('bat')
  host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
  vi.advanceTimersByTime(1000)
  expect(submit).toHaveBeenCalledOnce()
  app.unmount()
})

it('com auto desligado só busca ao enviar', async () => {
  const { app, submit, digitar } = montar({ auto: false })
  await digitar('bat')
  vi.advanceTimersByTime(1000)
  expect(submit).not.toHaveBeenCalled()
  app.unmount()
})
