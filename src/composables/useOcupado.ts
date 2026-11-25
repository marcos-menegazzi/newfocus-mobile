import { ref } from 'vue'

/** Uma ação por vez: enquanto uma roda, novos toques são ignorados. `ocupado` diz qual. */
export function useOcupado() {
  const ocupado = ref<string | null>(null)

  async function executar(chave: string, fn: () => unknown): Promise<void> {
    if (ocupado.value !== null) return
    ocupado.value = chave
    try {
      await fn()
    } finally {
      ocupado.value = null
    }
  }

  return { ocupado, executar }
}
