<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import Icon from '../components/Icon.vue'
import LoadingState from '../components/LoadingState.vue'
import Sheet from '../components/Sheet.vue'
import { query } from '../db/connection'
import { formatReal, mudadata } from '../lib/format'
import { titulosAbertos, duplicata, type TituloAberto } from '../services/sync/titulos_abertos'
import { useToast } from '../composables/useToast'

interface TituloRow {
  numero: string
  empresa: number
  cobranca: string
  vencimento: string
  valor: number
}

const route = useRoute()
const { notify } = useToast()

const idcliente = computed(() => {
  const p = route.params.idcliente
  return Array.isArray(p) ? p[0] : p
})
const fantasia = computed(() => {
  const q = route.query.fantasia
  return typeof q === 'string' ? q : ''
})

const titulos = ref<TituloRow[]>([])
const loading = ref(false)

const total = computed(() => titulos.value.reduce((s, t) => s + (Number(t.valor) || 0), 0))

onMounted(async () => {
  loading.value = true
  try {
    titulos.value = await query<TituloRow>('SELECT * FROM titulos WHERE clifor = ?', [idcliente.value])
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  } finally {
    loading.value = false
  }
})

const abertos = ref(false)
const abertosRows = ref<TituloAberto[]>([])
const abertosLoading = ref(false)

async function abrirAbertos() {
  abertos.value = true
  abertosLoading.value = true
  abertosRows.value = []
  try {
    abertosRows.value = await titulosAbertos(idcliente.value ?? '')
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Não foi possível carregar os títulos abertos', 'error')
  } finally {
    abertosLoading.value = false
  }
}

async function verDuplicata(r: TituloAberto) {
  try {
    await duplicata(r.lancto)
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Não foi possível gerar a duplicata', 'error')
  }
}
</script>

<template>
  <AppShell title="Títulos" :subtitle="fantasia || undefined" back>
    <div class="page">
      <LoadingState v-if="loading" />
      <div v-else-if="titulos.length === 0" class="panel">
        <EmptyState icon="receipt" label="Nenhum título deste cliente" hint="Consulte os títulos em aberto direto no servidor.">
          <button class="btn btn-tonal btn-sm" @click="abrirAbertos">Ver títulos em aberto</button>
        </EmptyState>
      </div>
      <template v-else>
        <section class="panel flex items-center justify-between gap-4 px-4 py-4">
          <div>
            <p class="meta">{{ titulos.length }} {{ titulos.length === 1 ? 'título' : 'títulos' }}</p>
            <p class="mt-1 flex items-baseline gap-1">
              <span class="text-sm text-ink-500">R$</span>
              <span class="figure text-[30px]">{{ formatReal(total) }}</span>
            </p>
          </div>
          <button class="btn btn-tonal btn-sm" @click="abrirAbertos">Em aberto no servidor</button>
        </section>

        <ul class="list">
          <li v-for="t in titulos" :key="t.numero">
            <RouterLink
              :to="{ path: `/titulo/${t.numero}`, query: { idcliente, fantasia } }"
              class="list-row flex items-center gap-3"
            >
              <div class="min-w-0 flex-1">
                <p class="text-[15px] font-medium tabular-nums">Nº {{ t.numero }}</p>
                <p class="meta truncate">{{ t.cobranca }}, empresa {{ t.empresa }}</p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-[15px] font-semibold tabular-nums">R$ {{ formatReal(t.valor) }}</p>
                <p class="meta tabular-nums">Vence {{ mudadata(t.vencimento) }}</p>
              </div>
              <Icon name="chevron-right" class="text-ink-400" />
            </RouterLink>
          </li>
        </ul>
      </template>
    </div>

    <Sheet :open="abertos" title="Títulos em aberto" :subtitle="fantasia || undefined" size="tall" @close="abertos = false">
      <LoadingState v-if="abertosLoading" label="Consultando o servidor…" />
      <EmptyState v-else-if="abertosRows.length === 0" icon="check-circle" label="Nenhum título em aberto" />
      <ul v-else class="divide-y divide-ink-100 -mx-5">
        <li v-for="(r, i) in abertosRows" :key="i" class="flex items-center gap-3 px-5 py-3">
          <div class="min-w-0 flex-1">
            <p class="text-[15px] font-medium tabular-nums">Nº {{ r.numero }}</p>
            <p class="meta truncate">{{ r.cobranca }}, vence {{ mudadata(r.dtvenc) }}</p>
          </div>
          <p class="text-[15px] font-semibold tabular-nums shrink-0">R$ {{ formatReal(r.valor) }}</p>
          <button class="btn btn-tonal btn-sm shrink-0" @click="verDuplicata(r)">Duplicata</button>
        </li>
      </ul>
    </Sheet>
  </AppShell>
</template>
