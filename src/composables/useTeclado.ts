import { onBeforeUnmount, onMounted, ref } from 'vue'

// Menor que isso é barra do navegador aparecendo ou sumindo, não teclado.
const MINIMO = 150

/** `true` enquanto o teclado do aparelho ocupa parte da tela. */
export function useTeclado() {
  const aberto = ref(false)
  let largura = 0
  let altura = 0

  function medir() {
    const vv = window.visualViewport
    const w = window.innerWidth
    const h = Math.min(vv?.height ?? window.innerHeight, window.innerHeight)
    // Girar a tela muda a referência.
    if (w !== largura) {
      largura = w
      altura = h
    }
    altura = Math.max(altura, h)
    aberto.value = altura - h > MINIMO
  }

  onMounted(() => {
    medir()
    window.addEventListener('resize', medir)
    window.visualViewport?.addEventListener('resize', medir)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', medir)
    window.visualViewport?.removeEventListener('resize', medir)
  })

  return { tecladoAberto: aberto }
}
