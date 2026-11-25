import { reactive } from 'vue'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel: string
  cancelLabel?: string
  /** Ação destrutiva: botão de confirmar em vermelho. */
  danger?: boolean
}

export interface AvisoOptions {
  title: string
  message?: string
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  /** Só informa: um único botão. */
  aviso: boolean
  resolve: ((ok: boolean) => void) | null
}

const state = reactive<ConfirmState>({
  open: false,
  aviso: false,
  title: '',
  confirmLabel: '',
  resolve: null,
})

export function useConfirm() {
  // Substitui o confirm() nativo por um diálogo no layout do app.
  function confirmar(opts: ConfirmOptions): Promise<boolean> {
    state.resolve?.(false)
    Object.assign(state, { message: undefined, cancelLabel: undefined, danger: false, aviso: false }, opts, { open: true })
    return new Promise((resolve) => {
      state.resolve = resolve
    })
  }

  // Para o que precisa ser lido antes de continuar (o toast some sozinho).
  async function avisar(opts: AvisoOptions): Promise<void> {
    const lido = confirmar({ ...opts, confirmLabel: 'Entendi' })
    state.aviso = true
    await lido
  }

  function responder(ok: boolean) {
    state.resolve?.(ok)
    state.resolve = null
    state.open = false
  }

  return { state, confirmar, avisar, responder }
}
