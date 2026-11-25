import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

// Pilha única de tudo que se abre por cima da tela (folhas, diálogos, menu): só o
// que está no topo responde ao Esc, ao Voltar do Android e prende o foco.
interface Overlay {
  painel: () => HTMLElement | null
  fechar: () => void
}

const pilha: Overlay[] = []

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Fecha o que estiver por cima. Devolve `false` se não havia nada aberto. */
export function fecharOverlay(): boolean {
  const topo = pilha[pilha.length - 1]
  topo?.fechar()
  return !!topo
}

function focaveis(painel: HTMLElement): HTMLElement[] {
  return [...painel.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => el.tabIndex >= 0 && !el.closest('[hidden]'))
}

function prenderTab(e: KeyboardEvent, painel: HTMLElement) {
  const itens = focaveis(painel)
  if (!itens.length) {
    e.preventDefault()
    return
  }
  const primeiro = itens[0]
  const ultimo = itens[itens.length - 1]
  const atual = document.activeElement
  if (e.shiftKey && (atual === primeiro || atual === painel || !painel.contains(atual))) {
    e.preventDefault()
    ultimo.focus()
  } else if (!e.shiftKey && (atual === ultimo || !painel.contains(atual))) {
    e.preventDefault()
    primeiro.focus()
  }
}

function onKey(e: KeyboardEvent) {
  const topo = pilha[pilha.length - 1]
  if (!topo) return
  if (e.key === 'Escape') {
    e.preventDefault()
    topo.fechar()
  } else if (e.key === 'Tab') {
    const painel = topo.painel()
    if (painel) prenderTab(e, painel)
  }
}

function empilhar(o: Overlay) {
  if (pilha.length === 0) window.addEventListener('keydown', onKey)
  pilha.push(o)
  document.body.style.overflow = 'hidden'
}

function desempilhar(o: Overlay): boolean {
  const i = pilha.indexOf(o)
  if (i < 0) return false
  pilha.splice(i, 1)
  if (pilha.length === 0) {
    window.removeEventListener('keydown', onKey)
    document.body.style.overflow = ''
  }
  return true
}

export function useOverlay(
  aberto: () => boolean,
  opts: {
    painel: Ref<HTMLElement | null>
    fechar: () => void
    /** Quem recebe o foco ao abrir (padrão: o próprio painel). */
    foco?: () => HTMLElement | null
  },
) {
  const overlay: Overlay = { painel: () => opts.painel.value, fechar: opts.fechar }
  let origem: Element | null = null

  watch(
    aberto,
    async (v) => {
      if (!v) {
        if (desempilhar(overlay) && origem instanceof HTMLElement) origem.focus({ preventScroll: true })
        return
      }
      origem = document.activeElement
      empilhar(overlay)
      await nextTick()
      ;(opts.foco?.() ?? opts.painel.value)?.focus({ preventScroll: true })
    },
    { immediate: true },
  )

  onBeforeUnmount(() => desempilhar(overlay))
}
