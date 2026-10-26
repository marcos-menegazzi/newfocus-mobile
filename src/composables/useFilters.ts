import { reactive, ref } from 'vue'

// Filtros editados num rascunho dentro do modal; só valem ao aplicar.
export function useFilters<T extends Record<string, unknown>>(defaults: T, onApply: () => void) {
  const filtros = reactive({ ...defaults }) as T
  const draft = reactive({ ...defaults }) as T
  const show = ref(false)

  function abrir() {
    Object.assign(draft, filtros)
    show.value = true
  }

  function aplicar() {
    Object.assign(filtros, draft)
    show.value = false
    onApply()
  }

  function limpar() {
    Object.assign(draft, defaults)
  }

  function remover(key: string) {
    ;(filtros as Record<string, unknown>)[key] = defaults[key]
    onApply()
  }

  return { filtros, draft, show, abrir, aplicar, limpar, remover }
}
