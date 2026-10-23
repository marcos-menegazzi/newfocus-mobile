import { defineStore } from 'pinia'

export const useSyncStore = defineStore('sync', {
  state: () => ({
    running: false,
    progress: 0,
    step: '',
    error: null as string | null,
  }),
  actions: {
    reset() {
      this.running = false
      this.progress = 0
      this.step = ''
      this.error = null
    },
    setProgress(p: number, step: string) {
      this.progress = Math.max(0, Math.min(100, Math.round(p)))
      this.step = step
    },
  },
})
