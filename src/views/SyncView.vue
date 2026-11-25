<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import FieldError from '../components/FieldError.vue'
import Icon from '../components/Icon.vue'
import Sheet from '../components/Sheet.vue'
import Meter from '../components/Meter.vue'
import { query } from '../db/connection'
import { sincronizar, SYNC_TUDO, type GrupoSync } from '../services/sync'
import { pendenciasRestauracao, restaurar } from '../services/restaurar'
import { useSyncStore } from '../stores/sync'
import { useAuthStore } from '../stores/auth'
import { useLastSync } from '../composables/useLastSync'
import { useToast } from '../composables/useToast'

const store = useSyncStore()
const auth = useAuthStore()
const { lastSync } = useLastSync()
const { notify } = useToast()
const router = useRouter()

const GRUPOS: { key: GrupoSync; label: string; icon: string }[] = [
  { key: 'clientes', label: 'Clientes', icon: 'users' },
  { key: 'produtos', label: 'Produtos, preços e estoque', icon: 'package' },
  { key: 'pedidos', label: 'Pedidos', icon: 'orders' },
  { key: 'titulos', label: 'Títulos', icon: 'receipt' },
  { key: 'historico', label: 'Histórico de vendas', icon: 'chart' },
  { key: 'agenda', label: 'Agenda de visitas', icon: 'calendar' },
]
const opcoes = reactive({ ...SYNC_TUDO })

const pedidos = ref(0)
const clientes = ref(0)
const visitas = ref(0)
const done = ref(false)

async function contarPendencias() {
  const [[p], [c], [v]] = await Promise.all([
    query<{ total: number }>("SELECT COUNT(*) AS total FROM ped WHERE status = 'F'"),
    query<{ total: number }>("SELECT COUNT(*) AS total FROM clifor WHERE enviado IS NULL OR enviado <> 'S'"),
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
    await sincronizar({ ...opcoes })
    done.value = true
    notify('Sincronização concluída', 'success')
  } catch {
    // erro exibido a partir de store.error
  } finally {
    auth.loadSession().catch(() => {})
    contarPendencias().catch(() => {})
  }
}

const showRestaurar = ref(false)
const senha = ref('')
const restaurando = ref(false)
const erroRestaurar = ref('')

async function abrirRestaurar() {
  const pendencia = await pendenciasRestauracao()
  if (pendencia) return notify(pendencia, 'error')
  senha.value = ''
  erroRestaurar.value = ''
  showRestaurar.value = true
}

async function confirmarRestaurar() {
  restaurando.value = true
  erroRestaurar.value = ''
  try {
    await restaurar(senha.value)
    showRestaurar.value = false
    auth.$reset()
    await router.replace({ name: 'login' })
  } catch (e) {
    erroRestaurar.value = e instanceof Error ? e.message : 'Não foi possível restaurar.'
  } finally {
    restaurando.value = false
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
            :class="store.error ? 'bg-danger-100 text-danger-700' : done ? 'bg-success-50 text-success-600' : 'bg-brand-50 text-brand-600'"
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

        <div v-if="store.running || done || store.error" class="mt-5">
          <div class="flex items-baseline justify-between gap-3 mb-2">
            <span class="text-sm text-ink-700 truncate" role="status">{{ store.step }}</span>
            <span class="text-sm font-semibold tabular-nums">{{ store.progress }}%</span>
          </div>
          <Meter :value="store.progress" :max="100" label="Progresso da sincronização" />
        </div>

        <p v-if="store.error" class="mt-4 alert alert-danger" role="alert">
          <Icon name="alert" class="mt-px" />
          <span>{{ store.error }}</span>
        </p>

        <fieldset class="mt-5" :disabled="store.running">
          <legend class="label">O que sincronizar</legend>
          <div class="divide-y divide-ink-100 rounded-xl border border-ink-200">
            <label v-for="g in GRUPOS" :key="g.key" class="switch-row px-3.5 py-1.5 text-[15px]">
              <Icon :name="g.icon" class="text-ink-500" />
              <span class="flex-1">{{ g.label }}</span>
              <input v-model="opcoes[g.key]" type="checkbox" class="switch" />
            </label>
          </div>
          <p class="meta mt-2">Condições, operações, empresas e demais cadastros são sempre atualizados.<template v-if="opcoes.pedidos && !opcoes.clientes"> Enviar pedidos também atualiza os clientes.</template></p>
        </fieldset>

        <button type="button" class="btn btn-primary w-full mt-5" :disabled="store.running" :aria-busy="store.running" @click="iniciar">
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
        <p class="meta px-1 mt-2">A sincronização envia esses registros e baixa os dados marcados acima.</p>
      </section>

      <section class="panel p-4">
        <h2 class="section-title">Restaurar o aplicativo</h2>
        <p class="meta mt-0.5">Apaga todos os dados deste aparelho. Depois será preciso entrar e sincronizar de novo.</p>
        <button class="btn btn-danger w-full mt-4" :disabled="store.running" @click="abrirRestaurar">
          <Icon name="trash" :size="18" /> Restaurar
        </button>
      </section>
    </div>

    <Sheet :open="showRestaurar" title="Restaurar o aplicativo" subtitle="Essa ação não pode ser desfeita" @close="showRestaurar = false">
      <form id="form-restaurar" @submit.prevent="confirmarRestaurar">
        <label class="block">
          <span class="label">Digite sua senha para confirmar</span>
          <input v-model="senha" type="password" autocomplete="current-password" class="input" required :aria-invalid="!!erroRestaurar" aria-describedby="erro-restaurar" />
        </label>
        <div role="alert"><FieldError id="erro-restaurar" :msg="erroRestaurar" /></div>
      </form>
      <template #footer>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" class="btn btn-secondary" @click="showRestaurar = false">Cancelar</button>
          <button type="submit" form="form-restaurar" class="btn btn-danger-solid" :disabled="restaurando || !senha" :aria-busy="restaurando">
            {{ restaurando ? 'Restaurando…' : 'Apagar tudo' }}
          </button>
        </div>
      </template>
    </Sheet>
  </AppShell>
</template>
