<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import Icon from '../components/Icon.vue'
import Meter from '../components/Meter.vue'
import { query } from '../db/connection'
import { sincronizar } from '../services/sync'
import { useSyncStore } from '../stores/sync'
import { useAuthStore } from '../stores/auth'
import { useLastSync } from '../composables/useLastSync'
import { useToast } from '../composables/useToast'

const store = useSyncStore()
const auth = useAuthStore()
const { lastSync } = useLastSync()
const { notify } = useToast()

const pedidos = ref(0)
const clientes = ref(0)
const visitas = ref(0)
const done = ref(false)

async function contarPendencias() {
  const [[p], [c], [v]] = await Promise.all([
    query<{ total: number }>("SELECT COUNT(*) AS total FROM ped WHERE status = 'F'"),
    query<{ total: number }>("SELECT COUNT(*) AS total FROM clifor WHERE enviado = 'N'"),
    query<{ total: number }>("SELECT COUNT(*) AS total FROM visitas WHERE sincronizada = 'N' OR sincronizada IS NULL"),
  ])
  pedidos.value = p?.total ?? 0
  clientes.value = c?.total ?? 0
  visitas.value = v?.total ?? 0
}

onMounted(() => {
  if (!store.running) store.reset()
  contarPendencias().catch(() => {})
})

async function iniciar() {
  done.value = false
  try {
    await sincronizar()
    done.value = true
    notify('Sincronização concluída', 'success')
  } catch {
    // erro exibido a partir de store.error
  } finally {
    auth.loadSession().catch(() => {})
    contarPendencias().catch(() => {})
  }
}
</script>

<template>
  <AppShell title="Sincronizar">
    <div class="page">
      <section class="panel p-5">
        <div class="flex items-center gap-3">
          <div
            class="h-12 w-12 rounded-2xl flex items-center justify-center"
            :class="store.error ? 'bg-danger-100 text-danger-700' : done ? 'bg-success-50 text-success-600' : 'bg-brand-50 text-brand-700'"
          >
            <Icon :name="store.error ? 'alert' : done ? 'check-circle' : 'sync'" :size="24" :class="{ 'animate-spin [animation-duration:2s]': store.running }" />
          </div>
          <div class="min-w-0">
            <p class="section-title">
              {{ store.running ? 'Sincronizando…' : store.error ? 'A sincronização parou' : done ? 'Tudo em dia' : 'Pronto para sincronizar' }}
            </p>
            <p class="meta">Última sincronização: {{ lastSync }}</p>
          </div>
        </div>

        <div v-if="store.running || done || store.error" class="mt-5" aria-live="polite">
          <div class="flex items-baseline justify-between gap-3 mb-2">
            <span class="text-sm text-ink-700 truncate">{{ store.step }}</span>
            <span class="text-sm font-semibold tabular-nums">{{ store.progress }}%</span>
          </div>
          <Meter :value="store.progress" :max="100" label="Progresso da sincronização" />
        </div>

        <p v-if="store.error" class="mt-4 flex items-start gap-2 rounded-xl bg-danger-100 text-danger-700 px-3.5 py-3 text-sm" role="alert">
          <Icon name="alert" class="mt-px" />
          <span>{{ store.error }}</span>
        </p>

        <button class="btn btn-primary w-full mt-5" :disabled="store.running" @click="iniciar">
          <Icon name="sync" />
          {{ store.running ? 'Sincronizando…' : store.error ? 'Tentar de novo' : 'Sincronizar agora' }}
        </button>
        <p v-if="store.running" class="meta mt-3 text-center">Mantenha o app aberto até o fim.</p>
      </section>

      <section>
        <h2 class="section-title px-1 mb-2">Aguardando envio</h2>
        <ul class="list">
          <li class="flex items-center justify-between px-4 py-3.5">
            <span class="flex items-center gap-3 text-[15px]"><Icon name="orders" class="text-ink-500" /> Pedidos finalizados</span>
            <span class="font-semibold tabular-nums">{{ pedidos }}</span>
          </li>
          <li class="flex items-center justify-between px-4 py-3.5">
            <span class="flex items-center gap-3 text-[15px]"><Icon name="users" class="text-ink-500" /> Clientes novos ou alterados</span>
            <span class="font-semibold tabular-nums">{{ clientes }}</span>
          </li>
          <li class="flex items-center justify-between px-4 py-3.5">
            <span class="flex items-center gap-3 text-[15px]"><Icon name="calendar" class="text-ink-500" /> Visitas registradas</span>
            <span class="font-semibold tabular-nums">{{ visitas }}</span>
          </li>
        </ul>
        <p class="meta px-1 mt-2">A sincronização envia esses registros e baixa clientes, produtos, preços, estoque, títulos e agenda atualizados.</p>
      </section>
    </div>
  </AppShell>
</template>
