<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import Icon from '../components/Icon.vue'
import LoadingState from '../components/LoadingState.vue'
import { query } from '../db/connection'
import { formatReal, mudadata } from '../lib/format'
import { hojeISO } from '../lib/periodo'
import { useToast } from '../composables/useToast'

interface TituloRow {
  numero: string
  emissao: string
  cobranca: string
  vencimento: string
  valor: number
  obs: string
}

const route = useRoute()
const { notify } = useToast()

// O número do título não serve de chave na rota: pode ter barra e se repetir entre empresas.
const idtitulo = computed(() => Number(route.params.idtitulo))

const titulo = ref<TituloRow | null>(null)
const loading = ref(true)
const vencido = computed(() => !!titulo.value?.vencimento && titulo.value.vencimento.slice(0, 10) < hojeISO())

onMounted(async () => {
  try {
    const rows = await query<TituloRow>('SELECT * FROM titulos WHERE idtitulo = ?', [idtitulo.value])
    titulo.value = rows[0] ?? null
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <AppShell :title="titulo ? `Título ${titulo.numero}` : 'Título'" back>
    <div class="page">
      <LoadingState v-if="loading" />
      <div v-else-if="!titulo" class="panel">
        <EmptyState icon="receipt" label="Título não encontrado" hint="Sincronize para atualizar os títulos deste cliente." />
      </div>
      <template v-else>
        <section class="panel px-4 py-4">
          <p class="meta">Valor</p>
          <p class="mt-1 flex items-baseline gap-1">
            <span class="text-sm text-ink-500">R$</span>
            <span class="figure text-[36px]">{{ formatReal(titulo.valor) }}</span>
          </p>
          <p
            class="mt-2 flex items-center gap-1.5 text-[13px] tabular-nums"
            :class="vencido ? 'font-semibold text-danger-700' : 'text-ink-500'"
          >
            <Icon v-if="vencido" name="alert" :size="16" />
            {{ vencido ? 'Venceu em' : 'Vence em' }} {{ mudadata(titulo.vencimento) }}
          </p>
        </section>
        <dl class="list">
          <div class="flex justify-between gap-4 px-4 py-3.5">
            <dt class="text-ink-500">Emissão</dt>
            <dd class="font-medium tabular-nums">{{ mudadata(titulo.emissao) }}</dd>
          </div>
          <div class="flex justify-between gap-4 px-4 py-3.5">
            <dt class="text-ink-500">Cobrança</dt>
            <dd class="font-medium text-right">{{ titulo.cobranca }}</dd>
          </div>
          <div class="px-4 py-3.5">
            <dt class="text-ink-500">Observação</dt>
            <dd class="mt-1 whitespace-pre-wrap">{{ titulo.obs || 'Sem observação' }}</dd>
          </div>
        </dl>
      </template>
    </div>
  </AppShell>
</template>
