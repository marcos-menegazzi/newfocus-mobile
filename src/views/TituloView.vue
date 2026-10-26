<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import { query } from '../db/connection'
import { formatReal, mudadata } from '../lib/format'
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

const numero = computed(() => {
  const p = route.params.numero
  return Array.isArray(p) ? p[0] : p
})
const idcliente = computed(() => {
  const q = route.query.idcliente
  return typeof q === 'string' ? q : ''
})

const titulo = ref<TituloRow | null>(null)

onMounted(async () => {
  try {
    const rows = await query<TituloRow>(
      'SELECT * FROM titulos WHERE clifor = ? AND numero = ?',
      [idcliente.value, numero.value],
    )
    titulo.value = rows[0] ?? null
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  }
})
</script>

<template>
  <AppShell :title="titulo ? `Título ${titulo.numero}` : 'Título'" back>
    <div class="page">
      <div v-if="!titulo" class="panel">
        <EmptyState icon="receipt" label="Título não encontrado" />
      </div>
      <template v-else>
        <section class="panel px-4 py-4">
          <p class="meta">Valor</p>
          <p class="mt-1 flex items-baseline gap-1">
            <span class="text-sm text-ink-500">R$</span>
            <span class="figure text-[36px]">{{ formatReal(titulo.valor) }}</span>
          </p>
          <p class="meta mt-1.5">Vence em {{ mudadata(titulo.vencimento) }}</p>
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
