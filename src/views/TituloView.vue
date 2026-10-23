<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import { query } from '../db/connection'
import { formatReal, mudadata } from '../lib/format'

interface TituloRow {
  numero: string
  emissao: string
  cobranca: string
  vencimento: string
  valor: number
  obs: string
}

const route = useRoute()

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
  const rows = await query<TituloRow>(
    'SELECT * FROM titulos WHERE clifor = ? AND numero = ?',
    [idcliente.value, numero.value],
  )
  titulo.value = rows[0] ?? null
})
</script>

<template>
  <AppShell>
    <div class="p-6">
      <ScreenHeader :title="titulo ? `Título ${titulo.numero}` : 'Título'" />

      <EmptyState v-if="!titulo" label="Título não encontrado" />
      <section v-else class="bg-white rounded-card shadow-card p-5">
        <div class="grid grid-cols-1 gap-3">
          <div>
            <span class="text-ink-600 text-xs font-medium">Emissão</span>
            <p class="text-sm text-ink-900">{{ mudadata(titulo.emissao) }}</p>
          </div>
          <div>
            <span class="text-ink-600 text-xs font-medium">Cobrança</span>
            <p class="text-sm text-ink-900">{{ titulo.cobranca }}</p>
          </div>
          <div>
            <span class="text-ink-600 text-xs font-medium">Vencimento</span>
            <p class="text-sm text-ink-900">{{ mudadata(titulo.vencimento) }}</p>
          </div>
          <div>
            <span class="text-ink-600 text-xs font-medium">Valor</span>
            <p class="text-sm text-ink-900">{{ formatReal(titulo.valor) }}</p>
          </div>
          <div>
            <span class="text-ink-600 text-xs font-medium">Observação</span>
            <p class="text-sm text-ink-900">{{ titulo.obs || '—' }}</p>
          </div>
        </div>
      </section>
    </div>
  </AppShell>
</template>
