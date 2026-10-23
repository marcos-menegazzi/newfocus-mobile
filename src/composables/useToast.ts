import { reactive } from 'vue'

type ToastType = 'info' | 'success' | 'error'
interface ToastItem { id: number; msg: string; type: ToastType }

const state = reactive<{ items: ToastItem[] }>({ items: [] })
let seq = 0

export function useToast() {
  function notify(msg: string, type: ToastType = 'info') {
    const id = ++seq
    state.items.push({ id, msg, type })
    setTimeout(() => {
      const i = state.items.findIndex((t) => t.id === id)
      if (i >= 0) state.items.splice(i, 1)
    }, 3500)
  }
  return { items: state.items, notify }
}
