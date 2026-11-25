import { reactive } from 'vue'

type ToastType = 'info' | 'success' | 'error'
interface ToastItem { id: number; msg: string; type: ToastType }

// Erro precisa de mais tempo de leitura do que uma confirmação.
const DURACAO: Record<ToastType, number> = { success: 3000, info: 4000, error: 5000 }

const state = reactive<{ items: ToastItem[] }>({ items: [] })
let seq = 0

export function useToast() {
  function dispensar(id: number) {
    const i = state.items.findIndex((t) => t.id === id)
    if (i >= 0) state.items.splice(i, 1)
  }

  function notify(msg: string, type: ToastType = 'info') {
    // A mesma mensagem repetida renova o aviso em vez de empilhar cópias.
    const igual = state.items.find((t) => t.msg === msg && t.type === type)
    if (igual) dispensar(igual.id)
    const id = ++seq
    state.items.push({ id, msg, type })
    setTimeout(() => dispensar(id), DURACAO[type])
  }

  return { items: state.items, notify, dispensar }
}
