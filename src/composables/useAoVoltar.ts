import { onActivated } from 'vue'

/** Telas mantidas em memória: roda quando a pessoa volta a ela (não na primeira abertura). */
export function useAoVoltar(fn: () => unknown) {
  let primeira = true
  onActivated(() => {
    if (primeira) primeira = false
    else fn()
  })
}
