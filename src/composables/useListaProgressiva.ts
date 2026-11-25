import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch, type Ref } from 'vue'

const PASSO = 40

/**
 * Desenha listas longas aos poucos: mais itens entram quando o elemento `ref="sentinela"`,
 * colocado depois da lista, se aproxima da tela.
 */
export function useListaProgressiva<T>(lista: Ref<T[]>) {
  const suportado = typeof IntersectionObserver !== 'undefined'
  const limite = ref(PASSO)
  const sentinela = useTemplateRef<HTMLElement>('sentinela')

  const visiveis = computed(() => (suportado ? lista.value.slice(0, limite.value) : lista.value))
  const temMais = computed(() => visiveis.value.length < lista.value.length)

  if (suportado) {
    const obs = new IntersectionObserver(
      async (entradas) => {
        if (!entradas.some((e) => e.isIntersecting) || !temMais.value) return
        limite.value += PASSO
        await nextTick()
        // Observar de novo: se a sentinela continuar visível, o próximo lote entra em seguida.
        if (sentinela.value) {
          obs.unobserve(sentinela.value)
          obs.observe(sentinela.value)
        }
      },
      { rootMargin: '600px 0px' },
    )
    watch(sentinela, (el, antes) => {
      if (antes) obs.unobserve(antes)
      if (el) obs.observe(el)
    })
    // Uma nova busca recomeça do início; atualizar a lista no meio da rolagem não.
    watch(lista, () => {
      if (window.scrollY < 100) limite.value = PASSO
    })
    onBeforeUnmount(() => obs.disconnect())
  }

  return { visiveis, temMais }
}
