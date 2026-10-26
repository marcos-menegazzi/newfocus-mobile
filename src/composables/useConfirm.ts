import { reactive } from 'vue'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel: string
  cancelLabel?: string
  /** Ação destrutiva: botão de confirmar em vermelho. */
  danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve: ((ok: boolean) => void) | null
}

const state = reactive<ConfirmState>({
  open: false,
  title: '',
  confirmLabel: '',
  resolve: null,
})

export function useConfirm() {
  // Substitui o confirm() nativo por um diálogo no layout do app.
  function confirmar(opts: ConfirmOptions): Promise<boolean> {
    state.resolve?.(false)
    Object.assign(state, { message: undefined, cancelLabel: undefined, danger: false }, opts, { open: true })
    return new Promise((resolve) => {
      state.resolve = resolve
    })
  }

  function responder(ok: boolean) {
    state.resolve?.(ok)
    state.resolve = null
    state.open = false
  }

  return { state, confirmar, responder }
}
