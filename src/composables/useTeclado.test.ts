import { createApp, defineComponent, nextTick } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { useTeclado } from './useTeclado'

afterEach(() => { vi.unstubAllGlobals() })

it('percebe o teclado pela altura que ele toma, sem confundir com girar a tela', async () => {
  let estado!: ReturnType<typeof useTeclado>
  const tela = async (w: number, h: number) => {
    vi.stubGlobal('innerWidth', w)
    vi.stubGlobal('innerHeight', h)
    window.dispatchEvent(new Event('resize'))
    await nextTick()
  }
  await tela(360, 760)
  const app = createApp(defineComponent({ setup() { estado = useTeclado(); return () => null } }))
  app.mount(document.createElement('div'))
  expect(estado.tecladoAberto.value).toBe(false)
  await tela(360, 700)
  expect(estado.tecladoAberto.value).toBe(false)
  await tela(360, 450)
  expect(estado.tecladoAberto.value).toBe(true)
  await tela(360, 760)
  expect(estado.tecladoAberto.value).toBe(false)
  await tela(760, 360)
  expect(estado.tecladoAberto.value).toBe(false)
  app.unmount()
})
