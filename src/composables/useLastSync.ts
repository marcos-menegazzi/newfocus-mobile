import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'

export function useLastSync() {
  const auth = useAuthStore()
  const lastSync = computed(() => {
    const u = auth.usuario
    if (!u || !u.data_sinc) return 'Nunca sincronizado'
    return `${u.data_sinc} ${u.hora_sinc ?? ''}`.trim()
  })
  return { lastSync }
}
