import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { mudadata } from '../lib/format'

export function useLastSync() {
  const auth = useAuthStore()
  const lastSync = computed(() => {
    const u = auth.usuario
    if (!u || !u.data_sinc) return 'nunca'
    // Com os segundos: é por eles que se confere quanto a sincronização demorou.
    const hora = (u.hora_sinc ?? '').slice(0, 8)
    return `${mudadata(u.data_sinc)}${hora ? ` às ${hora}` : ''}`
  })
  return { lastSync }
}
